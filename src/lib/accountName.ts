import { UNASSIGNED_GROUP_NAME } from '@/lib/characterBoard';
import { ACCOUNT_NAME_MAX_LENGTH, type Account } from '@/types';

/**
 * 驗證帳號名稱,新增帳號與重新命名共用同一套規則:長度上限、不能用「未歸類」保留名稱、不能和其他帳號同名。
 * 空白不視為錯誤(回傳 null),由呼叫端自行決定要擋送出或還原;看板用名稱當標題分組,所以同名一律擋下。
 * @param name 使用者輸入的原始名稱(長度以未 trim 的原始輸入計算)
 * @param accounts 目前所有帳號
 * @param excludeId 重新命名時傳入自己的 id,避免跟自己比對同名
 * @returns 錯誤訊息;通過(或空白)回傳 null
 */
export function validateAccountName(name: string, accounts: Account[], excludeId?: string): string | null {
  const trimmed = name.trim();
  if (name.length > ACCOUNT_NAME_MAX_LENGTH) return `帳號名稱最多 ${ACCOUNT_NAME_MAX_LENGTH} 字`;
  if (trimmed === UNASSIGNED_GROUP_NAME) return `「${UNASSIGNED_GROUP_NAME}」是系統保留名稱,請換一個`;
  if (accounts.some((a) => a.id !== excludeId && a.name === trimmed)) return '已經有相同名稱的帳號';
  return null;
}
