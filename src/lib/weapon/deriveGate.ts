let suspended = false;

/** 目前是否暫停訂閱觸發的武器衍生計算 */
export function isDeriveSuspended(): boolean {
  return suspended;
}

/**
 * 執行 run 期間暫停訂閱觸發的武器衍生計算（同步寫回資料時使用）：
 * 依序寫入多個 store 時，訂閱會用寫到一半的資料算出錯誤的中間結果，由呼叫端寫完後再統一衍生一次。
 * 旗標獨立成一個模組，避免 localRepo 與 syncClears 互相 import。
 * @param run 要在暫停期間執行的函式
 * @returns run 的回傳值
 */
export function withDeriveSuspended<T>(run: () => T): T {
  const previous = suspended;
  suspended = true;
  try {
    return run();
  } finally {
    suspended = previous;
  }
}
