import { format } from 'date-fns';
import { AuthError, type AuthUser } from '@/lib/auth/authClient';
import { CloudError, type CloudFileMeta, type CloudStore } from '@/lib/sync/cloud/cloudStore';
import { upsertFile } from '@/lib/sync/cloudFiles';
import {
  DAILY_SNAPSHOT_FILE,
  FormatTooNewError,
  LATEST_FILE,
  parseCloudDocument,
  serializeCloudDocument,
  type CloudDocument,
} from '@/lib/sync/cloudDocument';
import type { LocalRepo } from '@/lib/sync/localRepo';
import { TOMBSTONE_RETENTION_DAYS, mergeSnapshots, pruneSnapshot, type DataSnapshot } from '@/lib/sync/snapshot';
import { describeOverwrite, type OverwriteImpact } from '@/lib/sync/snapshotSummary';
import { isPending, isStale, type SyncStateStore } from '@/lib/sync/syncState';

/** 跨分頁同步鎖：同一時間只有一個分頁跟雲端同步 */
export const SYNC_LOCK = 'mstd-sync';
/** 上傳後發現中間有其他寫入時，合併後重新上傳的總次數上限 */
const MAX_UPLOAD_ATTEMPTS = 3;
/** 重新上傳前的等待時間基數，每次加倍（500ms、1000ms） */
const CONFLICT_BACKOFF_MS = 500;

/** 同步引擎的外部依賴，全部以介面注入，測試時用假實作模擬多台裝置 */
export interface SyncEngineDeps {
  cloud: CloudStore;
  local: LocalRepo;
  state: SyncStateStore;
  auth: { getUser(): Promise<AuthUser> };
  withLock: <T>(name: string, task: () => Promise<T>) => Promise<T>;
  now: () => Date;
  newResetToken: () => string;
  sleep: (ms: number) => Promise<void>;
}

/**
 * 一輪同步的結果，由排程器決定接下來的狀態與動作：
 * - synced：完成；applied 是這輪合併進本機的其他裝置變更
 * - retryLater：稍後重試；offline 為網路或雲端暫時錯誤，conflict 為多次被其他寫入搶先（本機已合併，仍是待推送）
 * - reconnectRequired：Google 授權失效；signedOut：沒有登入
 * - needsFirstLogin：本機沒有綁定這個帳號；stale：超過墓碑保留天數沒同步（兩者都交給首次登入流程）
 * - resetDetected：雲端已被「刪除所有紀錄」重置；formatTooNew：雲端格式比程式新
 */
export type SyncOutcome =
  | { kind: 'synced'; applied?: AppliedChanges }
  | { kind: 'retryLater'; reason: 'offline' | 'conflict'; applied?: AppliedChanges }
  | { kind: 'reconnectRequired' }
  | { kind: 'signedOut' }
  | { kind: 'needsFirstLogin' }
  | { kind: 'stale' }
  | { kind: 'resetDetected' }
  | { kind: 'formatTooNew' };

/** 同步引擎：一次呼叫跑完一輪拉取、合併、推送 */
export interface SyncEngine {
  syncOnce(): Promise<SyncOutcome>;
}

/**
 * 這輪合併進本機的雲端變更，以角色為單位（使用者看不懂任務、BOSS 的筆數）。
 * 跟著新角色進來、或跟著被刪角色消失的任務與 BOSS 不另外列出。
 */
export type AppliedChanges = Omit<OverwriteImpact, 'newerCharacterNames'>;

