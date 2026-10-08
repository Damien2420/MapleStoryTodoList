import { describe, expect, it } from 'vitest';
import { CloudError, type AccessTokenProvider } from '@/lib/sync/cloud/cloudStore';
import { createDriveCloudStore } from '@/lib/sync/cloud/driveCloudStore';

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** 依序回傳預先排好的回應，並記錄每個請求 */
function scriptedFetch(responses: Array<Response | Error>) {
  const requests: RecordedRequest[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    const next = responses.shift();
    if (!next) throw new Error('no scripted response left');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fetchFn, requests };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** 每次 invalidate 後換下一個 token：t1 → t2 → t3 */
function tokenProvider(): AccessTokenProvider & { invalidated: string[] } {
  let current = 1;
  const invalidated: string[] = [];
  return {
    invalidated,
    getAccessToken: async () => `t${current}`,
    invalidateAccessToken(token) {
      invalidated.push(token);
      if (token === `t${current}`) current += 1;
    },
  };
}

const FILE = { id: 'f1', name: 'a.json', version: '12', headRevisionId: 'r5' };

describe('DriveCloudStore 請求格式', () => {
  it('findFiles 在 appDataFolder 依檔名查詢（跳脫單引號、排除垃圾桶、依建立時間排序）並帶 Bearer token', async () => {
    const { fetchFn, requests } = scriptedFetch([json(200, { files: [FILE] })]);
    const store = createDriveCloudStore(tokenProvider(), fetchFn);
    expect(await store.findFiles("it's.json")).toEqual([FILE]);
    const url = new URL(requests[0].url);
    expect(url.origin + url.pathname).toBe(FILES_URL);
    expect(url.searchParams.get('spaces')).toBe('appDataFolder');
    expect(url.searchParams.get('q')).toBe("name='it\\'s.json' and trashed=false");
    expect(url.searchParams.get('orderBy')).toBe('createdTime');
    expect(url.searchParams.get('fields')).toBe('files(id,name,version,headRevisionId)');
    expect(requests[0].headers.Authorization).toBe('Bearer t1');
  });

  it('create 以 multipart 上傳到 appDataFolder，update 以 media 方式 PATCH 內容', async () => {
    const { fetchFn, requests } = scriptedFetch([json(200, FILE), json(200, { ...FILE, version: '13', headRevisionId: 'r6' })]);
    const store = createDriveCloudStore(tokenProvider(), fetchFn);

    expect(await store.create('a.json', '{"n":1}')).toEqual(FILE);
    const createUrl = new URL(requests[0].url);
    expect(createUrl.origin + createUrl.pathname).toBe(UPLOAD_URL);
    expect(createUrl.searchParams.get('uploadType')).toBe('multipart');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].body).toContain('{"name":"a.json","parents":["appDataFolder"]}');
    expect(requests[0].body).toContain('{"n":1}');

    expect((await store.update('f1', '{"n":2}')).headRevisionId).toBe('r6');
    const updateUrl = new URL(requests[1].url);
    expect(updateUrl.origin + updateUrl.pathname).toBe(`${UPLOAD_URL}/f1`);
    expect(updateUrl.searchParams.get('uploadType')).toBe('media');
    expect(requests[1].method).toBe('PATCH');
    expect(requests[1].body).toBe('{"n":2}');
  });

  it('download、downloadRevision 以 alt=media 下載；delete 以 DELETE 刪除', async () => {
    const { fetchFn, requests } = scriptedFetch([
      new Response('current', { status: 200 }),
      new Response('older', { status: 200 }),
      new Response(null, { status: 204 }),
    ]);
    const store = createDriveCloudStore(tokenProvider(), fetchFn);
    expect(await store.download('f1')).toBe('current');
    expect(await store.downloadRevision('f1', 'r2')).toBe('older');
    await store.delete('f1');
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      `GET ${FILES_URL}/f1?alt=media`,
      `GET ${FILES_URL}/f1/revisions/r2?alt=media`,
      `DELETE ${FILES_URL}/f1`,
    ]);
  });

  it('listRevisions 依 nextPageToken 讀完所有分頁', async () => {
    const { fetchFn, requests } = scriptedFetch([
      json(200, { revisions: [{ id: 'r1' }, { id: 'r2' }], nextPageToken: 'page-2' }),
      json(200, { revisions: [{ id: 'r3' }] }),
    ]);
    const store = createDriveCloudStore(tokenProvider(), fetchFn);
    expect(await store.listRevisions('f1')).toEqual(['r1', 'r2', 'r3']);
    expect(new URL(requests[0].url).searchParams.get('pageToken')).toBeNull();
    expect(new URL(requests[1].url).searchParams.get('pageToken')).toBe('page-2');
  });
});

describe('DriveCloudStore 錯誤處理', () => {
  it('401 時讓 token 失效並用新 token 重試一次', async () => {
    const { fetchFn, requests } = scriptedFetch([json(401, {}), new Response('ok', { status: 200 })]);
    const tokens = tokenProvider();
    const store = createDriveCloudStore(tokens, fetchFn);
    expect(await store.download('f1')).toBe('ok');
    expect(tokens.invalidated).toEqual(['t1']);
    expect(requests.map((r) => r.headers.Authorization)).toEqual(['Bearer t1', 'Bearer t2']);
  });

  it('重試後仍 401 時丟出 unauthorized，不再重試', async () => {
    const { fetchFn, requests } = scriptedFetch([json(401, {}), json(401, {})]);
    const store = createDriveCloudStore(tokenProvider(), fetchFn);
    await expect(store.download('f1')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(requests).toHaveLength(2);
  });

  it('依狀態碼與 Drive 的 reason 分類錯誤', async () => {
    const cases: Array<[Response | Error, string]> = [
      [json(404, { error: { errors: [{ reason: 'notFound' }] } }), 'notFound'],
      [json(429, {}), 'rateLimited'],
      [json(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }), 'rateLimited'],
      [json(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }), 'rateLimited'],
      [json(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }), 'unauthorized'],
      [json(500, {}), 'server'],
      [new TypeError('Failed to fetch'), 'network'],
    ];
    for (const [response, kind] of cases) {
      const store = createDriveCloudStore(tokenProvider(), scriptedFetch([response]).fetchFn);
      const error = await store.download('f1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CloudError);
      expect((error as CloudError).kind).toBe(kind);
    }
  });

  it('取得 token 失敗時把原本的錯誤往上拋，不呼叫 Drive', async () => {
    const { fetchFn, requests } = scriptedFetch([]);
    const authError = new Error('Google 授權已失效，請重新連線');
    const store = createDriveCloudStore(
      {
        getAccessToken: async () => {
          throw authError;
        },
        invalidateAccessToken: () => {},
      },
      fetchFn,
    );
    await expect(store.download('f1')).rejects.toBe(authError);
    expect(requests).toHaveLength(0);
  });
});
