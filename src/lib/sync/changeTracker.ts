import type { StoreApi, UseBoundStore } from 'zustand';
import { useAccountStore } from '@/store/useAccountStore';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeaponStore } from '@/store/useWeaponStore';
import { isApplyingSyncWrite } from '@/lib/sync/localRepo';

type PersistedStore<T> = UseBoundStore<StoreApi<T>> & {
  persist: { hasHydrated: () => boolean };
};

function watch<T, S>(store: PersistedStore<T>, selector: (state: T) => S, onChange: () => void): () => void {
  return store.subscribe((state, previous) => {
    // 從 localStorage 重新讀取期間（其他分頁改了資料）不算這個分頁的修改，那個分頁已經自己計數過；
    // 同步引擎寫回的合併結果也不算，否則每次拉取都會變成「有修改待同步」而觸發多餘的上傳
    if (!store.persist.hasHydrated() || isApplyingSyncWrite()) return;
    if (selector(state) !== selector(previous)) onChange();
  });
}

/**
 * 追蹤使用者對帳號、角色、任務、BOSS 與武器資料的修改。只比對資料陣列本身的參照，選取中的角色、墓碑清單等不算。
 * @param onChange 每次偵測到修改時呼叫（同一個操作改到多個 store 時會呼叫多次）
 * @returns 停止追蹤的函式
 */
export function trackDataChanges(onChange: () => void): () => void {
  const stops = [
    watch(useCharacterStore, (s) => s.characters, onChange),
    watch(useTaskStore, (s) => s.tasks, onChange),
    watch(useBossStore, (s) => s.bosses, onChange),
    watch(useAccountStore, (s) => s.accounts, onChange),
    watch(useWeaponStore, (s) => s.profiles, onChange),
    watch(useWeaponStore, (s) => s.bossClears, onChange),
    watch(useWeaponStore, (s) => s.dailyClears, onChange),
    watch(useWeaponStore, (s) => s.events, onChange),
    watch(useWeaponStore, (s) => s.checkpoints, onChange),
  ];
  return () => {
    for (const stopWatching of stops) stopWatching();
  };
}
