import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';

interface SettingsState {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  /** 上次「備份現在」成功、或「從 Drive 還原」成功時的時間點(ISO string),僅供本機 UX 提示用,不進備份內容 */
  lastBackupAt?: string;
  /** 角色/任務/BOSS 資料最後一次變動的時間(ISO string),僅供本機 UX 提示用,不進備份內容 */
  lastLocalChangeAt?: string;
  setLastBackupAt: (iso: string) => void;
  setLastLocalChangeAt: (iso: string) => void;
}

const defaultSettings: Settings = {
  dailyResetTime: '00:00',
  weeklyResetDay: 1,
  weeklyResetTime: '00:00',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
      setLastBackupAt: (iso) => set({ lastBackupAt: iso }),
      setLastLocalChangeAt: (iso) => set({ lastLocalChangeAt: iso }),
    }),
    { name: 'maplestory-todolist-settings' },
  ),
);
