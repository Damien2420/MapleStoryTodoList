import { useSettingsStore } from '@/store/useSettingsStore';
import { hasUnsavedLocalChanges } from '@/lib/backupStatus';

export interface BackupStatus {
  lastBackupAt?: string;
  neverBackedUp: boolean;
  hasUnsavedChanges: boolean;
}

/** 衍生「有沒有備份過」「備份後本機資料是否又有變動」的狀態,主畫面狀態列與備份頁面共用同一份判斷邏輯 */
export function useBackupStatus(): BackupStatus {
  const lastBackupAt = useSettingsStore((s) => s.lastBackupAt);
  const lastLocalChangeAt = useSettingsStore((s) => s.lastLocalChangeAt);

  return {
    lastBackupAt,
    neverBackedUp: lastBackupAt === undefined,
    hasUnsavedChanges: hasUnsavedLocalChanges(lastBackupAt, lastLocalChangeAt),
  };
}
