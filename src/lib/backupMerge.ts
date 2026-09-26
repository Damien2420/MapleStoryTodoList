import type { CharacterTask } from '@/types';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { pruneTombstones, recordTombstone, type Tombstone } from '@/lib/tombstone';
import { mergeRecords, resolveByUpdatedAt, resolveCharacter } from '@/lib/recordMerge';
import { renumberByPresetOrder } from '@/lib/presetTasks';

export interface MergeResult {
  addedAccounts: number;
  addedCharacters: number;
  addedTasks: number;
  addedBosses: number;
  /** 兩邊都有、採用備份裡較新版本的筆數(帳號+角色+任務+BOSS 加總) */
  updated: number;
  /** 因為別的裝置傳來的刪除紀錄,而在本機一併移除的筆數(帳號+角色+任務+BOSS 加總,含已刪除角色底下留下的任務/BOSS) */
  removedByTombstone: number;
  /** 備份裡有、但這台裝置已經刪除過而略過的筆數(帳號+角色+任務+BOSS 加總) */
  skippedByLocalTombstone: number;
}

/**
 * 把備份內容雙向合併進本機 store:
 * 1. 帳號/角色/任務/BOSS 各自呼叫 mergeRecords:新增本機沒有的資料、兩邊都有時取較新的版本、
 *    移除已被(任一裝置)標記刪除的資料;合併後的墓碑清單一併寫回 store,讓刪除意圖可以繼續往下一次備份傳遞
 * 2. 合併後的衍生修正(都不算使用者修改,不更新 updatedAt):
 *    - 已刪除角色底下的任務/BOSS 一併移除並記錄墓碑(另一台裝置在刪除前新增的任務/BOSS 會被帶進來)
 *    - 每個角色的任務依預設目錄重新編號 order(兩邊各自新增的任務合併後 order 可能撞號)
 *    - 重新跑一次重置檢查(備份裡較新的版本可能是上個週期勾選的)
 */
export function mergeBackupPayload(payload: DriveBackupPayload): MergeResult {
  const characterState = useCharacterStore.getState();
  const characterResult = mergeRecords(
    characterState.characters,
    characterState.deletedIds,
    payload.characters,
    payload.characterTombstones,
    resolveCharacter,
  );

  const taskState = useTaskStore.getState();
  const taskResult = mergeRecords(
    taskState.tasks,
    taskState.deletedIds,
    payload.tasks,
    payload.taskTombstones,
    resolveByUpdatedAt,
  );

  const bossState = useBossStore.getState();
  const bossResult = mergeRecords(
    bossState.bosses,
    bossState.deletedIds,
    payload.bosses,
    payload.bossTombstones,
    resolveByUpdatedAt,
  );

  const accountState = useAccountStore.getState();
  const accountResult = mergeRecords(
    accountState.accounts,
    accountState.deletedIds,
    payload.accounts,
    payload.accountTombstones,
    resolveByUpdatedAt,
  );

  const deletedCharacterIds = new Set(characterResult.tombstones.map((t) => t.id));
  const orphanTasks = removeOrphans(
    taskResult.items,
    taskResult.tombstones,
    deletedCharacterIds,
    new Set(taskState.tasks.map((t) => t.id)),
  );
  const orphanBosses = removeOrphans(
    bossResult.items,
    bossResult.tombstones,
    deletedCharacterIds,
    new Set(bossState.bosses.map((b) => b.id)),
  );

  useCharacterStore.setState((state) => ({
    characters: characterResult.items,
    deletedIds: characterResult.tombstones,
    // 本機目前選中的角色如果還在(沒被移除)就維持原選取,否則(包含本機原本就沒有角色的情況)回退到第一個可用角色
    activeCharacterId:
      state.activeCharacterId !== null && characterResult.items.some((c) => c.id === state.activeCharacterId)
        ? state.activeCharacterId
        : (characterResult.items[0]?.id ?? null),
  }));
  useTaskStore.setState({ tasks: renumberPresetTasks(orphanTasks.items), deletedIds: orphanTasks.tombstones });
  useBossStore.setState({ bosses: orphanBosses.items, deletedIds: orphanBosses.tombstones });
  useAccountStore.setState({ accounts: accountResult.items, deletedIds: accountResult.tombstones });

  const { settings } = useSettingsStore.getState();
  useTaskStore.getState().runResetCheck(settings);
  useBossStore.getState().runResetCheck(settings);

  const results = [characterResult, taskResult, bossResult, accountResult];
  const sum = (pick: (r: (typeof results)[number]) => number) => results.reduce((acc, r) => acc + pick(r), 0);
  return {
    addedAccounts: accountResult.addedCount,
    addedCharacters: characterResult.addedCount,
    addedTasks: taskResult.addedCount - orphanTasks.droppedFromRemoteCount,
    addedBosses: bossResult.addedCount - orphanBosses.droppedFromRemoteCount,
    updated: sum((r) => r.updatedCount),
    removedByTombstone: sum((r) => r.removedByTombstoneCount) + orphanTasks.removedCount + orphanBosses.removedCount,
    skippedByLocalTombstone: sum((r) => r.skippedByLocalTombstoneCount),
  };
}

/**
 * 移除屬於已刪除角色的任務/BOSS,並替它們記錄墓碑,讓刪除繼續傳到其他裝置。
 * 沒有要移除的項目時回傳原本的陣列參照。
 * @param localIds 合併前本機就有的 id,用來把移除的項目分成「本機原本有」與「這次才從備份帶進來」兩種計數
 * @returns removedCount 為本機原本就有而被移除的筆數;droppedFromRemoteCount 為備份帶進來但隨即移除、
 *          實際上從未出現在本機的筆數(呼叫端要從新增筆數扣掉,不算新增也不算移除)
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
 * 每個角色的任務依預設目錄重新編號 order,保持陣列中的原本位置。
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

/** 墓碑保留天數:超過這個天數的刪除紀錄視為已經傳播夠久,清掉以避免清單無限增長 */
export const TOMBSTONE_RETENTION_DAYS = 90;

/** 清除三個 store 裡超過保留天數的墓碑,在每次成功備份後呼叫 */
export function pruneAllTombstones(retentionDays: number = TOMBSTONE_RETENTION_DAYS): void {
  useCharacterStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useTaskStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useBossStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useAccountStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
}
