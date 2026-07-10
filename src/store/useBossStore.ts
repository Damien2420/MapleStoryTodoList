import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';
import { needsMonthlyReset, needsReset } from '@/lib/reset';
import { findBossCatalogEntry, findDifficultyOption, type BossSelection } from '@/lib/bossCatalog';
import { trackLocalChange } from '@/lib/trackLocalChange';

interface BossState {
  bosses: CharacterBossTrackList[];
  addBosses: (characterId: string, selections: BossSelection[]) => void;
  toggleBoss: (id: string) => void;
  removeBoss: (id: string) => void;
  /** 還原被刪除的 BOSS(用於刪除後的 toast 還原按鈕) */
  restoreBoss: (boss: CharacterBossTrackList) => void;
  removeBossesForCharacter: (characterId: string) => void;
  runResetCheck: (settings: Settings) => void;
}

export const useBossStore = create<BossState>()(
  persist(
    (set) => ({
      bosses: [],
      addBosses: (characterId, selections) => {
        if (selections.length === 0) return;
        const now = new Date().toISOString();
        set((state) => {
          let order = state.bosses.filter((b) => b.characterId === characterId).length;
          const newBosses: CharacterBossTrackList[] = [];
          for (const selection of selections) {
            const entry = findBossCatalogEntry(selection.bossId);
            if (!entry) continue;
            const option = findDifficultyOption(entry, selection.difficulty);
            if (!option) continue;
            newBosses.push({
              id: crypto.randomUUID(),
              characterId,
              bossName: entry.name,
              difficulty: selection.difficulty,
              resetCycle: option.resetCycle,
              weeklyResetDay: option.weeklyResetDay,
              category: entry.category,
              bossCatalogId: entry.id,
              crystalValue: option.crystalValue,
              checked: false,
              lastResetAt: now,
              order: order++,
            });
          }
          return { bosses: [...state.bosses, ...newBosses] };
        });
      },
      toggleBoss: (id) => {
        set((state) => ({
          bosses: state.bosses.map((b) =>
            b.id === id
              ? { ...b, checked: !b.checked, lastResetAt: !b.checked ? new Date().toISOString() : b.lastResetAt }
              : b,
          ),
        }));
      },
      removeBoss: (id) => {
        set((state) => ({ bosses: state.bosses.filter((b) => b.id !== id) }));
      },
      restoreBoss: (boss) => {
        set((state) => (state.bosses.some((b) => b.id === boss.id) ? state : { bosses: [...state.bosses, boss] }));
      },
      removeBossesForCharacter: (characterId) => {
        set((state) => ({ bosses: state.bosses.filter((b) => b.characterId !== characterId) }));
      },
      runResetCheck: (settings) => {
        const now = new Date();
        set((state) => {
          let changed = false;
          const bosses = state.bosses.map((boss) => {
            if (boss.resetCycle === 'monthly') {
              if (needsMonthlyReset(boss.checked, boss.lastResetAt, settings, now)) {
                changed = true;
                return { ...boss, checked: false, lastResetAt: now.toISOString() };
              }
              return boss;
            }

            // needsReset 只讀取 CharacterTask 的重置相關欄位,這裡建構一個滿足型別的代理物件重用同一份判斷邏輯
            const resetProxy: CharacterTask = {
              id: boss.id,
              characterId: boss.characterId,
              name: boss.bossName,
              category: 'boss',
              resetCycle: boss.resetCycle,
              weeklyResetDay: boss.weeklyResetDay,
              checked: boss.checked,
              lastResetAt: boss.lastResetAt,
              order: boss.order,
            };
            if (needsReset(resetProxy, settings, now)) {
              changed = true;
              return { ...boss, checked: false, lastResetAt: now.toISOString() };
            }
            return boss;
          });
          return changed ? { bosses } : state;
        });
      },
    }),
    { name: 'maplestory-todolist-bosses' },
  ),
);

trackLocalChange(useBossStore, (s) => s.bosses);
