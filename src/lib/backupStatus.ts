/** 判斷「備份後本機資料是否又有變動」,主畫面狀態列、備份頁面與 Google Drive 還原流程共用同一份邏輯 */
export function hasUnsavedLocalChanges(lastBackupAt?: string, lastLocalChangeAt?: string): boolean {
  return (
    lastLocalChangeAt !== undefined &&
    (lastBackupAt === undefined || new Date(lastLocalChangeAt) > new Date(lastBackupAt))
  );
}
