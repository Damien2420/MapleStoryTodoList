import { markPending, type SyncActionDeps } from '@/lib/sync/actionDeps';
import { LATEST_FILE } from '@/lib/sync/cloudDocument';
import { restoreSnapshot } from '@/lib/sync/restore';
import { saveCloudRestorePoint } from '@/lib/sync/restorePoints';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { SYNC_LOCK } from '@/lib/sync/syncEngine';

/** 已登入還原的結果：完成，或看比較畫面期間雲端被其他裝置改過（要重新同步並刷新比較畫面） */
export type SignedInRestoreResult = { kind: 'restored' } | { kind: 'cloudChanged' };

/**
 * 3-1 已登入時還原：使用者在比較畫面選了「要還原的資料」之後呼叫。
 * 先確認雲端 version 與開啟比較畫面時相同，再把目前雲端資料存成還原點，以還原內容完全取代本機並標記待推送。
 * @param deps 動作依賴
 * @param target 要還原成的資料
 * @param expectedVersion 開啟比較畫面前同步完時的雲端 version（state.lastVersion）
 * @returns 還原結果
 */
export async function restoreSignedIn(
  deps: SyncActionDeps,
  target: DataSnapshot,
  expectedVersion: string | undefined,
): Promise<SignedInRestoreResult> {
  return deps.withLock<SignedInRestoreResult>(SYNC_LOCK, async () => {
    const [head] = await deps.cloud.findFiles(LATEST_FILE);
    if (head?.version !== expectedVersion) return { kind: 'cloudChanged' };
    if (head) await saveCloudRestorePoint(deps.cloud, await deps.cloud.download(head.id));
    deps.local.write(restoreSnapshot(deps.local.read(), target, deps.now(), deps.newId));
    markPending(deps.state);
    return { kind: 'restored' };
  });
}

/**
 * 3-2 未登入時還原：目前本機資料存成本機還原點，以還原內容完全取代本機，並記下待覆蓋雲端與還原時間，
 * 之後登入時走 3-3 讓使用者決定雲端要用哪一份。
 * @param deps 動作依賴（只需要本機相關的部分）
 * @param target 要還原成的資料
 */
export function restoreSignedOut(
  deps: Pick<SyncActionDeps, 'local' | 'state' | 'localRestorePoint' | 'now' | 'newId'>,
  target: DataSnapshot,
): void {
  const now = deps.now();
  const current = deps.local.read();
  deps.localRestorePoint.save(current, now);
  deps.local.write(restoreSnapshot(current, target, now, deps.newId));
  deps.state.update({ pendingCloudOverwrite: { restoredAt: now.toISOString() } });
}
