import {
  bindAccount,
  isEmptySnapshot,
  markClean,
  markPending,
  readLatestCloud,
  type CloudSnapshotInfo,
  type SyncActionDeps,
} from '@/lib/sync/actionDeps';
import { restoreSnapshot } from '@/lib/sync/restore';
import { saveCloudRestorePoint, serializeBackup } from '@/lib/sync/restorePoints';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { SYNC_LOCK } from '@/lib/sync/syncEngine';
import { isStale } from '@/lib/sync/syncState';

/**
 * 登入後下一步要做什麼：
 * - ready：已處理完（綁定好了），呼叫端開始同步
 * - chooseFirstLogin：本機與雲端都有資料，跳出首次登入對話框（reason 為 stale 時是超過 90 天沒同步的同帳號裝置）
 * - confirmOverwrite：未登入時還原過，跳出 3-3 比較畫面
 */
export type SignInPlan =
  | { kind: 'ready' }
  | { kind: 'chooseFirstLogin'; local: DataSnapshot; cloud: CloudSnapshotInfo; reason: 'firstLogin' | 'stale' }
  | { kind: 'confirmOverwrite'; local: DataSnapshot; cloud: CloudSnapshotInfo; restoredAt: string };

/**
 * 登入成功（或同步引擎回報 needsFirstLogin、stale）後判斷要怎麼處理本機資料。
 * 不需要使用者決定的情況直接綁定帳號並回傳 ready；本機有資料時標記待推送，確保第一次同步會上傳。
 * @param deps 動作依賴
 * @returns 下一步
 * @throws FormatTooNewError 雲端格式比程式新
 */
export async function inspectSignIn(deps: SyncActionDeps): Promise<SignInPlan> {
  return deps.withLock<SignInPlan>(SYNC_LOCK, async () => {
    const user = await deps.auth.getUser();
    const state = deps.state.read();
    const local = deps.local.read();

    if (state.pendingCloudOverwrite) {
      // 3-3：不走首次登入對話框、不比對帳號，一律與雲端比較
      const cloud = await readLatestCloud(deps.cloud);
      if (cloud && !isEmptySnapshot(cloud.snapshot)) {
        return { kind: 'confirmOverwrite', local, cloud, restoredAt: state.pendingCloudOverwrite.restoredAt };
      }
      bindAccount(deps, user.sub);
      markPending(deps.state);
      return { kind: 'ready' };
    }

    const stale = isStale(state, deps.now());
    if (state.boundSub === user.sub && !stale) {
      deps.localRestorePoint.clear();
      return { kind: 'ready' };
    }

    const cloud = await readLatestCloud(deps.cloud);
    const localHasData = !isEmptySnapshot(local);
    if (cloud && localHasData && !isEmptySnapshot(cloud.snapshot)) {
      return { kind: 'chooseFirstLogin', local, cloud, reason: state.boundSub === user.sub ? 'stale' : 'firstLogin' };
    }
    bindAccount(deps, user.sub);
    if (localHasData) markPending(deps.state);
    return { kind: 'ready' };
  });
}

/**
 * 改用雲端資料（首次登入選雲端卡片、3-3 選雲端）：本機資料先存成雲端還原點，再把本機換成雲端資料。
 * @param deps 動作依賴
 * @param cloud inspectSignIn 回傳的雲端內容
 */
export async function adoptCloudData(deps: SyncActionDeps, cloud: CloudSnapshotInfo): Promise<void> {
  await deps.withLock(SYNC_LOCK, async () => {
    const user = await deps.auth.getUser();
    await saveCloudRestorePoint(deps.cloud, serializeBackup(deps.local.read(), deps.now()));
    deps.local.write(cloud.snapshot);
    bindAccount(deps, user.sub, cloud);
    markClean(deps.state);
  });
}

/**
 * 合併兩邊的資料（首次登入的合併按鈕）：綁定帳號並標記待推送，下一次同步會下載雲端、合併、上傳。
 * @param deps 動作依賴
 */
export async function mergeBothData(deps: SyncActionDeps): Promise<void> {
  await deps.withLock(SYNC_LOCK, async () => {
    const user = await deps.auth.getUser();
    bindAccount(deps, user.sub);
    markPending(deps.state);
  });
}

/**
 * 3-3 選這台裝置：雲端資料先存成還原點，再以本機的還原結果完全取代雲端（不是合併），
 * 雲端多出的紀錄寫上墓碑，其他裝置同步時一起刪除。
 * @param deps 動作依賴
 * @param cloud inspectSignIn 回傳的雲端內容
 */
export async function keepRestoredVersion(deps: SyncActionDeps, cloud: CloudSnapshotInfo): Promise<void> {
  await deps.withLock(SYNC_LOCK, async () => {
    const user = await deps.auth.getUser();
    await saveCloudRestorePoint(deps.cloud, cloud.content);
    deps.local.write(restoreSnapshot(cloud.snapshot, deps.local.read(), deps.now(), deps.newId));
    bindAccount(deps, user.sub, cloud);
    markPending(deps.state);
  });
}
