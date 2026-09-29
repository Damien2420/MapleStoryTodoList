import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';
import { syncAcrossTabs } from '@/lib/crossTabSync';

interface SettingsState {
  /** 重置時間設定,寫死在程式碼裡,不提供使用者調整,也不持久化 */
  settings: Settings;
  /** 上次「備份現在」成功、或「從 Drive 還原」成功時的時間點(ISO string),僅供本機 UX 提示用,不進備份內容 */
  lastBackupAt?: string;
  /** 角色/任務/BOSS 資料最後一次變動的時間(ISO string),僅供本機 UX 提示用,不進備份內容 */
  lastLocalChangeAt?: string;
  setLastBackupAt: (iso: string) => void;
  setLastLocalChangeAt: (iso: string) => void;
}

const defaultSettings: Settings = {
  dailyResetTime: '00:00',
  weeklyResetDay: 3,
  weeklyResetTime: '00:00',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      setLastBackupAt: (iso) => set({ lastBackupAt: iso }),
      setLastLocalChangeAt: (iso) => set({ lastLocalChangeAt: iso }),
    }),
    {
      name: 'maplestory-todolist-settings',
      partialize: (state) => ({ lastBackupAt: state.lastBackupAt, lastLocalChangeAt: state.lastLocalChangeAt }),
      // 兩個時間戳一律以 localStorage 為準:值為 undefined 的欄位存成 JSON 時會整個消失,
      // 預設的 merge({ ...記憶體, ...讀到的 })會把「消失」當成「沒改」而保留記憶體中的舊值,
      // 導致其他分頁「刪除全部」或「清空 Drive 備份」清掉的時間戳傳不過來。settings 不持久化,沿用記憶體中的值
      merge: (persisted, current) => {
        const state = persisted as Partial<Pick<SettingsState, 'lastBackupAt' | 'lastLocalChangeAt'>> | undefined;
        return { ...current, lastBackupAt: state?.lastBackupAt, lastLocalChangeAt: state?.lastLocalChangeAt };
      },
      // schema 版本:此 store 只持久化 lastBackupAt/lastLocalChangeAt 時間戳,不進備份檔,
      // 若未來新增其他持久化欄位並有破壞性變更時 version +1 並補 migrate(不需同步 backupPayload.ts)
      version: 0,
    },
  ),
);

// 其他分頁同步或刪除全部後,這個分頁的備份狀態要跟著更新,否則畫面顯示錯誤,之後的寫入還會把舊時間戳蓋回去
syncAcrossTabs(useSettingsStore, 'maplestory-todolist-settings');
