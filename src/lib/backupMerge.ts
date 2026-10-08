import type { DriveBackupPayload } from '@/lib/backupPayload';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import { pruneTombstones } from '@/lib/tombstone';
import { mergeSnapshots, snapshotFromPayload, TOMBSTONE_RETENTION_DAYS, type MergeResult } from '@/lib/sync/snapshot';
import { storeRepo } from '@/lib/sync/localRepo';

export type { MergeResult } from '@/lib/sync/snapshot';

/**
 * 把備份內容雙向合併進本機 store。
 * 計算由純函式 mergeSnapshots 負責（規則見該函式說明），這裡只負責讀出本機快照、合併、寫回；
 * 寫回時的角色選取回退與重置檢查由 storeRepo.write 處理。三個步驟同步執行，中間沒有 await。
 * @param payload 已經升級到目前版本的備份內容
 * @returns 新增/更新/移除/略過的筆數
 */
export function mergeBackupPayload(payload: DriveBackupPayload): MergeResult {
  const { merged, result } = mergeSnapshots(storeRepo.read(), snapshotFromPayload(payload));
  storeRepo.write(merged);
  return result;
}

export { TOMBSTONE_RETENTION_DAYS };

/** 清除三個 store 裡超過保留天數的墓碑,在每次成功備份後呼叫 */
export function pruneAllTombstones(retentionDays: number = TOMBSTONE_RETENTION_DAYS): void {
  useCharacterStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useTaskStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useBossStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
  useAccountStore.setState((state) => ({ deletedIds: pruneTombstones(state.deletedIds, retentionDays) }));
}
