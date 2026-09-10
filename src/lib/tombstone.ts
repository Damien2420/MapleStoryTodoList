/**
 * 角色/任務/BOSS 三個 store 各自持有自己的墓碑清單,彼此不共用狀態,
 * 只共用這裡的無狀態函式,記錄「這筆資料被刪除過」,合併備份時用來分辨
 * 「本機沒有的資料要新增」還是「本機沒有是因為被刪除過,不該被還原復活」。
 *
 * 已知設計限制(之後再決定是否要調整):
 * 資料本身沒有 updatedAt,applyTombstones 合併時無法分辨「本機這筆資料是不是在被其他裝置刪除之後才編輯的」,
 * 一律是刪除贏過編輯(delete-wins)——若裝置 A 刪除某筆資料、裝置 B 在那之前已編輯過同一筆但尚未備份,
 * 裝置 B 之後同步時這筆編輯會被墓碑直接濾掉、無聲消失,不會有任何衝突提示。
 */
export interface Tombstone {
  id: string;
  /** 刪除當下的時間(ISO 字串),用於保留期判斷,以及雙方都刪過同一筆資料時取較新的紀錄 */
  deletedAt: string;
}

/** 新增一筆刪除紀錄(先移除同 id 的舊紀錄,避免重複) */
export function recordTombstone(tombstones: Tombstone[], id: string): Tombstone[] {
  return [...tombstones.filter((t) => t.id !== id), { id, deletedAt: new Date().toISOString() }];
}

/** 復原刪除(undo)時把對應的墓碑拿掉,避免「本機明明有這筆資料、墓碑卻說它被刪除」的矛盾狀態 */
export function clearTombstone(tombstones: Tombstone[], id: string): Tombstone[] {
  return tombstones.filter((t) => t.id !== id);
}

/** 清掉超過保留天數的墓碑,避免清單無限增長 */
export function pruneTombstones(tombstones: Tombstone[], retentionDays: number, now: Date = new Date()): Tombstone[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return tombstones.filter((t) => new Date(t.deletedAt).getTime() >= cutoff);
}

export interface ApplyTombstonesResult<T> {
  items: T[];
  tombstones: Tombstone[];
  addedCount: number;
  removedByRemoteTombstoneCount: number;
}

/**
 * 角色/任務/BOSS 三種資料共用的雙向合併邏輯:
 * 1. 合併本機與遠端的墓碑(同 id 取 deletedAt 較新者)
 * 2. 本機資料裡符合合併後墓碑的項目移除(套用其他裝置傳來的刪除意圖)
 * 3. 遠端資料裡本機沒有、且不在墓碑清單裡的項目,新增進本機
 */
export function applyTombstones<T extends { id: string }>(
  localItems: T[],
  localTombstones: Tombstone[],
  remoteItems: T[],
  remoteTombstones: Tombstone[],
): ApplyTombstonesResult<T> {
  const mergedTombstoneMap = new Map<string, Tombstone>();
  for (const t of localTombstones) mergedTombstoneMap.set(t.id, t);
  // 只有遠端真的帶來「本機沒有、或比本機新」的墓碑時才視為有變動;完全被本機涵蓋時保留原陣列參照,
  // 避免呼叫端用參照比較偵測變動時(例如 trackLocalChange)被無意義的新陣列誤判成本機資料異動
  let tombstonesChanged = false;
  for (const tombstone of remoteTombstones) {
    const existing = mergedTombstoneMap.get(tombstone.id);
    if (!existing || new Date(tombstone.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      mergedTombstoneMap.set(tombstone.id, tombstone);
      tombstonesChanged = true;
    }
  }
  const mergedTombstones = tombstonesChanged ? [...mergedTombstoneMap.values()] : localTombstones;
  const tombstoneIds = new Set(mergedTombstones.map((t) => t.id));

  const survivingLocal = localItems.filter((item) => !tombstoneIds.has(item.id));
  const removedByRemoteTombstoneCount = localItems.length - survivingLocal.length;

  const survivingLocalIds = new Set(survivingLocal.map((item) => item.id));
  const newFromRemote = remoteItems.filter((item) => !survivingLocalIds.has(item.id) && !tombstoneIds.has(item.id));

  const items =
    removedByRemoteTombstoneCount === 0 && newFromRemote.length === 0 ? localItems : [...survivingLocal, ...newFromRemote];

  return {
    items,
    tombstones: mergedTombstones,
    addedCount: newFromRemote.length,
    removedByRemoteTombstoneCount,
  };
}
