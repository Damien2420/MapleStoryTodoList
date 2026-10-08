let handler: (() => void) | undefined;

/**
 * 註冊刪除角色或帳號之前要執行的動作；正式環境是建立還原點（browserSyncController 註冊）。
 * 用模組層級的掛勾而不是直接 import 控制器，讓刪除相關的 hook 與元件測試不必載入整個同步模組。
 * @param next 要執行的動作；傳 undefined 取消註冊
 */
export function setBeforeMajorDelete(next: (() => void) | undefined): void {
  handler = next;
}

/**
 * 刪除角色或帳號之前呼叫。必須在刪除之前同步呼叫，還原點才會讀到刪除前的資料。
 */
export function beforeMajorDelete(): void {
  handler?.();
}
