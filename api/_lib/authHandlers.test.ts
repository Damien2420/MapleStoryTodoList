// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExchange, handleLogout, handleToken, type AuthEnv, type AuthRequest } from './authHandlers.js';
import { REFRESH_COOKIE_NAME } from './authCookie.js';
import { decrypt, encrypt, parseKeyRing } from './tokenCrypto.js';

const DRIVE = 'https://www.googleapis.com/auth/drive.appdata';
const KEY = `k1:${randomBytes(32).toString('base64')}`;
const ENV: AuthEnv = { clientId: 'client-id', clientSecret: 'client-secret', encryptionKeys: KEY };

function request(overrides: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): AuthRequest {
  return {
    method: overrides.method ?? 'POST',
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      origin: 'https://app.example.com',
      host: 'app.example.com',
      ...overrides.headers,
    },
    body: overrides.body,
  };
}

/** 假的 Google token 端點：記錄送出的參數，回傳指定內容 */
function google(status: number, body: unknown) {
  const params: URLSearchParams[] = [];
  const fetchFn = vi.fn(async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    params.push(new URLSearchParams(String(init?.body)));
    return new Response(JSON.stringify(body), { status });
  });
  return { fetch: fetchFn as unknown as typeof fetch, fetchFn, params };
}

/** 把指定的 refresh token 用指定金鑰環加密成 cookie header */
function cookieHeader(refreshToken: string, keys = KEY): string {
  return `theme=dark; ${REFRESH_COOKIE_NAME}=${encrypt(refreshToken, parseKeyRing(keys), REFRESH_COOKIE_NAME)}`;
}

/** 從 Set-Cookie 字串取出 cookie 的值 */
function cookieValue(setCookie: string | undefined): string {
  return (setCookie ?? '').split(';')[0].slice(REFRESH_COOKIE_NAME.length + 1);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('請求檢查（三支端點共用）', () => {
  it('非 POST 回 405', async () => {
    const g = google(200, {});
    expect((await handleToken(request({ method: 'GET' }), { fetch: g.fetch, env: ENV })).status).toBe(405);
    expect(handleLogout(request({ method: 'GET' })).status).toBe(405);
  });

  it('缺少 X-Requested-With 回 403，且不呼叫 Google', async () => {
    const g = google(200, {});
    const res = await handleExchange(request({ headers: { 'x-requested-with': '' }, body: { code: 'c' } }), {
      fetch: g.fetch,
      env: ENV,
    });
    expect(res.status).toBe(403);
    expect(g.fetchFn).not.toHaveBeenCalled();
  });

  it('Origin 與 Host 不同（不同網域或不同 port）或缺少 Origin 時回 403', async () => {
    const deps = { fetch: google(200, {}).fetch, env: ENV };
    expect((await handleToken(request({ headers: { origin: 'https://evil.example.com' } }), deps)).status).toBe(403);
    expect((await handleToken(request({ headers: { origin: 'https://app.example.com:8443' } }), deps)).status).toBe(403);
    expect((await handleToken(request({ headers: { origin: '' } }), deps)).status).toBe(403);
    expect(handleLogout(request({ headers: { origin: 'https://evil.example.com' } })).status).toBe(403);
  });
});

describe('handleExchange', () => {
  it('換到 token 後回傳 access token，並把 refresh token 加密寫進安全屬性齊全的 cookie', async () => {
    const g = google(200, { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: `openid email ${DRIVE}` });
    const res = await handleExchange(request({ body: { code: 'auth-code' } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: 'at', expiresIn: 3599 });
    expect(res.setCookie).toContain('HttpOnly');
    expect(res.setCookie).toContain('Secure');
    expect(res.setCookie).toContain('SameSite=Strict');
    expect(res.setCookie).toContain('Path=/');
    expect(cookieValue(res.setCookie)).not.toBe('rt');
    expect(decrypt(cookieValue(res.setCookie), parseKeyRing(KEY), REFRESH_COOKIE_NAME)?.plaintext).toBe('rt');
    expect(g.params[0].get('code')).toBe('auth-code');
  });

  it('使用者沒有同意 Drive 權限時回 403 MISSING_DRIVE_SCOPE，不寫 cookie', async () => {
    const g = google(200, { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: 'openid email' });
    const res = await handleExchange(request({ body: { code: 'c' } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'MISSING_DRIVE_SCOPE' });
    expect(res.setCookie).toBeUndefined();
  });

  it('Google 沒有回傳 refresh token 時回 502 NO_REFRESH_TOKEN，不寫 cookie', async () => {
    const g = google(200, { access_token: 'at', expires_in: 3599, scope: DRIVE });
    const res = await handleExchange(request({ body: { code: 'c' } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: 'NO_REFRESH_TOKEN' });
    expect(res.setCookie).toBeUndefined();
  });

  it('授權碼失效回 400 INVALID_CODE；缺少授權碼回 400 INVALID_REQUEST 且不呼叫 Google', async () => {
    const invalid = google(400, { error: 'invalid_grant' });
    const res = await handleExchange(request({ body: { code: 'used' } }), { fetch: invalid.fetch, env: ENV });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'INVALID_CODE' });

    const g = google(200, {});
    const missing = await handleExchange(request({ body: {} }), { fetch: g.fetch, env: ENV });
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ error: 'INVALID_REQUEST' });
    expect(g.fetchFn).not.toHaveBeenCalled();
  });

  it('環境變數缺少或金鑰格式錯誤時回 500 SERVER_ERROR，回應內容不含任何設定值', async () => {
    const g = google(200, {});
    const noSecret = await handleExchange(request({ body: { code: 'c' } }), {
      fetch: g.fetch,
      env: { ...ENV, clientSecret: undefined },
    });
    expect(noSecret.status).toBe(500);
    expect(noSecret.body).toMatchObject({ error: 'SERVER_ERROR' });

    const badKey = await handleExchange(request({ body: { code: 'c' } }), {
      fetch: g.fetch,
      env: { ...ENV, encryptionKeys: 'k1:short' },
    });
    expect(badKey.status).toBe(500);
    expect(JSON.stringify(badKey.body)).not.toContain('short');
    expect(g.fetchFn).not.toHaveBeenCalled();
  });
});

