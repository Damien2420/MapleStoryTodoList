import { createEmptySnapshot, readLatestCloud, type SyncActionDeps } from '@/lib/sync/actionDeps';
import { LATEST_FILE, serializeCloudDocument } from '@/lib/sync/cloudDocument';
import { saveCloudRestorePoint, serializeBackup } from '@/lib/sync/restorePoints';
import { SYNC_LOCK, type SyncOutcome } from '@/lib/sync/syncEngine';
import { isPending } from '@/lib/sync/syncState';

/** 刪除本機紀錄的結果；推送失敗時什麼都沒刪 */
export type DeleteLocalResult = { kind: 'deleted' } | { kind: 'pushFailed'; outcome: SyncOutcome };

/**
 * 已登入時的「刪除本機紀錄」（重置這台裝置）：先推送還沒推送的修改，再登出，最後清空本機資料、同步狀態與本機還原點。
 * 推送失敗（或推送期間又有新修改）時不登出也不清空，避免還沒同步的修改永久遺失。
 * @param deps 動作依賴
 * @returns 結果
 */
export async function deleteLocalRecords(deps: SyncActionDeps): Promise<DeleteLocalResult> {
  if (isPending(deps.state.read())) {
    const outcome = await deps.engine.syncOnce();
    if (outcome.kind !== 'synced' || isPending(deps.state.read())) return { kind: 'pushFailed', outcome };
  }
  await deps.signOut();
  await deps.withLock(SYNC_LOCK, async () => {
    deps.local.write(createEmptySnapshot());
    deps.state.clear();
    deps.localRestorePoint.clear();
  });
  return { kind: 'deleted' };
}

/**
 * 未登入時的「刪除本機紀錄」：只清空資料，保留墓碑與同步狀態（與舊版「刪除全部」相同），
 * 避免無聲撤銷先前做過、但還沒同步出去的刪除。
 * @param deps 動作依賴（只需要本機資料）
 */
export function clearLocalDataSignedOut(deps: Pick<SyncActionDeps, 'local'>): void {
  const current = deps.local.read();
  deps.local.write({
    ...createEmptySnapshot(),
    accountTombstones: current.accountTombstones,
    characterTombstones: current.characterTombstones,
    taskTombstones: current.taskTombstones,
    bossTombstones: current.bossTombstones,
    weapons: { ...createEmptySnapshot().weapons, tombstones: current.weapons.tombstones },
  });
}

/**
 * 「刪除所有紀錄」（全部重置）：目前雲端資料先存成還原點，雲端換成空資料並產生新的 resetToken，
 * 清空本機並記下新的 resetToken，維持登入。其他裝置下次同步時會跳出重置對話框。
 * @param deps 動作依賴
 */
export async function deleteAllRecords(deps: SyncActionDeps): Promise<void> {
  await deps.withLock(SYNC_LOCK, async () => {
    const [head] = await deps.cloud.findFiles(LATEST_FILE);
    if (head) await saveCloudRestorePoint(deps.cloud, await deps.cloud.download(head.id));
    const resetToken = deps.newResetToken();
    const content = serializeCloudDocument({
      snapshot: createEmptySnapshot(),
      resetToken,
      dailySnapshotDate: deps.state.read().dailySnapshotDate,
    });
    const meta = head ? await deps.cloud.update(head.id, content) : await deps.cloud.create(LATEST_FILE, content);
    deps.local.write(createEmptySnapshot());
    deps.state.update((current) => ({
      resetToken,
      lastVersion: meta.version,
      lastRevisionId: meta.headRevisionId,
      syncedCounter: current.changeCounter,
      lastSyncedAt: deps.now().toISOString(),
    }));
  });
}

/**
 * 重置對話框的「重置此裝置」：清空本機（不建立還原點）並改用雲端目前的 resetToken，
 * 下一次同步會下載雲端內容，恢復正常同步。
 * @param deps 動作依賴
 */
export async function resetThisDevice(deps: SyncActionDeps): Promise<void> {
  await deps.withLock(SYNC_LOCK, async () => {
    const cloud = await readLatestCloud(deps.cloud);
    deps.local.write(createEmptySnapshot());
    deps.state.update((current) => ({
      resetToken: cloud?.resetToken,
      lastVersion: undefined,
      lastRevisionId: undefined,
      syncedCounter: current.changeCounter,
    }));
  });
}

/**
 * 重大操作（刪除角色或帳號）前建立還原點：已登入存 Drive，未登入存 localStorage。
 * @param deps 動作依賴
 * @param where 存到雲端或本機
 */
export async function saveRestorePoint(deps: SyncActionDeps, where: 'cloud' | 'local'): Promise<void> {
  const snapshot = deps.local.read();
  if (where === 'local') {
    deps.localRestorePoint.save(snapshot, deps.now());
    return;
  }
  await saveCloudRestorePoint(deps.cloud, serializeBackup(snapshot, deps.now()));
}
