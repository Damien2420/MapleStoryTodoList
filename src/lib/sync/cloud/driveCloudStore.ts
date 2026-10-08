import { CloudError, type AccessTokenProvider, type CloudFileMeta, type CloudStore } from '@/lib/sync/cloud/cloudStore';

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS = 'id,name,version,headRevisionId';
const UPLOAD_BOUNDARY = 'mstd-cloud-store-boundary';
/** Drive 用 403 回報額度超過時的 reason；其他 403 視為權限不足 */
const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);

interface DriveFile {
  id?: string;
  name?: string;
  version?: string;
  headRevisionId?: string;
}

interface DriveErrorBody {
  error?: { errors?: Array<{ reason?: string }> };
}

/** Drive 搜尋語法的字串常值要跳脫反斜線與單引號 */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toMeta(data: DriveFile): CloudFileMeta {
  if (!data.id || !data.name || data.version === undefined || !data.headRevisionId) {
    throw new CloudError('server', 'Google Drive 回應格式不符預期');
  }
  return { id: data.id, name: data.name, version: String(data.version), headRevisionId: data.headRevisionId };
}

async function toCloudError(res: Response): Promise<CloudError> {
  if (res.status === 401) return new CloudError('unauthorized', 'Google Drive 授權已失效');
  if (res.status === 404) return new CloudError('notFound', '找不到雲端檔案');
  if (res.status === 429) return new CloudError('rateLimited', 'Google Drive 請求過於頻繁，稍後再試');
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as DriveErrorBody;
    const reason = body.error?.errors?.[0]?.reason ?? '';
    return RATE_LIMIT_REASONS.has(reason)
      ? new CloudError('rateLimited', 'Google Drive 請求過於頻繁，稍後再試')
      : new CloudError('unauthorized', '沒有 Google Drive 存取權限');
  }
  return new CloudError('server', `Google Drive 回應錯誤（狀態碼 ${res.status}）`);
}

/**
 * 建立以 Google Drive REST v3 實作的 CloudStore，所有檔案都放在 appDataFolder。
 * 只做請求翻譯：帶上 access token、401 時讓 token 失效並重試一次、把錯誤轉成 CloudError。
 * @param tokens access token 來源（正式環境傳入 authClient）；它丟出的錯誤會原樣往上拋
 * @param fetchFn 注入的 fetch，測試時替換
 * @returns CloudStore 實例
 */
export function createDriveCloudStore(
  tokens: AccessTokenProvider,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
): CloudStore {
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const token = await tokens.getAccessToken();
      let res: Response;
      try {
        res = await fetchFn(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
        });
      } catch {
        throw new CloudError('network', '無法連線至 Google Drive');
      }
      if (res.ok) return res;
      if (res.status === 401 && attempt === 0) {
        tokens.invalidateAccessToken(token);
        continue;
      }
      throw await toCloudError(res);
    }
  }

  return {
    async findFiles(name) {
      const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name='${escapeQueryValue(name)}' and trashed=false`,
        fields: `files(${FILE_FIELDS})`,
        orderBy: 'createdTime',
        pageSize: '100',
      });
      const res = await send(`${FILES_URL}?${params}`);
      const data = (await res.json()) as { files?: DriveFile[] };
      return (data.files ?? []).map(toMeta);
    },

    async download(fileId) {
      return (await send(`${FILES_URL}/${fileId}?alt=media`)).text();
    },

    async downloadRevision(fileId, revisionId) {
      return (await send(`${FILES_URL}/${fileId}/revisions/${revisionId}?alt=media`)).text();
    },

    async create(name, content) {
      const body =
        `--${UPLOAD_BOUNDARY}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n` +
        `--${UPLOAD_BOUNDARY}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${content}\r\n` +
        `--${UPLOAD_BOUNDARY}--`;
      const res = await send(`${UPLOAD_URL}?uploadType=multipart&fields=${FILE_FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${UPLOAD_BOUNDARY}` },
        body,
      });
      return toMeta((await res.json()) as DriveFile);
    },

    async update(fileId, content) {
      const res = await send(`${UPLOAD_URL}/${fileId}?uploadType=media&fields=${FILE_FIELDS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });
      return toMeta((await res.json()) as DriveFile);
    },

    async listRevisions(fileId) {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({ pageSize: '1000', fields: 'nextPageToken,revisions(id)' });
        if (pageToken) params.set('pageToken', pageToken);
        const res = await send(`${FILES_URL}/${fileId}/revisions?${params}`);
        const data = (await res.json()) as { revisions?: Array<{ id: string }>; nextPageToken?: string };
        ids.push(...(data.revisions ?? []).map((r) => r.id));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return ids;
    },

    async delete(fileId) {
      await send(`${FILES_URL}/${fileId}`, { method: 'DELETE' });
    },
  };
}
