import { describe, expect, it } from 'vitest';
import { AuthError, createAuthClient, type AuthChannel, type AuthClientDeps, type AuthMessage } from '@/lib/auth/authClient';

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

type Route = (init?: RequestInit) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * 模擬多個分頁共用的環境：同一個後端（路由表）、同一組 Web Locks、同一個 BroadcastChannel。
 * 每個 tab() 建立一個分頁的 AuthClient。
 */
function createEnvironment(routes: Record<string, Route>) {
  const requests: RecordedRequest[] = [];
  let time = 0;

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`no route for ${url}`);
    return route(init);
  }) as typeof fetch;

  const tails = new Map<string, Promise<unknown>>();
  const withLock = <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(name) ?? Promise.resolve();
    const run = previous.then(task, task);
    tails.set(name, run.catch(() => undefined));
    return run;
  };

  const listeners: Array<(message: AuthMessage) => void> = [];
  const createChannel = (): AuthChannel => {
    let own: ((message: AuthMessage) => void) | undefined;
    return {
      post(message) {
        for (const listener of listeners) if (listener !== own) listener(message);
      },
      subscribe(listener) {
        own = listener;
        listeners.push(listener);
      },
    };
  };

  function tab(overrides: Partial<AuthClientDeps> = {}) {
    return createAuthClient({
      fetch: fetchFn,
      requestCode: async () => 'auth-code',
      withLock,
      channel: createChannel(),
      now: () => time,
      ...overrides,
    });
  }

  return {
    tab,
    requests,
    count: (url: string) => requests.filter((r) => r.url === url).length,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

/** 每次呼叫都發一個新 token（at-1、at-2…），效期一小時 */
function tokenRoute(): Route {
  let issued = 0;
  return () => json(200, { accessToken: `at-${++issued}`, expiresIn: 3600 });
}

const userinfo: Route = () => json(200, { sub: 'sub-1', email: 'user@example.com', name: '使用者', picture: 'https://pic' });

describe('getAccessToken', () => {
  it('第一次向 /api/auth/token 以 POST 加 X-Requested-With 取得 token，之後在效期內直接用快取', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute() });
    const client = env.tab();
    expect(await client.getAccessToken()).toBe('at-1');
    expect(await client.getAccessToken()).toBe('at-1');
    expect(env.count('/api/auth/token')).toBe(1);
    const init = env.requests[0].init;
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('同一分頁同時呼叫多次只會換一次 token', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute() });
    const client = env.tab();
    const results = await Promise.all([client.getAccessToken(), client.getAccessToken(), client.getAccessToken()]);
    expect(results).toEqual(['at-1', 'at-1', 'at-1']);
    expect(env.count('/api/auth/token')).toBe(1);
  });

  it('剩餘效期不到一分鐘時提前換新', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute() });
    const client = env.tab();
    await client.getAccessToken();
    env.advance(3600_000 - 60_001);
    expect(await client.getAccessToken()).toBe('at-1');
    env.advance(1);
    expect(await client.getAccessToken()).toBe('at-2');
  });

  it('invalidateAccessToken 只讓指定的 token 失效，下一次會重新換', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute() });
    const client = env.tab();
    await client.getAccessToken();
    client.invalidateAccessToken('some-other-token');
    expect(await client.getAccessToken()).toBe('at-1');
    client.invalidateAccessToken('at-1');
    expect(await client.getAccessToken()).toBe('at-2');
  });

  it('後端回 RECONNECT_REQUIRED 或 NOT_SIGNED_IN 時丟出對應代碼的 AuthError', async () => {
    const reconnect = createEnvironment({
      '/api/auth/token': () => json(401, { error: 'RECONNECT_REQUIRED', message: 'Google 授權已失效，請重新連線' }),
    });
    await expect(reconnect.tab().getAccessToken()).rejects.toMatchObject({ code: 'reconnectRequired' });

    const signedOut = createEnvironment({
      '/api/auth/token': () => json(401, { error: 'NOT_SIGNED_IN', message: '尚未登入 Google' }),
    });
    const error = await signedOut.tab().getAccessToken().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ code: 'signedOut', message: '尚未登入 Google' });
  });

  it('網路失敗時丟出 network；失敗後下一次呼叫會重新嘗試', async () => {
    let online = false;
    const issue = tokenRoute();
    const env = createEnvironment({
      '/api/auth/token': (init) => {
        if (!online) throw new TypeError('Failed to fetch');
        return issue(init);
      },
    });
    const client = env.tab();
    await expect(client.getAccessToken()).rejects.toMatchObject({ code: 'network' });
    online = true;
    expect(await client.getAccessToken()).toBe('at-1');
  });
});

