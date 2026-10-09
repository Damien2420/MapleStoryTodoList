import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BossDifficulty, CharacterBossTrackList, Settings, VipTicketLevel } from '@/types';
import { needsMonthlyReset, needsReset } from '@/lib/reset';
import {
  findBossCatalogEntry,
  findDifficultyOption,
  getEditableDifficulties,
  getMaxPartySize,
  sortTrackedBossesByCatalogOrder,
  type BossSelection,
} from '@/lib/bossCatalog';
import { findVipMapping, getVipTicketLevelResetCycle } from '@/lib/vipBossCatalog';
import { trackLocalChange } from '@/lib/trackLocalChange';
import { syncAcrossTabs } from '@/lib/crossTabSync';
import {
  type BossBeforePartySize,
  type BossWithPartySize,
  migrateBossAddPartySize,
  migrateBossRemoveOrder,
} from '@/lib/schemaMigrations';
import { recordTombstone, type Tombstone } from '@/lib/tombstone';
import { nextTimestamp } from '@/lib/timestamp';

/** 使用者在新增BOSS對話框中勾選的單筆VIP重置券選取項目 */
export interface VipBossSelection {
  ticketLevel: VipTicketLevel;
  bossCatalogId: string;
  difficulty: BossDifficulty;
}

interface BossState {
  bosses: CharacterBossTrackList[];
  deletedIds: Tombstone[];
  addBosses: (characterId: string, selections: BossSelection[]) => void;
  addVipBosses: (characterId: string, selections: VipBossSelection[]) => void;
  toggleBoss: (id: string) => void;
  /** 將指定 id 清單內的 BOSS 一次設為同一個勾選狀態(用於「全部完成」按鈕) */
  toggleBossesByIds: (ids: string[], checked: boolean) => void;
  removeBoss: (id: string) => void;
  /** 一次刪除多筆BOSS追蹤紀錄(用於VIP等級變更時清掉未保留的BOSS) */
  removeBossesByIds: (ids: string[]) => void;
  /** 設定指定 BOSS 追蹤紀錄的攻略人數,自動夾在 1 ~ 該難度的 maxPartySize 之間 */
  setBossPartySize: (id: string, partySize: number) => void;
  /** 將已追蹤 BOSS 換成同週期(VIP 為同券)的另一個難度,收益與人數上限隨新難度調整,勾選狀態保留 */
  changeBossDifficulty: (id: string, difficulty: BossDifficulty) => void;
  /** 還原被刪除的 BOSS(用於刪除後的 toast 還原按鈕);以新 id 加回,舊 id 的墓碑保留 */
  restoreBoss: (boss: CharacterBossTrackList) => void;
  removeBossesForCharacter: (characterId: string) => void;
  runResetCheck: (settings: Settings) => void;
}

