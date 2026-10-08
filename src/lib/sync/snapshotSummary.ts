import { toMillis } from '@/lib/timestamp';
import type { DataSnapshot } from '@/lib/sync/snapshot';

/** 版本卡片上的資料概況 */
export interface SnapshotSummary {
  accounts: number;
  characters: number;
  tasks: number;
  bosses: number;
  /** 所有資料的修改時間與刪除時間裡最晚的一個；沒有任何紀錄時為 undefined */
  lastModifiedAt?: string;
}

/**
 * 計算版本卡片顯示的筆數與最後修改時間。
 * @param snapshot 要描述的資料
 * @returns 各類筆數與最後修改時間
 */
export function summarizeSnapshot(snapshot: DataSnapshot): SnapshotSummary {
  const times = [
    ...snapshot.accounts.map((a) => a.updatedAt),
    ...snapshot.characters.flatMap((c) => [c.updatedAt, c.placementUpdatedAt]),
    ...snapshot.tasks.map((t) => t.updatedAt),
    ...snapshot.bosses.map((b) => b.updatedAt),
    ...[
      ...snapshot.accountTombstones,
      ...snapshot.characterTombstones,
      ...snapshot.taskTombstones,
      ...snapshot.bossTombstones,
    ].map((t) => t.deletedAt),
  ]
    .map((value) => toMillis(value))
    .filter((ms) => ms > 0);
  return {
    accounts: snapshot.accounts.length,
    characters: snapshot.characters.length,
    tasks: snapshot.tasks.length,
    bosses: snapshot.bosses.length,
    lastModifiedAt: times.length > 0 ? new Date(Math.max(...times)).toISOString() : undefined,
  };
}

/** 某一類資料被取代時的變化筆數 */
export interface KindImpact {
  added: number;
  removed: number;
  changed: number;
}

/** 以一份資料取代另一份時會發生什麼，供卡片寫出「選這份：雲端會刪除 2 個角色、還原 1 個角色、變更 15 筆紀錄」 */
export interface OverwriteImpact {
  accounts: KindImpact;
  characters: KindImpact;
  tasks: KindImpact;
  bosses: KindImpact;
  /** 取代後新增（或還原回來）的角色名稱，可在卡片內展開 */
  addedCharacterNames: string[];
  /** 取代後被刪除的角色名稱，可在卡片內展開 */
  removedCharacterNames: string[];
}

/** 去掉修改時間後的內容，用來判斷兩個版本是否真的不同 */
function comparableContent(item: object): string {
  return JSON.stringify(
    Object.entries(item)
      .filter(([key]) => key !== 'updatedAt' && key !== 'placementUpdatedAt')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function kindImpact<T extends { id: string }>(current: T[], target: T[]): KindImpact {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const targetIds = new Set(target.map((item) => item.id));
  let added = 0;
  let changed = 0;
  for (const item of target) {
    const before = currentById.get(item.id);
    if (!before) added += 1;
    else if (comparableContent(before) !== comparableContent(item)) changed += 1;
  }
  return { added, removed: current.filter((item) => !targetIds.has(item.id)).length, changed };
}

/**
 * 描述「以 target 取代 current」的影響。只比較內容，修改時間不同不算變更。
 * @param current 會被取代的資料
 * @param target 取代後的資料
 * @returns 各類新增、刪除、變更筆數與角色名稱清單
 */
export function describeOverwrite(current: DataSnapshot, target: DataSnapshot): OverwriteImpact {
  const currentCharacterIds = new Set(current.characters.map((c) => c.id));
  const targetCharacterIds = new Set(target.characters.map((c) => c.id));
  return {
    accounts: kindImpact(current.accounts, target.accounts),
    characters: kindImpact(current.characters, target.characters),
    tasks: kindImpact(current.tasks, target.tasks),
    bosses: kindImpact(current.bosses, target.bosses),
    addedCharacterNames: target.characters.filter((c) => !currentCharacterIds.has(c.id)).map((c) => c.name),
    removedCharacterNames: current.characters.filter((c) => !targetCharacterIds.has(c.id)).map((c) => c.name),
  };
}
