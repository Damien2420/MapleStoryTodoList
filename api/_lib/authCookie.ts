/** 存放加密 refresh token 的 cookie；__Host- 前綴要求 Secure、Path=/ 且不能指定 Domain，避免被子網域覆寫 */
export const REFRESH_COOKIE_NAME = '__Host-mstd-rt';

/** Google 的 refresh token 超過六個月沒用會失效，cookie 有效期與它對齊；每次換 token 都會重新寫入而延長 */
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict';

/**
 * 產生寫入 refresh token cookie 的 Set-Cookie 字串。
 * @param value 加密後的 refresh token（只含 cookie 允許的字元）
 */
export function serializeRefreshCookie(value: string): string {
  return `${REFRESH_COOKIE_NAME}=${value}; ${ATTRIBUTES}; Max-Age=${MAX_AGE_SECONDS}`;
}

/** 產生清除 refresh token cookie 的 Set-Cookie 字串 */
export function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE_NAME}=; ${ATTRIBUTES}; Max-Age=0`;
}

/**
 * 從 Cookie header 讀出指定名稱的值。
 * @param header 請求的 Cookie header
 * @param name cookie 名稱
 * @returns cookie 的值；沒有這個 cookie 時回傳 undefined
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}