export const useBossStore = create<BossState>()(
  persist(
    (set) => ({
      bosses: [],
      deletedIds: [],
      addBosses: (characterId, selections) => {
        if (selections.length === 0) return;
        const now = new Date().toISOString();
        set((state) => {
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
              partySize: 1,
              checked: false,
              lastResetAt: now,
              updatedAt: now,
            });
          }
          const otherCharacters = state.bosses.filter((b) => b.characterId !== characterId);
          const ownExisting = state.bosses.filter((b) => b.characterId === characterId);
          // 每次加入都把「這個角色現有的 + 新增的」BOSS 依目錄順序重新排一次,不管分幾次加入都會得到同一個順序
          const merged = sortTrackedBossesByCatalogOrder([...ownExisting, ...newBosses]);
          return { bosses: [...otherCharacters, ...merged] };
        });
      },
      addVipBosses: (characterId, selections) => {
        if (selections.length === 0) return;
        const now = new Date().toISOString();
        set((state) => {
          const newBosses: CharacterBossTrackList[] = [];
          for (const selection of selections) {
            if (!findVipMapping(selection.ticketLevel, selection.bossCatalogId, selection.difficulty)) continue;
            const entry = findBossCatalogEntry(selection.bossCatalogId);
            if (!entry) continue;
            const option = findDifficultyOption(entry, selection.difficulty);
            if (!option) continue;
            newBosses.push({
              id: crypto.randomUUID(),
              characterId,
              bossName: entry.name,
              difficulty: selection.difficulty,
              resetCycle: getVipTicketLevelResetCycle(selection.ticketLevel),
              category: 'vip',
              bossCatalogId: entry.id,
              vipTicketLevel: selection.ticketLevel,
              crystalValue: option.crystalValue,
              partySize: 1,
              checked: false,
              lastResetAt: now,
              updatedAt: now,
            });
          }
          const otherCharacters = state.bosses.filter((b) => b.characterId !== characterId);
          const ownExisting = state.bosses.filter((b) => b.characterId === characterId);
          const merged = sortTrackedBossesByCatalogOrder([...ownExisting, ...newBosses]);
          return { bosses: [...otherCharacters, ...merged] };
        });
      },
      toggleBoss: (id) => {
        set((state) => ({
          bosses: state.bosses.map((b) =>
            b.id === id
              ? {
                  ...b,
                  checked: !b.checked,
                  lastResetAt: !b.checked ? new Date().toISOString() : b.lastResetAt,
                  updatedAt: nextTimestamp(b.updatedAt),
                }
              : b,
          ),
        }));
      },
      toggleBossesByIds: (ids, checked) => {
        const idSet = new Set(ids);
        const nowDate = new Date();
        const now = nowDate.toISOString();
        set((state) => ({
          // 已經是目標狀態的 BOSS 不動,不然會被當成新的修改而在同步時蓋掉其他裝置的變更
          bosses: state.bosses.map((b) =>
            idSet.has(b.id) && b.checked !== checked
              ? { ...b, checked, lastResetAt: checked ? now : b.lastResetAt, updatedAt: nextTimestamp(b.updatedAt, nowDate) }
              : b,
          ),
        }));
      },
      removeBoss: (id) => {
        set((state) => ({
          bosses: state.bosses.filter((b) => b.id !== id),
          deletedIds: recordTombstone(state.deletedIds, id),
        }));
      },
      removeBossesByIds: (ids) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        // 與 removeBoss 相同要寫墓碑,否則 VIP 降級時刪掉的 BOSS 會在下次合併 Drive 備份時被加回來
        set((state) => ({
          bosses: state.bosses.filter((b) => !idSet.has(b.id)),
          deletedIds: state.bosses
            .filter((b) => idSet.has(b.id))
            .reduce((acc, b) => recordTombstone(acc, b.id), state.deletedIds),
        }));
      },
      setBossPartySize: (id, partySize) => {
        set((state) => ({
          bosses: state.bosses.map((b) => {
            if (b.id !== id) return b;
            const max = getMaxPartySize(b);
            const clamped = Math.min(Math.max(Math.round(partySize), 1), max);
            if (clamped === b.partySize) return b;
            return { ...b, partySize: clamped, updatedAt: nextTimestamp(b.updatedAt) };
          }),
        }));
      },
      changeBossDifficulty: (id, difficulty) => {
        set((state) => {
          const target = state.bosses.find((b) => b.id === id);
          if (!target?.bossCatalogId || target.difficulty === difficulty) return state;
          if (!getEditableDifficulties(target).includes(difficulty)) return state;
          const entry = findBossCatalogEntry(target.bossCatalogId);
          const option = entry && findDifficultyOption(entry, difficulty);
          if (!option) return state;
          const updated: CharacterBossTrackList = {
            ...target,
            difficulty,
            crystalValue: option.crystalValue,
            // VIP 的重置星期由券決定,不隨難度變動
            weeklyResetDay: target.category === 'vip' ? target.weeklyResetDay : option.weeklyResetDay,
            partySize: Math.min(target.partySize, option.maxPartySize),
            updatedAt: nextTimestamp(target.updatedAt),
          };
          const otherCharacters = state.bosses.filter((b) => b.characterId !== target.characterId);
          const own = state.bosses
            .filter((b) => b.characterId === target.characterId)
            .map((b) => (b.id === id ? updated : b));
          return { bosses: [...otherCharacters, ...sortTrackedBossesByCatalogOrder(own)] };
        });
      },
      restoreBoss: (boss) => {
        // 刪除可能已經同步到其他裝置，而合併規則是刪除優先：沿用舊 id 會被其他裝置的墓碑再刪一次。
        // 因此改用新 id 加回來，舊 id 的墓碑保留，restoredFrom 記下最原始的 id（與還原備份的做法相同）
        set((state) =>
          state.bosses.some((b) => b.id === boss.id)
            ? state
            : {
                bosses: [
                  ...state.bosses,
                  { ...boss, id: crypto.randomUUID(), restoredFrom: boss.restoredFrom ?? boss.id, updatedAt: nextTimestamp(boss.updatedAt) },
                ],
              },
        );
      },
      removeBossesForCharacter: (characterId) => {
        set((state) => {
          const removed = state.bosses.filter((b) => b.characterId === characterId);
          return {
            bosses: state.bosses.filter((b) => b.characterId !== characterId),
            deletedIds: removed.reduce((acc, b) => recordTombstone(acc, b.id), state.deletedIds),
          };
        });
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

            if (needsReset(boss, settings, now)) {
              changed = true;
              return { ...boss, checked: false, lastResetAt: now.toISOString() };
            }
            return boss;
          });
          return changed ? { bosses } : state;
        });
      },
    }),
    {
      name: 'maplestory-todolist-bosses',
      // schema 版本:改動 CharacterBossTrackList 持久化結構(改名/刪除/改語意)時 version +1 並補 migrate,
      // 且需同步檢查 backupPayload.ts 的 CURRENT_VERSION/MIGRATIONS 是否也要升版
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Omit<BossState, 'bosses' | 'deletedIds'> & {
          bosses: unknown[];
          deletedIds?: Tombstone[];
        };
        let bosses = state.bosses;
        if (version === 0) {
          bosses = (bosses as BossBeforePartySize[]).map(migrateBossAddPartySize);
        }
        if (version <= 2) {
          bosses = (bosses as BossWithPartySize[]).map(migrateBossRemoveOrder);
        }
        return {
          ...state,
          deletedIds: version <= 1 ? [] : (state.deletedIds ?? []),
          bosses: bosses as CharacterBossTrackList[],
        };
      },
    },
  ),
);

trackLocalChange(useBossStore, (s) => s.bosses);
syncAcrossTabs(useBossStore, 'maplestory-todolist-bosses');
