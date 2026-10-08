import type { CharacterTask } from '@/types';
import type { BuildBackupPayloadInput, DriveBackupPayload } from '@/lib/backupPayload';
import { pruneTombstones, recordTombstone, type Tombstone } from '@/lib/tombstone';
import { mergeRecords, resolveByUpdatedAt, resolveCharacter } from '@/lib/recordMerge';
import { renumberByPresetOrder } from '@/lib/presetTasks';
import { mergeWeaponSnapshots } from '@/lib/weapon/weaponMerge';

/**
 * 帳號、角色、任務、BOSS、武器進度與各自墓碑的完整快照，是同步與合併的基本單位。
 * 不含任何 UI 狀態（例如目前選中的角色），也不含備份格式的 version、createdAt。
 * 欄位與 buildBackupPayload 的輸入相同，直接沿用該型別避免兩份定義各自漂移。
 */
export type DataSnapshot = BuildBackupPayloadInput;

/** 合併結果的筆數統計，供畫面組出「新增/更新/同步移除/略過」提示文字 */
export interface MergeResult {
  addedAccounts: number;
  addedCharacters: number;
  addedTasks: number;
  addedBosses: number;
  /** 兩邊都有、採用遠端較新版本的筆數（帳號+角色+任務+BOSS 加總） */
  updated: number;
  /** 因為遠端傳來的刪除紀錄，而在本機一併移除的筆數（帳號+角色+任務+BOSS 加總，含已刪除角色底下留下的任務/BOSS） */
  removedByTombstone: number;
  /** 遠端有、但本機已經刪除過而略過的筆數（帳號+角色+任務+BOSS 加總） */
  skippedByLocalTombstone: number;
}

/** 墓碑保留天數：超過這個天數的刪除紀錄視為已經傳播夠久，清掉以避免清單無限增長；超過這個天數沒同步的裝置也不能自動合併 */
export const TOMBSTONE_RETENTION_DAYS = 90;

/**
 * 把備份檔內容轉成快照，去掉 version 與 createdAt。
 * @param payload 已經升級到目前版本的備份內容
 * @returns 只含資料與墓碑的快照
 */
export function snapshotFromPayload(payload: DriveBackupPayload): DataSnapshot {
  return {
    accounts: payload.accounts,
    accountTombstones: payload.accountTombstones,
    characters: payload.characters,
    characterTombstones: payload.characterTombstones,
    tasks: payload.tasks,
    taskTombstones: payload.taskTombstones,
    bosses: payload.bosses,
    bossTombstones: payload.bossTombstones,
    weapons: payload.weapons,
  };
}

/**
 * 把遠端快照雙向合併進本機快照，不讀寫任何 store，也不修改傳入的物件。
 * 1. 帳號/角色/任務/BOSS 各自呼叫 mergeRecords：新增本機沒有的資料、兩邊都有時取較新的版本、
 *    移除已被（任一邊）標記刪除的資料，合併後的墓碑一併放進結果
 * 2. 合併後的衍生修正（都不算使用者修改，不更新 updatedAt）：
 *    - 已刪除角色底下的任務/BOSS 一併移除並記錄墓碑
 *    - 每個角色的任務依預設目錄重新編號 order
 * 重置檢查與目前選中角色的回退不在這裡處理，屬於寫回 store 時的責任（見 localRepo.ts）。
 * 任一類資料沒有變化時，結果沿用本機原本的陣列參照。
 * @param local 本機目前的快照
 * @param remote 遠端（雲端或備份檔）的快照
 * @returns merged 為合併後的快照，result 為各項筆數
 */
