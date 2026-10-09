const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
/** GIS code client 的 popup 模式固定使用這個特殊的 redirect_uri */
const POPUP_REDIRECT_URI = 'postmessage';

/** 這個 App 唯一需要的 Drive 權限：讀寫 App 專屬的隱藏資料夾 */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Google OAuth 用戶端設定 */
export interface GoogleClientConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * 呼叫 Google token 端點的結果。
 * invalidGrant 表示授權碼或 refresh token 已失效（使用者撤銷授權、半年沒用、授權碼重複使用）；
 * upstream 表示其他所有錯誤（網路、Google 暫時錯誤、設定錯誤、回應格式不對）。
 */
export type GoogleTokenResult =
  | { ok: true; accessToken: string; expiresIn: number; refreshToken?: string; scope: string }
  | { ok: false; reason: 'invalidGrant' | 'upstream' };

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
}

/** 送出 token 請求並分類結果；日誌只記狀態碼與 Google 的錯誤代碼，不記任何 token */
async function requestToken(fetchFn: typeof fetch, params: Record<string, string>, context: string): Promise<GoogleTokenResult> {
  let res: Response;
  try {
    res = await fetchFn(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (err) {
    console.error(`[auth] ${context}: request to Google failed`, err instanceof Error ? err.message : 'unknown error');
    return { ok: false, reason: 'upstream' };
  }

  const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!res.ok) {
    if (res.status === 400 && data.error === 'invalid_grant') return { ok: false, reason: 'invalidGrant' };
    console.error(`[auth] ${context}: Google responded ${res.status} (${data.error ?? 'no error code'})`);
    return { ok: false, reason: 'upstream' };
  }
  if (!data.access_token || typeof data.expires_in !== 'number') {
    console.error(`[auth] ${context}: unexpected token response shape`);
    return { ok: false, reason: 'upstream' };
  }
  return {
    ok: true,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    scope: data.scope ?? '',
  };
}

/**
 * 用 GIS popup 取得的授權碼換 access token 與 refresh token。
 * @param fetchFn 注入的 fetch，測試時替換
 * @param config OAuth 用戶端設定
 * @param code 前端傳來的一次性授權碼
 * @returns 換得的 token 與使用者實際同意的 scope，或錯誤分類
 */
export function exchangeCode(fetchFn: typeof fetch, config: GoogleClientConfig, code: string): Promise<GoogleTokenResult> {
  return requestToken(
    fetchFn,
    {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: POPUP_REDIRECT_URI,
      grant_type: 'authorization_code',
    },
    'exchange',
  );
}

/**
 * 用 refresh token 換新的 access token。
 * @param fetchFn 注入的 fetch，測試時替換
 * @param config OAuth 用戶端設定
 * @param refreshToken 從 cookie 解密出來的 refresh token
 * @returns 新的 access token（Google 偶爾會一併換發新的 refresh token），或錯誤分類
 */
export function refreshAccessToken(
  fetchFn: typeof fetch,
  config: GoogleClientConfig,
  refreshToken: string,
): Promise<GoogleTokenResult> {
  return requestToken(
    fetchFn,
    {
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    },
    'refresh',
  );
}