describe('handleToken', () => {
  it('沒有 cookie 時回 401 NOT_SIGNED_IN，不呼叫 Google', async () => {
    const g = google(200, {});
    const res = await handleToken(request(), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'NOT_SIGNED_IN' });
    expect(g.fetchFn).not.toHaveBeenCalled();
  });

  it('cookie 被竄改或是用已移除的金鑰加密時回 401 NOT_SIGNED_IN 並清除 cookie', async () => {
    const g = google(200, {});
    const tampered = await handleToken(request({ headers: { cookie: `${REFRESH_COOKIE_NAME}=k1.AAAA.BBBB.CCCC` } }), {
      fetch: g.fetch,
      env: ENV,
    });
    expect(tampered.status).toBe(401);
    expect(tampered.body).toMatchObject({ error: 'NOT_SIGNED_IN' });
    expect(tampered.setCookie).toContain('Max-Age=0');

    const retiredKey = `old:${randomBytes(32).toString('base64')}`;
    const retired = await handleToken(request({ headers: { cookie: cookieHeader('rt', retiredKey) } }), {
      fetch: g.fetch,
      env: ENV,
    });
    expect(retired.status).toBe(401);
    expect(retired.setCookie).toContain('Max-Age=0');
    expect(g.fetchFn).not.toHaveBeenCalled();
  });

  it('用解密出的 refresh token 換新 access token，並重新寫入 cookie', async () => {
    const g = google(200, { access_token: 'at2', expires_in: 3600, scope: DRIVE });
    const res = await handleToken(request({ headers: { cookie: cookieHeader('rt') } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: 'at2', expiresIn: 3600 });
    expect(g.params[0].get('refresh_token')).toBe('rt');
    expect(decrypt(cookieValue(res.setCookie), parseKeyRing(KEY), REFRESH_COOKIE_NAME)?.plaintext).toBe('rt');
  });

  it('金鑰輪替：舊金鑰加密的 cookie 仍可使用，回應的新 cookie 改用新金鑰加密', async () => {
    const oldKey = `old:${randomBytes(32).toString('base64')}`;
    const newKey = `new:${randomBytes(32).toString('base64')}`;
    const g = google(200, { access_token: 'at2', expires_in: 3600, scope: DRIVE });
    const res = await handleToken(request({ headers: { cookie: cookieHeader('rt', oldKey) } }), {
      fetch: g.fetch,
      env: { ...ENV, encryptionKeys: `${newKey},${oldKey}` },
    });
    expect(res.status).toBe(200);
    expect(decrypt(cookieValue(res.setCookie), parseKeyRing(newKey), REFRESH_COOKIE_NAME)?.plaintext).toBe('rt');
  });

  it('Google 換發新的 refresh token 時，新 cookie 保存新的那一個', async () => {
    const g = google(200, { access_token: 'at2', expires_in: 3600, refresh_token: 'rt-new', scope: DRIVE });
    const res = await handleToken(request({ headers: { cookie: cookieHeader('rt') } }), { fetch: g.fetch, env: ENV });
    expect(decrypt(cookieValue(res.setCookie), parseKeyRing(KEY), REFRESH_COOKIE_NAME)?.plaintext).toBe('rt-new');
  });

  it('refresh token 已失效（invalid_grant）時回 401 RECONNECT_REQUIRED 並清除 cookie', async () => {
    const g = google(400, { error: 'invalid_grant' });
    const res = await handleToken(request({ headers: { cookie: cookieHeader('rt') } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'RECONNECT_REQUIRED' });
    expect(res.setCookie).toContain('Max-Age=0');
  });

  it('Google 暫時錯誤時回 502 UPSTREAM_ERROR，保留 cookie 讓之後可以重試', async () => {
    const g = google(503, { error: 'backend_error' });
    const res = await handleToken(request({ headers: { cookie: cookieHeader('rt') } }), { fetch: g.fetch, env: ENV });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: 'UPSTREAM_ERROR' });
    expect(res.setCookie).toBeUndefined();
  });
});

describe('handleLogout', () => {
  it('回 204 並清除 cookie', () => {
    const res = handleLogout(request());
    expect(res.status).toBe(204);
    expect(res.body).toBeUndefined();
    expect(res.setCookie).toBe(`${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  });
});
