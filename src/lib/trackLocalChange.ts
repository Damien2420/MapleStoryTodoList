import type { StoreApi, UseBoundStore } from 'zustand';
import { useSettingsStore } from '@/store/useSettingsStore';

type PersistedStore<T> = UseBoundStore<StoreApi<T>> & {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

/**
 * 幫指定的 persist store 掛上「備份內容變動即更新 lastLocalChangeAt」的監聽。
 * 只比對 selector 選出的那個欄位(例如 characters/tasks/bosses 陣列本身)是否變動,
 * 避免同一個 store 裡跟備份無關的欄位(例如 activeCharacterId 純 UI 選取狀態)變動也被誤判成資料異動。
 * 必須等該 store 的 persist middleware 完成 hydration 後才開始監聽,
 * 避免把「app 啟動時把 localStorage 舊資料寫回 store」誤判成使用者的新變更。
 */
export function trackLocalChange<T, S>(store: PersistedStore<T>, selector: (state: T) => S): void {
  const startWatching = () => {
    store.subscribe((state, prevState) => {
      if (selector(state) !== selector(prevState)) {
        useSettingsStore.getState().setLastLocalChangeAt(new Date().toISOString());
      }
    });
  };

  if (store.persist.hasHydrated()) {
    startWatching();
  } else {
    store.persist.onFinishHydration(startWatching);
  }
}
