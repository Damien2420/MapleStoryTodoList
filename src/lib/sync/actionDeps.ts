import type { CloudStore } from '@/lib/sync/cloud/cloudStore';
import { LATEST_FILE, parseCloudDocument } from '@/lib/sync/cloudDocument';
import type { LocalRestorePointStore } from '@/lib/sync/restorePoints';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import type { SyncEngine, SyncEngineDeps } from '@/lib/sync/syncEngine';
import type { SyncStateStore } from '@/lib/sync/syncState';

/** 登入、還原、刪除動作的外部依賴：同步引擎的依賴，再加上引擎本身、本機還原點、id 產生器與登出 */
export interface SyncActionDeps extends SyncEngineDeps {
  engine: SyncEngine;
  localRestorePoint: LocalRestorePointStore;
  /** 產生資料 id（還原時替被刪除過的紀錄換 id） */
  newId: () => string;
  /** 登出（正式環境是 authClient.signOut） */
  signOut: () => Promise<void>;
}

/** 下載下來的雲端主檔：比較畫面顯示用，也是選擇後要套用的內容 */
export interface CloudSnapshotInfo {
  fileId: string;
  version: string;
  resetToken?: string;
  snapshot: DataSnapshot;
  /** 檔案原文，存成雲端還原點時直接使用 */
  content: string;
}

/** 沒有任何資料與墓碑的快照 */
export function createEmptySnapshot(): DataSnapshot {
  return {
    accounts: [],
    accountTombstones: [],
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
  };
}

/** 四類資料都沒有任何一筆（墓碑不算資料） */
export function isEmptySnapshot(snapshot: DataSnapshot): boolean {
  return snapshot.accounts.length + snapshot.characters.length + snapshot.tasks.length + snapshot.bosses.length === 0;
}

/**
 * 下載雲端主檔（最早建立的那個）。
 * @returns 雲端內容；沒有主檔時回傳 undefined
 * @throws FormatTooNewError 雲端格式比程式新
 */
export async function readLatestCloud(cloud: CloudStore): Promise<CloudSnapshotInfo | undefined> {
  const [head] = await cloud.findFiles(LATEST_FILE);
  if (!head) return undefined;
  const content = await cloud.download(head.id);
  const doc = parseCloudDocument(content);
  return { fileId: head.id, version: head.version, resetToken: doc.resetToken, snapshot: doc.snapshot, content };
}

/**
 * 把本機資料綁定到帳號，登入流程到此處理完：清掉待覆蓋雲端標記與本機還原點。
 * @param cloud 已經與雲端一致時傳入雲端的 version 與 resetToken（之後同步不需要再下載）；否則下次同步會重新下載合併
 */
export function bindAccount(
  deps: SyncActionDeps,
  sub: string,
  cloud?: Pick<CloudSnapshotInfo, 'version' | 'resetToken'>,
): void {
  deps.state.update({
    boundSub: sub,
    resetToken: cloud?.resetToken,
    lastVersion: cloud?.version,
    lastRevisionId: undefined,
    lastSyncedAt: deps.now().toISOString(),
    pendingCloudOverwrite: undefined,
  });
  deps.localRestorePoint.clear();
}

/** 讓下一次同步一定上傳本機資料 */
export function markPending(state: SyncStateStore): void {
  state.update((current) => ({ changeCounter: current.changeCounter + 1 }));
}

/** 本機資料已經與雲端一致，沒有需要上傳的修改 */
export function markClean(state: SyncStateStore): void {
  state.update((current) => ({ syncedCounter: current.changeCounter }));
}
