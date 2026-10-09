import { useEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 給 <Navigate> 轉址帶的 state 標記(例如 `<Navigate to="/character" replace state={REDIRECT_NAV_STATE} />`)。
 * 轉址會產生新的 location key,但不是使用者換頁;useRouteChangeEffects 看到這個標記就略過,
 * 否則初次載入 `/` 時焦點會被搶到 <main>。
 */
export const REDIRECT_NAV_STATE = { isRedirect: true } as const;

/**
 * 換頁後的兩個收尾動作,只放在共用 layout 呼叫一次:
 * 1. 捲動回頂端;瀏覽器返回/前進(POP)不重設,讓從角色頁返回時瀏覽器能還原原本的捲動位置。
 * 2. 焦點補救;觸發換頁的按鈕被卸載(返回、匯入完成、備份狀態列按鈕)時焦點會掉回 body,
 *    鍵盤與螢幕閱讀器使用者會從頁首重新開始。只有焦點掉回 body 才補,已有元素持有焦點
 *    (例如 FirstCharacterOnboarding 的 autoFocus 輸入框)就不動它。
 * 初次載入與 <Navigate> 轉址(帶 REDIRECT_NAV_STATE)不處理:不搶焦點,也不需要捲動。
 * @param mainRef 共用 layout 的 <main tabIndex={-1}> 節點,焦點補救的目標
 */
export function useRouteChangeEffects(mainRef: RefObject<HTMLElement | null>) {
  const { key, state } = useLocation();
  const navigationType = useNavigationType();
  // 用「上一次的 location key」判斷是否真的換頁,StrictMode 在開發環境重跑 effect 時 key 沒變,不會誤觸發
  const lastKeyRef = useRef(key);

  useEffect(() => {
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    if ((state as typeof REDIRECT_NAV_STATE | null)?.isRedirect) return;

    if (navigationType !== 'POP') window.scrollTo(0, 0);

    const active = document.activeElement;
    if (!active || active === document.body) mainRef.current?.focus({ preventScroll: true });
  }, [key, state, navigationType, mainRef]);
}
