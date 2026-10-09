import { decrypt, encrypt, parseKeyRing, type EncryptionKey } from './tokenCrypto.js';
import { DRIVE_APPDATA_SCOPE, exchangeCode, refreshAccessToken, type GoogleClientConfig } from './googleToken.js';
import { REFRESH_COOKIE_NAME, clearRefreshCookie, readCookie, serializeRefreshCookie } from './authCookie.js';

/** 加密時的附加驗證資料：綁定 cookie 名稱，密文搬到其他用途會解密失敗 */
const COOKIE_AAD = REFRESH_COOKIE_NAME;

/** 端點回給前端的錯誤代碼，前端依此判斷要顯示什麼、要不要清除登入狀態 */
export type AuthErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'INVALID_CODE'
  | 'MISSING_DRIVE_SCOPE'
  | 'NO_REFRESH_TOKEN'
  | 'NOT_SIGNED_IN'
  | 'RECONNECT_REQUIRED'
  | 'UPSTREAM_ERROR'
  | 'SERVER_ERROR';

/** 與框架無關的請求內容；header 名稱一律小寫（與 Node 的 IncomingHttpHeaders 相同） */
export interface AuthRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** 成功時回傳 access token 與剩餘秒數；失敗時回傳錯誤代碼與可直接顯示的中文訊息 */
export type AuthResponseBody = { accessToken: string; expiresIn: number } | { error: AuthErrorCode; message: string };

/** 與框架無關的回應內容；setCookie 有值時由轉接層寫進 Set-Cookie header */
export interface AuthResponse {
  status: number;
  body?: AuthResponseBody;
  setCookie?: string;
}

/** 從環境變數讀到的原始設定，任何一項都可能沒設定 */
export interface AuthEnv {
  clientId?: string;
  clientSecret?: string;
  encryptionKeys?: string;
}

/** 處理函式的外部依賴；測試時注入假的 fetch 與設定 */
export interface AuthDeps {
  fetch: typeof fetch;
  env: AuthEnv;
}

interface AuthConfig {
  google: GoogleClientConfig;
  keys: EncryptionKey[];
}

function fail(status: number, error: AuthErrorCode, message: string, setCookie?: string): AuthResponse {
  return { status, body: { error, message }, setCookie };
}

function serverError(): AuthResponse {
  return fail(500, 'SERVER_ERROR', '登入服務暫時無法使用，請稍後再試');
}

function upstreamError(): AuthResponse {
  return fail(502, 'UPSTREAM_ERROR', '無法連線至 Google，請稍後再試');
}

