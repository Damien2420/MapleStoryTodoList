import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';
import type { AdjustPayload, BossClear, DailyClear, WeaponEvent } from './types';

/** 測試共用的重置設定(與 useSettingsStore 預設值相同) */
export const SETTINGS: Settings = { dailyResetTime: '00:00', weeklyResetDay: 3, weeklyResetTime: '00:00' };

/** 本機時間的 Date,month 為 1~12 */
export function at(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

/** 建立追蹤中的 BOSS */
export function boss(p: Partial<CharacterBossTrackList> & Pick<CharacterBossTrackList, 'bossCatalogId' | 'difficulty'>): CharacterBossTrackList {
  return {
    id: `${p.bossCatalogId}-${p.difficulty}-${p.category ?? 'n'}`,
    characterId: 'c1',
    bossName: p.bossCatalogId!,
    resetCycle: p.bossCatalogId === 'black-mage' ? 'monthly' : 'weekly',
    weeklyResetDay: p.bossCatalogId === 'black-mage' || p.category === 'vip' ? undefined : 4,
    crystalValue: 0,
    partySize: 1,
    checked: false,
    lastResetAt: at(2026, 10, 1, 1).toISOString(),
    updatedAt: at(2026, 10, 1, 1).toISOString(),
    ...p,
  };
}

/** 建立任務 */
export function task(p: Partial<CharacterTask> & Pick<CharacterTask, 'name'>): CharacterTask {
  return {
    id: `t-${p.name}`,
    characterId: 'c1',
    category: '格蘭蒂斯',
    resetCycle: 'daily',
    checked: false,
    lastResetAt: at(2026, 10, 1, 1).toISOString(),
    order: 0,
    updatedAt: at(2026, 10, 1, 1).toISOString(),
    ...p,
  };
}

/** 建立擊破紀錄 */
export function clear(p: Partial<BossClear> & Pick<BossClear, 'bossCatalogId' | 'difficulty' | 'firstClearedAt'>): BossClear {
  const cycleEnd = new Date(p.firstClearedAt);
  cycleEnd.setDate(cycleEnd.getDate() + 7);
  return {
    id: `c1:${p.bossCatalogId}:n:${p.firstClearedAt}`,
    characterId: 'c1',
    partySize: 1,
    isVip: false,
    genesisPass: false,
    stormTraining: false,
    cycleEnd: cycleEnd.toISOString(),
    active: true,
    updatedAt: p.firstClearedAt,
    ...p,
  };
}

/** 建立每日紀錄 */
export function daily(day: Date, shards: number): DailyClear {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return {
    id: `c1:d:${start.toISOString()}`,
    characterId: 'c1',
    day: start.toISOString(),
    firstClearedAt: day.toISOString(),
    topRegionShards: shards,
    updatedAt: day.toISOString(),
  };
}

/** 建立校正事件 */
export function adjust(when: Date, payload: AdjustPayload): WeaponEvent {
  return { id: `c1:${payload.weapon}:adjust:${when.toISOString()}`, characterId: 'c1', weapon: payload.weapon, kind: 'adjust', payload, at: when.toISOString(), updatedAt: when.toISOString() };
}

/** 建立升階事件 */
export function upgrade(when: Date, weapon: WeaponEvent['weapon'], fromStage: number, phase = 1, soulQuestKey?: string): WeaponEvent {
  return {
    id: `c1:${weapon}:up:${phase}:${fromStage}`,
    characterId: 'c1',
    weapon,
    kind: 'upgrade',
    payload: { fromStage, soulQuestKey },
    at: when.toISOString(),
    updatedAt: when.toISOString(),
  };
}

/** 建立其他事件(標記完成、命運開始第二階段) */
export function simpleEvent(when: Date, weapon: WeaponEvent['weapon'], kind: 'complete' | 'destinyPhase2'): WeaponEvent {
  return { id: `c1:${weapon}:${kind}:${when.toISOString()}`, characterId: 'c1', weapon, kind, at: when.toISOString(), updatedAt: when.toISOString() };
}
