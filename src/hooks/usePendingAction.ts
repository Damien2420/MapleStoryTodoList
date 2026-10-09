import { useCallback, useState } from 'react';

/**
 * 追蹤使用者按下的非同步動作是否還在進行，讓按鈕顯示「處理中」。
 * 只反映這顆按鈕觸發的動作；其他原因的 busy（例如背景同步）由呼叫端另外拿來停用按鈕。
 * @returns pending：動作進行中；run：執行動作，Promise 結束（成功或失敗）時解除 pending
 */
export function usePendingAction(): { pending: boolean; run: (action: () => Promise<unknown>) => void } {
  const [pending, setPending] = useState(false);
  const run = useCallback((action: () => Promise<unknown>) => {
    setPending(true);
    void action().finally(() => setPending(false));
  }, []);
  return { pending, run };
}