describe('分頁間共用', () => {
  it('兩個分頁同時需要 token 時只換一次，第二個分頁拿到同一個 token', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute() });
    const first = env.tab();
    const second = env.tab();
    const results = await Promise.all([first.getAccessToken(), second.getAccessToken()]);
    expect(results).toEqual(['at-1', 'at-1']);
    expect(env.count('/api/auth/token')).toBe(1);
  });

  it('一個分頁登入後，其他分頁直接使用廣播過來的 token', async () => {
    const env = createEnvironment({
      '/api/auth/exchange': () => json(200, { accessToken: 'at-login', expiresIn: 3600 }),
      '/api/auth/token': tokenRoute(),
      [USERINFO_URL]: userinfo,
    });
    const first = env.tab();
    const second = env.tab();
    await first.signIn();
    expect(await second.getAccessToken()).toBe('at-login');
    expect(env.count('/api/auth/token')).toBe(0);
  });

  it('一個分頁登出後，其他分頁的快取一併清除', async () => {
    const env = createEnvironment({
      '/api/auth/token': tokenRoute(),
      '/api/auth/logout': () => new Response(null, { status: 204 }),
    });
    const first = env.tab();
    const second = env.tab();
    await second.getAccessToken();
    await first.signOut();
    expect(await second.getAccessToken()).toBe('at-2');
    expect(env.count('/api/auth/token')).toBe(2);
  });
});

describe('signIn / getUser / signOut', () => {
  it('登入：取得授權碼送到 /api/auth/exchange，再用 access token 查帳號資料', async () => {
    const env = createEnvironment({
      '/api/auth/exchange': () => json(200, { accessToken: 'at-login', expiresIn: 3600 }),
      [USERINFO_URL]: userinfo,
    });
    const client = env.tab();
    const user = await client.signIn();
    expect(user).toEqual({ sub: 'sub-1', email: 'user@example.com', name: '使用者', picture: 'https://pic' });
    const exchange = env.requests.find((r) => r.url === '/api/auth/exchange');
    expect(JSON.parse(String(exchange?.init?.body))).toEqual({ code: 'auth-code' });
    const info = env.requests.find((r) => r.url === USERINFO_URL);
    expect((info?.init?.headers as Record<string, string>).Authorization).toBe('Bearer at-login');
    expect(await client.getAccessToken()).toBe('at-login');
  });

  it('帳號資料查過一次後使用快取', async () => {
    const env = createEnvironment({ '/api/auth/token': tokenRoute(), [USERINFO_URL]: userinfo });
    const client = env.tab();
    await client.getUser();
    await client.getUser();
    expect(env.count(USERINFO_URL)).toBe(1);
  });

  it('使用者沒同意 Drive 權限時丟出 missingDriveScope，且沒有留下任何 token', async () => {
    const env = createEnvironment({
      '/api/auth/exchange': () => json(403, { error: 'MISSING_DRIVE_SCOPE', message: '尚未取得 Google Drive 存取權限' }),
      '/api/auth/token': () => json(401, { error: 'NOT_SIGNED_IN', message: '尚未登入 Google' }),
    });
    const client = env.tab();
    await expect(client.signIn()).rejects.toMatchObject({ code: 'missingDriveScope' });
    await expect(client.getAccessToken()).rejects.toMatchObject({ code: 'signedOut' });
  });

  it('使用者關閉登入彈窗時把錯誤原樣丟出，不呼叫後端', async () => {
    const env = createEnvironment({});
    const client = env.tab({
      requestCode: async () => {
        throw new AuthError('popupClosed', '登入視窗已關閉，登入失敗');
      },
    });
    await expect(client.signIn()).rejects.toMatchObject({ code: 'popupClosed' });
    expect(env.requests).toHaveLength(0);
  });

  it('登出失敗時丟出錯誤並保留目前的登入狀態', async () => {
    const env = createEnvironment({
      '/api/auth/token': tokenRoute(),
      '/api/auth/logout': () => json(500, { error: 'SERVER_ERROR', message: '登入服務暫時無法使用，請稍後再試' }),
    });
    const client = env.tab();
    await client.getAccessToken();
    await expect(client.signOut()).rejects.toMatchObject({ code: 'server' });
    expect(await client.getAccessToken()).toBe('at-1');
    expect(env.count('/api/auth/token')).toBe(1);
  });
});
