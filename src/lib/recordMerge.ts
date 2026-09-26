import type { Character } from '@/types';
import type { Tombstone } from '@/lib/tombstone';
import { toMillis } from '@/lib/timestamp';

/**
 * 同一筆資料兩邊都有時,決定合併後要用哪個版本。
 * 本機勝出時必須回傳 local 本身(同一個物件參照),呼叫端靠這點判斷「有沒有被遠端更新」。
 */
export type RecordResolver<T> = (local: T, remote: T) => T;

export interface MergeRecordsResult<T> {
  items: T[];
  tombstones: Tombstone[];
  /** 遠端有、本機沒有而新增的筆數 */
  addedCount: number;
  /** 兩邊都有、採用遠端版本的筆數 */
  updatedCount: number;
  /** 本機有、但被合併後的墓碑刪掉的筆數(其他裝置刪除的) */
  removedByTombstoneCount: number;
  /** 遠端有、但本機已經刪除過(本機有墓碑)而略過的筆數 */
  skippedByLocalTombstoneCount: number;
}

/**
 * 帳號/角色/任務/BOSS 共用的雙向合併邏輯:
 * 1. 合併本機與遠端的墓碑(同 id 取 deletedAt 較新者)
 * 2. 本機資料裡符合合併後墓碑的項目移除(刪除一律優先於編輯)
 * 3. 兩邊都有的資料交給 resolve 決定採用哪個版本
 * 4. 遠端資料裡本機沒有、且不在墓碑清單裡的項目,新增進本機
 * 沒有任何異動時回傳原本的陣列參照,避免被 trackLocalChange 誤判成本機資料異動。
 * @param localItems 本機資料
 * @param localTombstones 本機墓碑
 * @param remoteItems 備份裡的資料
 * @param remoteTombstones 備份裡的墓碑
 * @param resolve 同一筆資料兩邊都有時的取捨規則
 * @returns 合併後的資料、墓碑與各項筆數
 */
export function mergeRecords<T extends { id: string }>(
  localItems: T[],
  localTombstones: Tombstone[],
  remoteItems: T[],
  remoteTombstones: Tombstone[],
  resolve: RecordResolver<T>,
): MergeRecordsResult<T> {
  const mergedTombstoneMap = new Map<string, Tombstone>();
  for (const t of localTombstones) mergedTombstoneMap.set(t.id, t);
  // 只有遠端真的帶來「本機沒有、或比本機新」的墓碑時才視為有變動;完全被本機涵蓋時保留原陣列參照
  let tombstonesChanged = false;
  for (const tombstone of remoteTombstones) {
    const existing = mergedTombstoneMap.get(tombstone.id);
    if (!existing || toMillis(tombstone.deletedAt) > toMillis(existing.deletedAt)) {
      mergedTombstoneMap.set(tombstone.id, tombstone);
      tombstonesChanged = true;
    }
  }
  const mergedTombstones = tombstonesChanged ? [...mergedTombstoneMap.values()] : localTombstones;
  const tombstoneIds = new Set(mergedTombstones.map((t) => t.id));
  const localTombstoneIds = new Set(localTombstones.map((t) => t.id));

  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  let removedByTombstoneCount = 0;
  let updatedCount = 0;
  const merged: T[] = [];
  for (const item of localItems) {
    if (tombstoneIds.has(item.id)) {
      removedByTombstoneCount++;
      continue;
    }
    const remote = remoteById.get(item.id);
    const resolved = remote ? resolve(item, remote) : item;
    if (resolved !== item) updatedCount++;
    merged.push(resolved);
  }

  const localIds = new Set(localItems.map((item) => item.id));
  let skippedByLocalTombstoneCount = 0;
  const added: T[] = [];
  for (const item of remoteItems) {
    if (localIds.has(item.id)) continue;
    if (tombstoneIds.has(item.id)) {
      if (localTombstoneIds.has(item.id)) skippedByLocalTombstoneCount++;
      continue;
    }
    added.push(item);
  }

  const changed = removedByTombstoneCount > 0 || updatedCount > 0 || added.length > 0;
  return {
    items: changed ? [...merged, ...added] : localItems,
    tombstones: mergedTombstones,
    addedCount: added.length,
    updatedCount,
    removedByTombstoneCount,
    skippedByLocalTombstoneCount,
  };
}

/** 把物件依 key 排序後序列化,讓欄位順序不同但內容相同的兩筆資料得到同一個字串 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * 依指定的時間欄位挑出較新的版本(last-write-wins):
 * - 時間不同:較新者勝
 * - 都沒有修改紀錄(升級前的舊資料):保留本機,與升級前的行為一致
 * - 同一毫秒的不同修改(極少見):比較內容,讓兩台裝置各自合併時都挑到同一個版本
 */
function pickNewerBy<T>(local: T, remote: T, getTime: (record: T) => string | undefined): T {
  const localTime = toMillis(getTime(local));
  const remoteTime = toMillis(getTime(remote));
  if (localTime !== remoteTime) return remoteTime > localTime ? remote : local;
  if (localTime === 0) return local;
  return stableStringify(remote) > stableStringify(local) ? remote : local;
}

/** 帳號/任務/BOSS 的取捨規則:整筆資料依 updatedAt 較新者勝 */
export function resolveByUpdatedAt<T extends { updatedAt: string }>(local: T, remote: T): T {
  return pickNewerBy(local, remote, (r) => r.updatedAt);
}

/**
 * 角色的取捨規則:角色資料(名稱、等級等)依 updatedAt、位置(所屬帳號、排序)依 placementUpdatedAt 各自取較新者,
 * 讓「A 裝置改等級、B 裝置把角色搬到別的帳號」兩邊的修改都能保留。
 */
export function resolveCharacter(local: Character, remote: Character): Character {
  const data = pickNewerBy(local, remote, (c) => c.updatedAt);
  const placement = pickNewerBy(local, remote, (c) => c.placementUpdatedAt);
  if (data === placement) return data;
  return {
    ...data,
    accountId: placement.accountId,
    order: placement.order,
    placementUpdatedAt: placement.placementUpdatedAt,
  };
}
