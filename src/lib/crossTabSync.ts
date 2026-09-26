import type { StoreApi, UseBoundStore } from 'zustand';

type PersistedStore<T> = UseBoundStore<StoreApi<T>> & {
  persist: {
    rehydrate: () => Promise<void> | void;
    getOptions: () => { version?: number };
  };
};

/**
 * 取出 storage 事件新值裡的 schema 版本號;值被刪除(null)、格式錯誤或沒有版本號時回傳 undefined。
 * @param newValue StorageEvent.newValue
 */
function readVersion(newValue: string | null): number | undefined {
  if (newValue === null) return undefined;
  try {
    const version: unknown = (JSON.parse(newValue) as { version?: unknown }).version;
    return typeof version === 'number' ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 幫指定的 persist store 訂閱其他分頁對同一個 localStorage key 的變動,一有變動就重新從 localStorage 讀回最新內容。
 * 沒有這個機制的話,分頁 A 修改的資料不會反映到分頁 B 的記憶體,分頁 B 之後任何一次寫入都會用自己記憶體裡的舊陣列
 * 整個覆蓋回 localStorage,悄悄把分頁 A 的變動復原掉(例如分頁 A 刪掉/搬移一個角色,分頁 B 完全不知情)。
 * `storage` 事件只會在「其他」分頁觸發,做出變動的那個分頁不會收到自己的事件,不會造成回圈。
 *
 * 其他分頁寫入的 schema 版本比這個分頁新時(新版部署後,舊分頁還開著),不重新讀取,直接重新整理載入新版程式:
 * zustand 只要版本不同就會 migrate 並用自己的版本號寫回,舊分頁會把新格式資料標成舊版本,
 * 與新分頁互相觸發無限來回,不冪等的遷移還會因此重複執行而毀損資料;
 * 舊分頁記憶體裡的舊資料之後被寫回,也會蓋掉新分頁的變更。
 *
 * `target` 預設是 `window`,測試時可以換成獨立的假 EventTarget,模擬兩個分頁各自獨立的 window。
 * `reload` 預設重新整理頁面,測試時可以換成 mock。
 * 回傳的函式可以取消訂閱,測試結束時用來清掉掛在 target 上的 listener,避免測試間互相干擾。
 */
export function syncAcrossTabs<T>(
  store: PersistedStore<T>,
  storageKey: string,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window,
  reload: () => void = () => window.location.reload(),
): () => void {
  const handler = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.storageArea !== localStorage || storageEvent.key !== storageKey) return;

    const incomingVersion = readVersion(storageEvent.newValue);
    const ownVersion = store.persist.getOptions().version ?? 0;
    if (incomingVersion !== undefined && incomingVersion > ownVersion) {
      reload();
      return;
    }
    void store.persist.rehydrate();
  };

  target.addEventListener('storage', handler);
  return () => target.removeEventListener('storage', handler);
}
