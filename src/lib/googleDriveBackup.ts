import { useSettingsStore } from '@/store/useSettingsStore';
import { buildCurrentBackupPayloadJson, parseBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload, type MergeResult } from '@/lib/backupMerge';
import { downloadFile, findFileId, uploadFile } from '@/lib/googleDrive';
import { hasUnsavedLocalChanges } from '@/lib/backupStatus';

const LATEST_FILE_NAME = 'backup-latest.json';
/** 純粹作為「備份現在」誤把損壞資料寫進 Drive 時的幕後安全網,不提供使用者手動選擇還原 */
const PREVIOUS_FILE_NAME = 'backup-previous.json';

export interface BackupAvailability {
  latest: boolean;
}

/** 「這次/上次」輪替:先把目前的 backup-latest.json 內容搬去 backup-previous.json,再寫入新的 backup-latest.json */
export async function backupNow(): Promise<void> {
  const latestFileId = await findFileId(LATEST_FILE_NAME);

  if (latestFileId) {
    const previousContent = await downloadFile(latestFileId);
    await Promise.all([
      uploadFile(PREVIOUS_FILE_NAME, previousContent),
      uploadFile(LATEST_FILE_NAME, buildCurrentBackupPayloadJson()),
    ]);
  } else {
    await uploadFile(LATEST_FILE_NAME, buildCurrentBackupPayloadJson());
  }

  useSettingsStore.getState().setLastBackupAt(new Date().toISOString());
}

/** 查詢有沒有備份紀錄,供還原頁面決定要不要停用「從 Drive 還原」按鈕 */
export async function checkBackupAvailability(): Promise<BackupAvailability> {
  const latestId = await findFileId(LATEST_FILE_NAME);
  return { latest: latestId !== undefined };
}

/** 從最新備份還原並合併進本機 store,回傳新增的角色/任務/BOSS 筆數 */
export async function restoreFromLatest(): Promise<MergeResult> {
  const fileId = await findFileId(LATEST_FILE_NAME);
  if (!fileId) {
    throw new Error('尚未有備份紀錄');
  }
  const content = await downloadFile(fileId);
  const payload = parseBackupPayload(content);

  const { lastBackupAt, lastLocalChangeAt } = useSettingsStore.getState();
  const hadPendingChangesBeforeRestore = hasUnsavedLocalChanges(lastBackupAt, lastLocalChangeAt);

  const result = mergeBackupPayload(payload);
  // 還原前如果本機本來就有尚未備份的異動,這次還原不能算「已同步」,否則會蓋掉那筆真正還沒備份的紀錄
  if (!hadPendingChangesBeforeRestore) {
    useSettingsStore.getState().setLastBackupAt(new Date().toISOString());
  }
  return result;
}
