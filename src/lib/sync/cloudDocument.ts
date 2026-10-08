import { CURRENT_VERSION, buildBackupPayload, migrateToLatest } from '@/lib/backupPayload';
import { snapshotFromPayload, type DataSnapshot } from '@/lib/sync/snapshot';

/** 雲端主檔：登入後所有裝置以它為準 */
export const LATEST_FILE = 'backup-latest.json';
/** 每日快照：每天第一次上傳前，把當時的雲端內容存一份 */
export const DAILY_SNAPSHOT_FILE = 'daily-snapshot.json';
/** 雲端還原點：重大操作前存一份 */
export const RESTORE_POINT_FILE = 'restore-point.json';
/** 舊版的「上一次備份」，由每日快照取代，新版會刪除它 */
export const LEGACY_PREVIOUS_FILE = 'backup-previous.json';

/**
 * 雲端主檔的內容：資料快照，加上兩個同步用的欄位。
 * resetToken 只在「刪除所有紀錄」時換新，用來偵測雲端被重置；舊版檔案沒有這個欄位。
 * dailySnapshotDate 是最後一次建立每日快照的日期，讓所有裝置知道今天的快照已經有了。
 */
export interface CloudDocument {
  snapshot: DataSnapshot;
  resetToken?: string;
  dailySnapshotDate?: string;
}

/** 雲端資料由較新版本的程式建立：舊分頁必須中止同步並提示重新整理，絕不能用舊格式上傳 */
export class FormatTooNewError extends Error {
  constructor() {
    super('雲端資料由較新版本的程式建立，請重新整理頁面載入新版');
    this.name = 'FormatTooNewError';
  }
}

/**
 * 解析雲端檔案內容。較舊的格式會先升級到目前版本。
 * @param content 檔案內容（JSON 字串）
 * @returns 快照與同步欄位
 * @throws FormatTooNewError 格式版本比程式新；SyntaxError 內容不是合法 JSON
 */
export function parseCloudDocument(content: string): CloudDocument {
  const raw = JSON.parse(content) as { version: number; resetToken?: unknown; dailySnapshotDate?: unknown };
  if (raw.version > CURRENT_VERSION) throw new FormatTooNewError();
  return {
    snapshot: snapshotFromPayload(migrateToLatest(raw)),
    resetToken: typeof raw.resetToken === 'string' ? raw.resetToken : undefined,
    dailySnapshotDate: typeof raw.dailySnapshotDate === 'string' ? raw.dailySnapshotDate : undefined,
  };
}

/**
 * 把快照與同步欄位序列化成雲端檔案內容（目前版本的備份格式，另外附上 resetToken 與 dailySnapshotDate）。
 * @param doc 要寫入的內容；上傳時一定要有 resetToken
 * @returns JSON 字串
 */
export function serializeCloudDocument(doc: CloudDocument & { resetToken: string }): string {
  return JSON.stringify(
    { ...buildBackupPayload(doc.snapshot), resetToken: doc.resetToken, dailySnapshotDate: doc.dailySnapshotDate },
    null,
    2,
  );
}
