import type { DriveBackupPayload } from '@/lib/backupPayload';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { applyTombstones, pruneTombstones } from '@/lib/tombstone';

export interface MergeResult {
  addedCharacters: number;
  addedTasks: number;
  addedBosses: number;
  /** 因為別的裝置傳來的刪除墓碑,而在本機一併移除的筆數(角色+任務+BOSS 加總) */
  removedByTombstone: number;
}

/**
 * 把備份內容雙向合併進本機 store:
 * 1. 角色/任務/BOSS 各自呼叫 applyTombstones,新增本機沒有的資料、移除已被(任一裝置)標記刪除的資料
 * 2. 合併後的墓碑清單一併寫回 store,讓刪除意圖可以繼續往下一次備份傳遞
 */
export function mergeBackupPayload(payload: DriveBackupPayload): MergeResult {
  const characterState = useCharacterStore.getState();
  const characterResult = applyTombstones(
    characterState.characters,
    characterState.deletedIds,
    payload.characters,
    payload.characterTombstones,
  );

  const taskState = useTaskStore.getState();
  const taskResult = applyTombstones(taskState.tasks, taskState.deletedIds, payload.tasks, payload.taskTombstones);

  const bossState = useBossStore.getState();
  const bossResult = applyTombstones(bossState.bosses, bossState.deletedIds, payload.bosses, payload.bossTombstones);

  useCharacterStore.setState((state) => ({
    characters: characterResult.items,
    deletedIds: characterResult.tombstones,
    // 本機目前選中的角色如果還在(沒被移除)就維持原選取,否則(包含本機原本就沒有角色的情況)回退到第一個可用角色
    activeCharacterId:
      state.activeCharacterId !== null && characterResult.items.some((c) => c.id === state.activeCharacterId)
        ? state.activeCharacterId
        : (characterResult.items[0]?.id ?? null),
  }));
  useTaskStore.setState({ tasks: taskResult.items, deletedIds: taskResult.tombstones });
  useBossStore.setState({ bosses: bossResult.items, deletedIds: bossResult.tombstones });

  return {
    addedCharacters: characterResult.addedCount,
    addedTasks: taskResult.addedCount,
    addedBosses: bossResult.addedCount,
    removedByTombstone:
      characterResult.removedByRemoteTombstoneCount +
      taskResult.removedByRemoteTombstoneCount +
      bossResult.removedByRemoteTombstoneCount,
  };
}

/** 墓碑保留天數:超過這個天數的刪除紀錄視為已經傳播夠久,清掉以避免清單無限增長 */
export const TOMBSTONE_RETENTION_DAYS = 90;

/** 清除三個 store 裡超過保留天數的墓碑,在每次成功備份後呼叫 */
export function pruneAllTombstones(retentionDays: number = TOMBSTONE_RETENTION_DAYS): void {
  useCharacterStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useTaskStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useBossStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
}
