/**
 * 角色/任務/BOSS 三個 store 各自持有自己的墓碑清單,彼此不共用狀態,
 * 只共用這裡的無狀態函式,記錄「這筆資料被刪除過」,合併備份時用來分辨
 * 「本機沒有的資料要新增」還是「本機沒有是因為被刪除過,不該被還原復活」。
 *
 * 合併邏輯見 lib/recordMerge.ts 的 mergeRecords。
 *
 * 已知設計限制:一律是刪除贏過編輯(delete-wins)——若裝置 A 刪除某筆資料、裝置 B 在那之後才編輯同一筆,
 * 裝置 B 之後同步時這筆編輯仍會被墓碑直接濾掉,不會有任何衝突提示。
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
