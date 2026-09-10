/** 判斷「備份後本機資料是否又有變動」,主畫面狀態列、備份頁面與 Google Drive 還原流程共用同一份邏輯 */
export function hasUnsavedLocalChanges(lastBackupAt?: string, lastLocalChangeAt?: string): boolean {
  return (
    lastLocalChangeAt !== undefined &&
    (lastBackupAt === undefined || new Date(lastLocalChangeAt) > new Date(lastBackupAt))
  );
}

/** 判斷本機資料距上次備份是否已經超過門檻天數,備份頁面用來決定要不要跳出「可能過時」的警告 */
export function isBackupStale(lastBackupAt: string | undefined, thresholdDays = 30): boolean {
  if (lastBackupAt === undefined) return false;
  const daysSince = (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > thresholdDays;
}
