import { useSettingsStore } from '@/store/useSettingsStore';
import { buildCurrentBackupPayloadJson, parseBackupPayload, type DriveBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload, pruneAllTombstones, type MergeResult } from '@/lib/backupMerge';
import { downloadFile, findFileId, uploadFile } from '@/lib/googleDrive';
import { hasUnsavedLocalChanges } from '@/lib/backupStatus';

const LATEST_FILE_NAME = 'backup-latest.json';
/** 純粹作為「備份現在」誤把損壞資料寫進 Drive 時的幕後安全網,不提供使用者手動選擇還原 */
const PREVIOUS_FILE_NAME = 'backup-previous.json';

export interface BackupAvailability {
  latest: boolean;
}

/**
 * fetch → merge → push:先把 Drive 現有內容合併進本機(吸收其他裝置的新增與刪除意圖),
 * 再把合併後的本機狀態上傳,避免整批覆蓋掉其他裝置還沒同步下來的異動。
 * 「這次/上次」輪替:先把目前的 backup-latest.json 內容搬去 backup-previous.json,再寫入新的 backup-latest.json。
 */
export async function backupNow(): Promise<void> {
  const latestFileId = await findFileId(LATEST_FILE_NAME);

  if (latestFileId) {
    const previousContent = await downloadFile(latestFileId);
    mergeBackupPayload(parseBackupPayload(previousContent));
    await Promise.all([
      uploadFile(PREVIOUS_FILE_NAME, previousContent),
      uploadFile(LATEST_FILE_NAME, buildCurrentBackupPayloadJson()),
    ]);
  } else {
    await uploadFile(LATEST_FILE_NAME, buildCurrentBackupPayloadJson());
  }

  pruneAllTombstones();
  useSettingsStore.getState().setLastBackupAt(new Date().toISOString());
}

/** 查詢有沒有備份紀錄,供還原頁面決定要不要停用「從 Drive 還原」按鈕 */
export async function checkBackupAvailability(): Promise<BackupAvailability> {
  const latestId = await findFileId(LATEST_FILE_NAME);
  return { latest: latestId !== undefined };
}

/**
 * 下載並解析 Drive 上最新的備份內容,不做任何合併。
 * 拆成獨立函式是為了讓呼叫端能在合併前先檢查 payload.createdAt(例如判斷備份是否過時,先問使用者再決定要不要合併)。
 */
export async function fetchLatestBackup(): Promise<DriveBackupPayload> {
  const fileId = await findFileId(LATEST_FILE_NAME);
  if (!fileId) {
    throw new Error('尚未有備份紀錄');
  }
  const content = await downloadFile(fileId);
  return parseBackupPayload(content);
}

/** 把已經下載好的備份內容合併進本機 store,回傳新增/移除的角色/任務/BOSS 筆數 */
export function applyRestoredPayload(payload: DriveBackupPayload): MergeResult {
  const { lastBackupAt, lastLocalChangeAt } = useSettingsStore.getState();
  const hadPendingChangesBeforeRestore = hasUnsavedLocalChanges(lastBackupAt, lastLocalChangeAt);

  const result = mergeBackupPayload(payload);
  // 還原前如果本機本來就有尚未備份的異動,這次還原不能算「已同步」,否則會蓋掉那筆真正還沒備份的紀錄
  if (!hadPendingChangesBeforeRestore) {
    useSettingsStore.getState().setLastBackupAt(new Date().toISOString());
  }
  return result;
}
