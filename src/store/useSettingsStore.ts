import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';

interface SettingsState {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
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
    }),
    { name: 'maplestory-todolist-settings' },
  ),
);