function header(req: AuthRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 三支端點共用的請求檢查：只接受 POST、要求 X-Requested-With、Origin 的 host 必須與 Host 相同。
 * 跨站表單或圖片請求無法帶自訂 header，跨站 fetch 會帶上不同的 Origin，兩者都會被擋下。
 * @returns 不通過時的錯誤回應；通過時回傳 null
 */
function rejectRequest(req: AuthRequest): AuthResponse | null {
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', '不支援的請求方法');
  if (header(req, 'x-requested-with') !== 'XMLHttpRequest') return fail(403, 'FORBIDDEN', '請求來源不被允許');
  const origin = header(req, 'origin');
  const host = header(req, 'host');
  if (!origin || !host) return fail(403, 'FORBIDDEN', '請求來源不被允許');
  try {
    if (new URL(origin).host !== host) return fail(403, 'FORBIDDEN', '請求來源不被允許');
  } catch {
    return fail(403, 'FORBIDDEN', '請求來源不被允許');
  }
  return null;
}

/** 檢查並整理設定；有問題時記錄是哪一項（不記錄值）並回傳 null */
function loadConfig(env: AuthEnv): AuthConfig | null {
  if (!env.clientId || !env.clientSecret) {
    console.error('[auth] VITE_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured');
    return null;
  }
  try {
    return { google: { clientId: env.clientId, clientSecret: env.clientSecret }, keys: parseKeyRing(env.encryptionKeys) };
  } catch (err) {
    console.error('[auth] invalid TOKEN_ENC_KEY:', err instanceof Error ? err.message : 'unknown error');
    return null;
  }
}

/**
 * POST /api/auth/exchange：用 GIS popup 取得的授權碼換 token。
 * 成功時回傳 access token，並把 refresh token 加密寫進 HttpOnly cookie；
 * 使用者沒同意 Drive 權限、或 Google 沒給 refresh token 時都不寫 cookie。
 * @param req 請求內容，body 需為 `{ code: string }`
 * @param deps 注入的 fetch 與環境設定
 * @returns 要回給前端的狀態碼、內容與 Set-Cookie
 */
export async function handleExchange(req: AuthRequest, deps: AuthDeps): Promise<AuthResponse> {
  const rejected = rejectRequest(req);
  if (rejected) return rejected;
  const config = loadConfig(deps.env);
  if (!config) return serverError();

  const code = (req.body as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== 'string' || !code) return fail(400, 'INVALID_REQUEST', '缺少授權碼，請重新登入');

  const result = await exchangeCode(deps.fetch, config.google, code);
  if (!result.ok) {
    return result.reason === 'invalidGrant' ? fail(400, 'INVALID_CODE', '授權碼已失效，請重新登入') : upstreamError();
  }
  if (!result.scope.split(' ').includes(DRIVE_APPDATA_SCOPE)) {
    return fail(403, 'MISSING_DRIVE_SCOPE', '尚未取得 Google Drive 存取權限，請重新登入並在同意畫面中勾選 Google Drive');
  }
  if (!result.refreshToken) {
    console.error('[auth] exchange: Google did not return a refresh token');
    return fail(502, 'NO_REFRESH_TOKEN', 'Google 沒有提供長期登入授權，請再試一次');
  }
  return {
    status: 200,
    body: { accessToken: result.accessToken, expiresIn: result.expiresIn },
    setCookie: serializeRefreshCookie(encrypt(result.refreshToken, config.keys, COOKIE_AAD)),
  };
}

/**
 * POST /api/auth/token：用 cookie 裡的 refresh token 換新的 access token。
 * cookie 無效時清除並回 NOT_SIGNED_IN；Google 端授權失效時清除並回 RECONNECT_REQUIRED；
 * 成功時一律重新寫入 cookie（延長有效期、改用目前的加密金鑰、保存 Google 換發的新 refresh token）。
 * @param req 請求內容，cookie 由瀏覽器自動帶上
 * @param deps 注入的 fetch 與環境設定
 * @returns 要回給前端的狀態碼、內容與 Set-Cookie
 */
export async function handleToken(req: AuthRequest, deps: AuthDeps): Promise<AuthResponse> {
  const rejected = rejectRequest(req);
  if (rejected) return rejected;
  const config = loadConfig(deps.env);
  if (!config) return serverError();

  const stored = readCookie(header(req, 'cookie'), REFRESH_COOKIE_NAME);
  if (!stored) return fail(401, 'NOT_SIGNED_IN', '尚未登入 Google');
  const decrypted = decrypt(stored, config.keys, COOKIE_AAD);
  if (!decrypted) return fail(401, 'NOT_SIGNED_IN', '尚未登入 Google', clearRefreshCookie());

  const result = await refreshAccessToken(deps.fetch, config.google, decrypted.plaintext);
  if (!result.ok) {
    return result.reason === 'invalidGrant'
      ? fail(401, 'RECONNECT_REQUIRED', 'Google 授權已失效，請重新連線', clearRefreshCookie())
      : upstreamError();
  }
  return {
    status: 200,
    body: { accessToken: result.accessToken, expiresIn: result.expiresIn },
    setCookie: serializeRefreshCookie(encrypt(result.refreshToken ?? decrypted.plaintext, config.keys, COOKIE_AAD)),
  };
}

/**
 * POST /api/auth/logout：清除 cookie。不撤銷 Google 授權，同帳號的其他裝置不受影響。
 * @param req 請求內容
 * @returns 204 與清除 cookie 的 Set-Cookie
 */
export function handleLogout(req: AuthRequest): AuthResponse {
  const rejected = rejectRequest(req);
  if (rejected) return rejected;
  return { status: 204, setCookie: clearRefreshCookie() };
}
