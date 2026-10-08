import { buildBackupPayload } from '@/lib/backupPayload';
import type { CloudStore } from '@/lib/sync/cloud/cloudStore';
import { upsertFile } from '@/lib/sync/cloudFiles';
import { RESTORE_POINT_FILE, parseCloudDocument } from '@/lib/sync/cloudDocument';
import type { DataSnapshot } from '@/lib/sync/snapshot';

/** 未登入時的本機還原點；登入流程處理完就刪除 */
export const LOCAL_RESTORE_POINT_KEY = 'maplestory-todolist-restore-point';

/** 一份存下來的資料與它的存檔時間（還原點、每日快照、備份檔案共用） */
export interface SavedSnapshot {
  savedAt: string;
  snapshot: DataSnapshot;
}

/** 本機還原點的讀寫介面；只保留一份，新的取代舊的 */
export interface LocalRestorePointStore {
  save(snapshot: DataSnapshot, now: Date): void;
  read(): SavedSnapshot | undefined;
  clear(): void;
}

/**
 * 把資料序列化成一般備份格式（與「下載備份檔案」相同，可以直接匯入），createdAt 為存檔時間。
 * @param snapshot 要保存的資料
 * @param now 存檔時間
 */
export function serializeBackup(snapshot: DataSnapshot, now: Date): string {
  return JSON.stringify({ ...buildBackupPayload(snapshot), createdAt: now.toISOString() }, null, 2);
}

/**
 * 解析還原點、每日快照或備份檔案的內容。
 * @param content 檔案內容
 * @returns 存檔時間與資料；內容損毀或格式比程式新時回傳 undefined
 */
export function parseSavedSnapshot(content: string): SavedSnapshot | undefined {
  try {
    const raw = JSON.parse(content) as { createdAt?: unknown };
    return {
      savedAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      snapshot: parseCloudDocument(content).snapshot,
    };
  } catch {
    return undefined;
  }
}

/**
 * 存在 localStorage 的本機還原點。
 * @param storage 測試時可替換
 * @param key localStorage key
 */
export function createLocalStorageRestorePointStore(
  storage: Storage = localStorage,
  key: string = LOCAL_RESTORE_POINT_KEY,
): LocalRestorePointStore {
  return {
    save: (snapshot, now) => storage.setItem(key, serializeBackup(snapshot, now)),
    read: () => {
      const content = storage.getItem(key);
      return content === null ? undefined : parseSavedSnapshot(content);
    },
    clear: () => storage.removeItem(key),
  };
}

/** 記憶體版的本機還原點，供測試模擬各台裝置 */
export function createMemoryRestorePointStore(): LocalRestorePointStore {
  let saved: SavedSnapshot | undefined;
  return {
    save: (snapshot, now) => {
      saved = { savedAt: now.toISOString(), snapshot };
    },
    read: () => saved,
    clear: () => {
      saved = undefined;
    },
  };
}

/**
 * 寫入雲端還原點（只保留一份）。
 * @param cloud 雲端存取介面
 * @param content 要保存的內容（雲端主檔原文或 serializeBackup 的輸出）
 */
export async function saveCloudRestorePoint(cloud: CloudStore, content: string): Promise<void> {
  await upsertFile(cloud, RESTORE_POINT_FILE, content);
}

/**
 * 讀取雲端上的還原點或每日快照。
 * @param cloud 雲端存取介面
 * @param name RESTORE_POINT_FILE 或 DAILY_SNAPSHOT_FILE
 * @returns 存檔時間與資料；檔案不存在或無法解析時回傳 undefined
 */
export async function readCloudSavedSnapshot(cloud: CloudStore, name: string): Promise<SavedSnapshot | undefined> {
  const [file] = await cloud.findFiles(name);
  if (!file) return undefined;
  return parseSavedSnapshot(await cloud.download(file.id));
}
