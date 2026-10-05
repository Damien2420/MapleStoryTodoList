import { useMemo } from 'react';
import { ASTRA, DESTINY } from '@/data/weaponRates.data';
import { useNow } from '@/hooks/useNow';
import { estimateWeapons, type EstimateResult } from '@/lib/weapon/estimate';
import { foldWeapons, type FoldResult } from '@/lib/weapon/fold';
import { computeThisWeek, type ThisWeekResult } from '@/lib/weapon/thisWeek';
import type { CharacterWeaponState, WeaponKind, WeaponProfile, WeaponStatus } from '@/lib/weapon/types';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeaponStore } from '@/store/useWeaponStore';
import type { Character } from '@/types';

/** 畫面上的武器狀態:多一個 locked(創世未完成或等級不足) */
export type WeaponViewStatus = WeaponStatus | 'locked';

/** useWeaponProgress 的結果 */
export interface WeaponProgress {
  state: CharacterWeaponState;
  fold: FoldResult;
  thisWeek: ThisWeekResult;
  estimate: EstimateResult;
  profile: Pick<WeaponProfile, 'genesisPass' | 'stormTraining'>;
  /** 各武器畫面上的狀態 */
  status: Record<WeaponKind, WeaponViewStatus>;
  now: Date;
}

const NO_PROFILE = { genesisPass: false, stormTraining: false };

/**
 * 角色四把武器的進度:由存檔點、紀錄與事件即時算出,並附上本週已取得與預估時間。
 * selector 只取原始陣列,計算放在 useMemo,不在 selector 內回傳新物件(避免 zustand v5 無限重繪)
 * @param character 角色
 */
export function useWeaponProgress(character: Character): WeaponProgress {
  const bossClears = useWeaponStore((s) => s.bossClears);
  const dailyClears = useWeaponStore((s) => s.dailyClears);
  const events = useWeaponStore((s) => s.events);
  const checkpoints = useWeaponStore((s) => s.checkpoints);
  const profiles = useWeaponStore((s) => s.profiles);
  const bosses = useBossStore((s) => s.bosses);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useSettingsStore((s) => s.settings);
  // 每分鐘更新一次,跨過重置時間後本週清單與預估會跟著換週
  const now = useNow();
  const minuteKey = Math.floor(now.getTime() / 60_000);

  return useMemo(() => {
    const id = character.id;
    const current = new Date(minuteKey * 60_000);
    const own = {
      bossClears: bossClears.filter((c) => c.characterId === id),
      dailyClears: dailyClears.filter((d) => d.characterId === id),
      events: events.filter((e) => e.characterId === id),
    };
    const trackedBosses = bosses.filter((b) => b.characterId === id);
    const ownTasks = tasks.filter((t) => t.characterId === id);
    const profile = profiles.find((p) => p.id === id) ?? NO_PROFILE;
    const fold = foldWeapons({ checkpoint: checkpoints.find((c) => c.id === id), ...own, settings });
    const thisWeek = computeThisWeek({ ...own, fold, trackedBosses, tasks: ownTasks, profile, settings, now: current });
    const soulDoneThisWeek = Math.max(0, ...thisWeek.weapons.soul.rows.map((r) => r.amount));
    const estimate = estimateWeapons({ state: fold.state, trackedBosses, tasks: ownTasks, profile, settings, now: current, soulDoneThisWeek });
    const genesisDone = fold.state.genesis.status === 'done';
    const status: Record<WeaponKind, WeaponViewStatus> = {
      soul: fold.state.soul.status,
      genesis: fold.state.genesis.status,
      destiny: genesisDone && character.level >= DESTINY.minLevel ? fold.state.destiny.status : 'locked',
      astra: genesisDone && character.level >= ASTRA.minLevel ? fold.state.astra.status : 'locked',
    };
    return { state: fold.state, fold, thisWeek, estimate, profile, status, now: current };
  }, [character.id, character.level, bossClears, dailyClears, events, checkpoints, profiles, bosses, tasks, settings, minuteKey]);
}

