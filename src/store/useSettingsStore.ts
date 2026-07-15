import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';

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
      // settings 是寫死的常數,不持久化,避免舊版預設值卡在 localStorage 蓋掉之後改的寫死值
      partialize: (state) => ({ lastBackupAt: state.lastBackupAt, lastLocalChangeAt: state.lastLocalChangeAt }),
    },
  ),
);
