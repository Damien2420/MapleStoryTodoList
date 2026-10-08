// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCode, refreshAccessToken } from './googleToken.js';

const CONFIG = { clientId: 'client-id', clientSecret: 'client-secret' };

interface RecordedCall {
  url: string;
  method: string | undefined;
  params: URLSearchParams;
}

/** 假的 fetch：記錄每次請求，並回傳指定的狀態碼與 JSON */
function googleReturns(status: number, body: unknown) {
  const calls: RecordedCall[] = [];
  const fetchFn = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method, params: new URLSearchParams(String(init?.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetchFn, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exchangeCode', () => {
  it('以 postmessage 作為 redirect_uri 送出授權碼，並回傳 token 與實際同意的 scope', async () => {
    const { fetchFn, calls } = googleReturns(200, {
      access_token: 'at',
      expires_in: 3599,
      refresh_token: 'rt',
      scope: 'openid https://www.googleapis.com/auth/drive.appdata',
    });
    const result = await exchangeCode(fetchFn, CONFIG, 'auth-code');
    expect(result).toEqual({
      ok: true,
      accessToken: 'at',
      expiresIn: 3599,
      refreshToken: 'rt',
      scope: 'openid https://www.googleapis.com/auth/drive.appdata',
    });
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0].method).toBe('POST');
    expect(Object.fromEntries(calls[0].params)).toEqual({
      code: 'auth-code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    });
  });

  it('Google 回 400 invalid_grant 時分類成 invalidGrant', async () => {
    const { fetchFn } = googleReturns(400, { error: 'invalid_grant' });
    expect(await exchangeCode(fetchFn, CONFIG, 'used-code')).toEqual({ ok: false, reason: 'invalidGrant' });
  });
});

describe('refreshAccessToken', () => {
  it('以 refresh_token grant 換新的 access token；Google 沒換發新的 refresh token 時 refreshToken 為 undefined', async () => {
    const { fetchFn, calls } = googleReturns(200, { access_token: 'at2', expires_in: 3600, scope: 'openid' });
    const result = await refreshAccessToken(fetchFn, CONFIG, 'rt');
    expect(result).toEqual({ ok: true, accessToken: 'at2', expiresIn: 3600, refreshToken: undefined, scope: 'openid' });
    expect(Object.fromEntries(calls[0].params)).toEqual({
      refresh_token: 'rt',
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'refresh_token',
    });
  });

  it('refresh token 失效（400 invalid_grant）時分類成 invalidGrant', async () => {
    const { fetchFn } = googleReturns(400, { error: 'invalid_grant' });
    expect(await refreshAccessToken(fetchFn, CONFIG, 'revoked')).toEqual({ ok: false, reason: 'invalidGrant' });
  });

  it('其他錯誤狀態、回應格式不對或網路失敗都分類成 upstream，且日誌不含 token', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const unauthorized = googleReturns(401, { error: 'invalid_client' });
    expect(await refreshAccessToken(unauthorized.fetchFn, CONFIG, 'secret-rt')).toEqual({ ok: false, reason: 'upstream' });

    const malformed = googleReturns(200, { expires_in: 3600 });
    expect(await refreshAccessToken(malformed.fetchFn, CONFIG, 'secret-rt')).toEqual({ ok: false, reason: 'upstream' });

    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await refreshAccessToken(offline, CONFIG, 'secret-rt')).toEqual({ ok: false, reason: 'upstream' });

    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-rt');
  });
});