export function mergeSnapshots(local: DataSnapshot, remote: DataSnapshot): { merged: DataSnapshot; result: MergeResult } {
  const characterResult = mergeRecords(
    local.characters,
    local.characterTombstones,
    remote.characters,
    remote.characterTombstones,
    resolveCharacter,
  );
  const taskResult = mergeRecords(local.tasks, local.taskTombstones, remote.tasks, remote.taskTombstones, resolveByUpdatedAt);
  const bossResult = mergeRecords(local.bosses, local.bossTombstones, remote.bosses, remote.bossTombstones, resolveByUpdatedAt);
  const accountResult = mergeRecords(
    local.accounts,
    local.accountTombstones,
    remote.accounts,
    remote.accountTombstones,
    resolveByUpdatedAt,
  );

  const deletedCharacterIds = new Set(characterResult.tombstones.map((t) => t.id));
  const orphanTasks = removeOrphans(
    taskResult.items,
    taskResult.tombstones,
    deletedCharacterIds,
    new Set(local.tasks.map((t) => t.id)),
  );
  const orphanBosses = removeOrphans(
    bossResult.items,
    bossResult.tombstones,
    deletedCharacterIds,
    new Set(local.bosses.map((b) => b.id)),
  );

  const merged: DataSnapshot = {
    accounts: accountResult.items,
    accountTombstones: accountResult.tombstones,
    characters: characterResult.items,
    characterTombstones: characterResult.tombstones,
    tasks: renumberPresetTasks(orphanTasks.items),
    taskTombstones: orphanTasks.tombstones,
    bosses: orphanBosses.items,
    bossTombstones: orphanBosses.tombstones,
    weapons: mergeWeaponSnapshots(local.weapons, remote.weapons, deletedCharacterIds),
  };

  const results = [characterResult, taskResult, bossResult, accountResult];
  const sum = (pick: (r: (typeof results)[number]) => number) => results.reduce((acc, r) => acc + pick(r), 0);
  const result: MergeResult = {
    addedAccounts: accountResult.addedCount,
    addedCharacters: characterResult.addedCount,
    addedTasks: taskResult.addedCount - orphanTasks.droppedFromRemoteCount,
    addedBosses: bossResult.addedCount - orphanBosses.droppedFromRemoteCount,
    updated: sum((r) => r.updatedCount),
    removedByTombstone: sum((r) => r.removedByTombstoneCount) + orphanTasks.removedCount + orphanBosses.removedCount,
    skippedByLocalTombstone: sum((r) => r.skippedByLocalTombstoneCount),
  };
  return { merged, result };
}

/**
 * 清掉快照裡各種墓碑（含武器墓碑）中超過保留天數的紀錄，資料陣列沿用原本的參照。
 * @param snapshot 要清理的快照
 * @param retentionDays 墓碑保留天數
 * @param now 現在時間，預設為當下；測試用
 * @returns 清理後的新快照
 */
export function pruneSnapshot(snapshot: DataSnapshot, retentionDays: number, now: Date = new Date()): DataSnapshot {
  return {
    ...snapshot,
    accountTombstones: pruneTombstones(snapshot.accountTombstones, retentionDays, now),
    characterTombstones: pruneTombstones(snapshot.characterTombstones, retentionDays, now),
    taskTombstones: pruneTombstones(snapshot.taskTombstones, retentionDays, now),
    bossTombstones: pruneTombstones(snapshot.bossTombstones, retentionDays, now),
    weapons: { ...snapshot.weapons, tombstones: pruneTombstones(snapshot.weapons.tombstones, retentionDays, now) },
  };
}

/**
 * 移除屬於已刪除角色的任務/BOSS，並替它們記錄墓碑，讓刪除繼續傳到其他裝置。
 * 沒有要移除的項目時回傳原本的陣列參照。
 * @param localIds 合併前本機就有的 id，用來把移除的項目分成「本機原本有」與「這次才從備份帶進來」兩種計數
 * @returns removedCount 為本機原本就有而被移除的筆數；droppedFromRemoteCount 為備份帶進來但隨即移除、
 *          實際上從未出現在本機的筆數（呼叫端要從新增筆數扣掉，不算新增也不算移除）
 */
function removeOrphans<T extends { id: string; characterId: string }>(
  items: T[],
  tombstones: Tombstone[],
  deletedCharacterIds: Set<string>,
  localIds: Set<string>,
): { items: T[]; tombstones: Tombstone[]; removedCount: number; droppedFromRemoteCount: number } {
  const orphans = items.filter((item) => deletedCharacterIds.has(item.characterId));
  if (orphans.length === 0) return { items, tombstones, removedCount: 0, droppedFromRemoteCount: 0 };
  const removedCount = orphans.filter((item) => localIds.has(item.id)).length;
  return {
    items: items.filter((item) => !deletedCharacterIds.has(item.characterId)),
    tombstones: orphans.reduce((acc, item) => recordTombstone(acc, item.id), tombstones),
    removedCount,
    droppedFromRemoteCount: orphans.length - removedCount,
  };
}

/**
 * 每個角色的任務依預設目錄重新編號 order，保持陣列中的原本位置。
 * 所有任務的 order 都沒變時回傳原本的陣列參照。
 */
function renumberPresetTasks(tasks: CharacterTask[]): CharacterTask[] {
  const byCharacter = new Map<string, CharacterTask[]>();
  for (const task of tasks) {
    const group = byCharacter.get(task.characterId);
    if (group) group.push(task);
    else byCharacter.set(task.characterId, [task]);
  }
  const renumbered = new Map<string, CharacterTask>();
  for (const group of byCharacter.values()) {
    for (const task of renumberByPresetOrder(group)) renumbered.set(task.id, task);
  }
  return tasks.some((t) => renumbered.get(t.id) !== t) ? tasks.map((t) => renumbered.get(t.id) ?? t) : tasks;
}
