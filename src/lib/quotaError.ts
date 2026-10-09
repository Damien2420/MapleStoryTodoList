/**
 * 判斷是否為 localStorage 容量不足的錯誤：標準名稱、舊版 Firefox 的名稱與錯誤碼（22、1014）都算。
 * @param error 捕捉到的錯誤
 * @returns 是容量不足時回傳 true
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014;
}
