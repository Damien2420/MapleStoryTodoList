import type { Tombstone } from '@/lib/tombstone';
import {
  emptyWeaponState,
  type BossClear,
  type CharacterWeaponState,
  type DailyClear,
  type WeaponCheckpoint,
  type WeaponEvent,
  type WeaponProfile,
  type WeaponSnapshot,
} from './types';

/** 只留下有 id 與 characterId 的物件;不是陣列或內容損毀時回傳空陣列 */
export function cleanList<T extends { id: string }>(value: unknown, key: 'characterId' | 'self'): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is T => !!x && typeof x === 'object' && typeof (x as T).id === 'string' && (key === 'self' || typeof (x as { characterId?: unknown }).characterId === 'string'),
  );
}

/** 把存檔點的武器狀態補齊缺漏欄位,避免 fold 讀到 undefined 而崩潰 */
export function completeState(state: unknown): CharacterWeaponState {
  const base = emptyWeaponState();
  if (!state || typeof state !== 'object') return base;
  const given = state as Partial<Record<keyof CharacterWeaponState, unknown>>;
  const out = { ...base };
  for (const kind of Object.keys(base) as (keyof CharacterWeaponState)[]) {
    const v = given[kind];
    if (v && typeof v === 'object') (out as Record<string, unknown>)[kind] = { ...base[kind], ...v };
  }
  return out;
}

/** 只留下 id 與 deletedAt 都是字串的墓碑 */
function cleanTombstones(value: unknown): Tombstone[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is Tombstone => !!t && typeof t === 'object' && typeof (t as Tombstone).id === 'string' && typeof (t as Tombstone).deletedAt === 'string',
  );
}

/**
 * 驗證並清理外部來源（localStorage、備份檔、雲端）的武器資料，壞掉的欄位退回預設值。
 * @param value 未經驗證的武器資料
 * @returns 形狀正確的武器快照
 */
export function sanitizeWeaponSnapshot(value: unknown): WeaponSnapshot {
  const p = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    profiles: cleanList<WeaponProfile>(p.profiles, 'self'),
    bossClears: cleanList<BossClear>(p.bossClears, 'characterId'),
    dailyClears: cleanList<DailyClear>(p.dailyClears, 'characterId'),
    events: cleanList<WeaponEvent>(p.events, 'characterId'),
    checkpoints: cleanList<WeaponCheckpoint>(p.checkpoints, 'self').map((c) => ({ ...c, state: completeState(c.state) })),
    tombstones: cleanTombstones(p.tombstones),
  };
}
