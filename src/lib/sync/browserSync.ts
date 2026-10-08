import { authClient } from '@/lib/auth/browserAuthClient';
import type { SyncActionDeps } from '@/lib/sync/actionDeps';
import { createDriveCloudStore } from '@/lib/sync/cloud/driveCloudStore';
import { trackDataChanges } from '@/lib/sync/changeTracker';
import { storeRepo } from '@/lib/sync/localRepo';
import { createLocalStorageRestorePointStore } from '@/lib/sync/restorePoints';
import { createSyncEngine, type AppliedChanges, type SyncEngineDeps } from '@/lib/sync/syncEngine';
import { createSyncScheduler, type SyncScheduler, type SyncStatus, type SyncTriggers } from '@/lib/sync/syncScheduler';
import { createLocalStorageSyncState, isPending } from '@/lib/sync/syncState';
import { withWebLock } from '@/lib/webLocks';

/** 這台裝置的同步狀態（localStorage，同一台裝置的分頁共用） */
export const syncState = createLocalStorageSyncState();

const engineDeps: SyncEngineDeps = {
  cloud: createDriveCloudStore(authClient),
  local: storeRepo,
  state: syncState,
  auth: authClient,
  withLock: withWebLock,
  now: () => new Date(),
  newResetToken: () => crypto.randomUUID(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** 正式環境的同步引擎 */
export const syncEngine = createSyncEngine(engineDeps);

/** 未登入時的本機還原點 */
export const localRestorePoint = createLocalStorageRestorePointStore();

/** 登入、還原、刪除動作使用的依賴 */
export const syncActionDeps: SyncActionDeps = {
  ...engineDeps,
  engine: syncEngine,
  localRestorePoint,
  newId: () => crypto.randomUUID(),
  signOut: () => authClient.signOut(),
};

let scheduler: SyncScheduler | undefined;

// 使用者每修改一次資料，計數器 +1；有排程器時通知它準備推送。沒登入時照樣計數，首次登入時會一併處理
trackDataChanges(() => {
  syncState.update((current) => ({ changeCounter: current.changeCounter + 1 }));
  scheduler?.notifyLocalChange();
});

function listen(target: EventTarget, type: string, callback: () => void, when?: () => boolean): () => void {
  const handler = () => {
    if (!when || when()) callback();
  };
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}

/** 用 document 與 window 的事件提供同步觸發時機 */
function browserTriggers(): SyncTriggers {
  return {
    onVisible: (callback) => listen(document, 'visibilitychange', callback, () => document.visibilityState === 'visible'),
    onHidden: (callback) => listen(document, 'visibilitychange', callback, () => document.visibilityState === 'hidden'),
    onFocus: (callback) => listen(window, 'focus', callback),
    onOnline: (callback) => listen(window, 'online', callback),
  };
}

/**
 * 開始自動同步（已在同步時先停掉舊的排程器）。
 * @param handlers 狀態變化與套用其他裝置變更時的回呼
 * @returns 排程器，可呼叫 syncNow
 */
export function startSync(handlers: { onStatus: (status: SyncStatus) => void; onApplied: (changes: AppliedChanges) => void }): SyncScheduler {
  scheduler?.stop();
  scheduler = createSyncScheduler({
    engine: syncEngine,
    isPending: () => isPending(syncState.read()),
    triggers: browserTriggers(),
    onStatus: handlers.onStatus,
    onApplied: handlers.onApplied,
  });
  scheduler.start();
  return scheduler;
}

/** 停止自動同步（登出時） */
export function stopSync(): void {
  scheduler?.stop();
  scheduler = undefined;
}