/** 有沒有使用者看得到的變更，決定要不要顯示「已從雲端同步」 */
export function hasVisibleChanges(changes: AppliedChanges | undefined): boolean {
  if (!changes) return false;
  return (
    changes.addedCharacterNames.length + changes.removedCharacterNames.length + changes.changedCharacterNames.length > 0 ||
    changes.accountsChanged
  );
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** 合併同一輪多次套用的變更；先加入後又有更新的角色只算加入 */
function addChanges(a: AppliedChanges | undefined, b: AppliedChanges): AppliedChanges {
  if (!a) return b;
  const added = union(a.addedCharacterNames, b.addedCharacterNames);
  return {
    addedCharacterNames: added,
    removedCharacterNames: union(a.removedCharacterNames, b.removedCharacterNames),
    changedCharacterNames: union(a.changedCharacterNames, b.changedCharacterNames).filter((name) => !added.includes(name)),
    accountsChanged: a.accountsChanged || b.accountsChanged,
  };
}

function toOutcome(error: unknown): SyncOutcome {
  if (error instanceof FormatTooNewError) return { kind: 'formatTooNew' };
  if (error instanceof AuthError) {
    if (error.code === 'reconnectRequired') return { kind: 'reconnectRequired' };
    if (error.code === 'signedOut') return { kind: 'signedOut' };
    return { kind: 'retryLater', reason: 'offline' };
  }
  if (error instanceof CloudError) {
    return error.kind === 'unauthorized' ? { kind: 'reconnectRequired' } : { kind: 'retryLater', reason: 'offline' };
  }
  throw error;
}

/**
 * 建立同步引擎。規則依 spec「2-5 同步循環」與「實作必守規則」：
 * 1. 雲端 version 變了才下載；內容的 resetToken 與本機不同就停下（重置），格式比程式新就停下
 * 2. 讀取當下本機資料 → 純函式合併 → 一次寫回，中間沒有 await
 * 3. 有待推送（或需要整併同名檔、補 resetToken）才上傳；當天第一次上傳前先存每日快照
 * 4. 上傳後列出歷史版本：自己這筆之前若有不是上傳前記下的那筆，就是中間有其他裝置寫入，
 *    下載那些版本合併後重新上傳（上限 3 次）；中間那筆是重置或較新格式時，把它還原回雲端後停下
 * @param deps 外部依賴
 * @returns SyncEngine 實例
 */
export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const today = () => format(deps.now(), 'yyyy-MM-dd');

  function applyRemote(remote: DataSnapshot): AppliedChanges {
    // 讀取當下本機資料 → 合併 → 寫回，三步之間不能有 await，否則使用者在等待期間的修改會被蓋掉
    const before = deps.local.read();
    const { merged } = mergeSnapshots(before, remote);
    deps.local.write(merged);
    // 比較合併前後的本機資料，得到這次實際套用了哪些角色的變更
    const { addedCharacterNames, removedCharacterNames, changedCharacterNames, accountsChanged } = describeOverwrite(before, merged);
    return { addedCharacterNames, removedCharacterNames, changedCharacterNames, accountsChanged };
  }

  function packLocal(resetToken: string, dailySnapshotDate: string | undefined): string {
    const pruned = pruneSnapshot(deps.local.read(), TOMBSTONE_RETENTION_DAYS, deps.now());
    deps.local.write(pruned);
    return serializeCloudDocument({ snapshot: pruned, resetToken, dailySnapshotDate });
  }

  function markSynced(meta: CloudFileMeta, resetToken: string, dailySnapshotDate: string | undefined, syncedCounter?: number): void {
    deps.state.update({
      lastVersion: meta.version,
      lastRevisionId: meta.headRevisionId,
      resetToken,
      dailySnapshotDate,
      lastSyncedAt: deps.now().toISOString(),
      ...(syncedCounter === undefined ? {} : { syncedCounter }),
    });
  }

  async function downloadRevisionIfExists(fileId: string, revisionId: string): Promise<string | undefined> {
    try {
      return await deps.cloud.downloadRevision(fileId, revisionId);
    } catch (error) {
      if (error instanceof CloudError && error.kind === 'notFound') return undefined;
      throw error;
    }
  }

  async function deleteIfExists(fileId: string): Promise<void> {
    try {
      await deps.cloud.delete(fileId);
    } catch (error) {
      if (!(error instanceof CloudError && error.kind === 'notFound')) throw error;
    }
  }

  /** 中間版本是重置或較新格式：把它寫回雲端（剛才的上傳蓋掉了它），並讓下次同步重新下載 */
  async function restoreIntermediate(fileId: string, content: string): Promise<void> {
    await deps.cloud.update(fileId, content);
    deps.state.update({ lastVersion: undefined, lastRevisionId: undefined });
  }

  async function createCloudFile(): Promise<SyncOutcome> {
    const start = deps.state.read();
    const resetToken = start.resetToken ?? deps.newResetToken();
    const packed = start.changeCounter;
    const created = await deps.cloud.create(LATEST_FILE, packLocal(resetToken, start.dailySnapshotDate));
    const [oldest] = await deps.cloud.findFiles(LATEST_FILE);
    if (oldest && oldest.id !== created.id) {
      // 另一台裝置幾乎同時建立了主檔：以最早建立的為準，刪掉自己這份、改用它的 resetToken，再合併上傳
      await deps.cloud.delete(created.id);
      deps.state.update({ resetToken: undefined, lastVersion: undefined, lastRevisionId: undefined });
      return runCycle(true);
    }
    markSynced(created, resetToken, start.dailySnapshotDate, packed);
    return { kind: 'synced' };
  }

  async function uploadAndVerify(
    head: CloudFileMeta,
    extras: CloudFileMeta[],
    resetToken: string,
    dailySnapshotDate: string | undefined,
    appliedBefore: AppliedChanges | undefined,
  ): Promise<SyncOutcome> {
    let applied = appliedBefore;
    let base = head.headRevisionId;
    for (let attempt = 1; ; attempt++) {
      const packed = deps.state.read().changeCounter;
      const uploaded = await deps.cloud.update(head.id, packLocal(resetToken, dailySnapshotDate));
      const revisions = await deps.cloud.listRevisions(head.id);
      const mine = revisions.lastIndexOf(uploaded.headRevisionId);
      if (mine < 0) return { kind: 'retryLater', reason: 'conflict', applied };

      const baseIndex = revisions.indexOf(base);
      // 上傳前記下的那筆還在：它與自己這筆之間的都是其他裝置的寫入；已被 Drive 清掉時只能看自己的前一筆
      const intermediates =
        baseIndex >= 0 && baseIndex < mine ? revisions.slice(baseIndex + 1, mine) : mine > 0 ? [revisions[mine - 1]] : [];

      if (intermediates.length === 0) {
        markSynced(uploaded, resetToken, dailySnapshotDate, packed);
        for (const extra of extras) await deleteIfExists(extra.id);
        return { kind: 'synced', applied };
      }

      for (const revisionId of intermediates) {
        const content = await downloadRevisionIfExists(head.id, revisionId);
        if (content === undefined) continue;
        let doc: CloudDocument;
        try {
          doc = parseCloudDocument(content);
        } catch (error) {
          if (!(error instanceof FormatTooNewError)) throw error;
          await restoreIntermediate(head.id, content);
          return { kind: 'formatTooNew' };
        }
        if (doc.resetToken !== undefined && doc.resetToken !== resetToken) {
          // 中間那筆是其他裝置「刪除所有紀錄」後的新雲端，剛才的上傳把它蓋掉了：先還原回去，再交給使用者決定
          await restoreIntermediate(head.id, content);
          return { kind: 'resetDetected' };
        }
        applied = addChanges(applied, applyRemote(doc.snapshot));
      }

      if (attempt >= MAX_UPLOAD_ATTEMPTS) return { kind: 'retryLater', reason: 'conflict', applied };
      await deps.sleep(CONFLICT_BACKOFF_MS * 2 ** (attempt - 1));
      base = uploaded.headRevisionId;
    }
  }

  async function runCycle(forceUpload: boolean): Promise<SyncOutcome> {
    const start = deps.state.read();
    const files = await deps.cloud.findFiles(LATEST_FILE);
    if (files.length === 0) return createCloudFile();
    const [head, ...extras] = files;

    let applied: AppliedChanges | undefined;
    let cloudContent: string | undefined;
    let resetToken = start.resetToken;
    let dailySnapshotDate = start.dailySnapshotDate;
    let needsUpload = forceUpload || extras.length > 0;

    if (head.version !== start.lastVersion || extras.length > 0) {
      cloudContent = await deps.cloud.download(head.id);
      const doc = parseCloudDocument(cloudContent);
      if (doc.resetToken !== undefined && resetToken !== undefined && doc.resetToken !== resetToken) {
        return { kind: 'resetDetected' };
      }
      // 舊版檔案沒有 resetToken：照常合併，上傳時補上
      if (doc.resetToken === undefined) needsUpload = true;
      resetToken = doc.resetToken ?? resetToken;
      if (doc.dailySnapshotDate && (!dailySnapshotDate || doc.dailySnapshotDate > dailySnapshotDate)) {
        dailySnapshotDate = doc.dailySnapshotDate;
      }
      applied = applyRemote(doc.snapshot);
      for (const extra of extras) {
        // 同名主檔（兩台裝置同時建立、或舊版殘留）：內容一律合併進來，上傳成功後刪除
        const extraDoc = parseCloudDocument(await deps.cloud.download(extra.id));
        applied = addChanges(applied, applyRemote(extraDoc.snapshot));
      }
    }

    const token = resetToken ?? deps.newResetToken();
    if (!needsUpload && !isPending(deps.state.read())) {
      markSynced(head, token, dailySnapshotDate);
      return { kind: 'synced', applied };
    }

    if (dailySnapshotDate !== today()) {
      // 每日快照是「今天第一次修改雲端之前」的雲端內容；這輪沒下載過就補下載一次
      cloudContent ??= await deps.cloud.download(head.id);
      await upsertFile(deps.cloud, DAILY_SNAPSHOT_FILE, cloudContent);
      dailySnapshotDate = today();
    }
    return uploadAndVerify(head, extras, token, dailySnapshotDate, applied);
  }

  async function syncOnce(): Promise<SyncOutcome> {
    return deps.withLock<SyncOutcome>(SYNC_LOCK, async () => {
      try {
        const user = await deps.auth.getUser();
        const state = deps.state.read();
        if (state.boundSub !== user.sub) return { kind: 'needsFirstLogin' };
        if (isStale(state, deps.now())) return { kind: 'stale' };
        return await runCycle(false);
      } catch (error) {
        return toOutcome(error);
      }
    });
  }

  return { syncOnce };
}
