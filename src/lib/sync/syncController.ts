import { createStore, type StoreApi } from 'zustand/vanilla';
import { AuthError, type AuthClient, type AuthUser } from '@/lib/auth/authClient';
import type { CloudSnapshotInfo, SyncActionDeps } from '@/lib/sync/actionDeps';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { DAILY_SNAPSHOT_FILE, FormatTooNewError, RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import { clearLocalDataSignedOut, deleteAllRecords, deleteLocalRecords, resetThisDevice, saveRestorePoint } from '@/lib/sync/deleteActions';
import { restoreSignedIn, restoreSignedOut } from '@/lib/sync/restoreActions';
import { readCloudSavedSnapshot } from '@/lib/sync/restorePoints';
import { adoptCloudData, inspectSignIn, keepRestoredVersion, mergeBothData } from '@/lib/sync/signInActions';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import type { AppliedChanges } from '@/lib/sync/syncEngine';
import type { SyncScheduler, SyncStatus } from '@/lib/sync/syncScheduler';
import { isPending } from '@/lib/sync/syncState';
import { describeSyncError } from '@/lib/sync/syncText';

/** 畫面看到的登入狀態；開機恢復登入失敗但仍綁定帳號時，user 可能暫時是 undefined */
export type AuthView = { kind: 'checking' } | { kind: 'signedOut' } | { kind: 'signedIn'; user?: AuthUser };

/** 還原來源的種類 */
export type RestoreSourceKind = 'file' | 'localRestorePoint' | 'cloudRestorePoint' | 'dailySnapshot';

/** 還原來源的種類與存檔時間（比較畫面卡片標題用） */
export interface RestoreSourceInfo {
  kind: RestoreSourceKind;
  savedAt: string;
}

/** 資料管理頁列出的還原來源 */
export interface RestoreSource extends RestoreSourceInfo {
  snapshot: DataSnapshot;
}

/** 全站對話框；同一時間最多一個 */
export type SyncDialog =
  | { kind: 'firstLogin'; reason: 'firstLogin' | 'stale'; local: DataSnapshot; cloud: CloudSnapshotInfo }
  | { kind: 'confirmOverwrite'; restoredAt: string; local: DataSnapshot; cloud: CloudSnapshotInfo }
  | {
      kind: 'restore';
      mode: 'signedIn' | 'signedOut';
      source: RestoreSourceInfo;
      current: DataSnapshot;
      target: DataSnapshot;
      /** 已登入時，開啟比較畫面前同步完的雲端 version */
      expectedVersion?: string;
      /** 選版本時發現雲端被更新、已重新比較 */
      refreshed: boolean;
    }
  | { kind: 'reset' }
  | { kind: 'formatTooNew' };

/** 控制器的狀態，畫面以 useSyncView 訂閱 */
export interface SyncViewState {
  auth: AuthView;
  status?: SyncStatus;
  lastSyncedAt?: string;
  dialog?: SyncDialog;
  /** 登入、對話框選擇、還原、刪除進行中；期間其他動作一律忽略 */
  busy: boolean;
  /**
   * 登入（或開網頁恢復登入）後，第一輪同步還沒結束：正在確認雲端並載入資料。
   * 第一次回報非同步中的狀態、跳出對話框、發生錯誤或登出時解除；之後的定期同步不會再設回 true。
   */
  initialSyncPending: boolean;
}

/** 控制器的外部依賴 */
export interface SyncControllerDeps {
  auth: Pick<AuthClient, 'signIn' | 'getUser' | 'signOut'>;
  actions: SyncActionDeps;
  /** 啟動自動同步（已在執行時先停掉舊的） */
  startSync(handlers: { onStatus: (status: SyncStatus) => void; onApplied: (changes: AppliedChanges) => void }): SyncScheduler;
  stopSync(): void;
  notify: {
    applied(changes: AppliedChanges): void;
    error(message: string): void;
    success(message: string): void;
  };
}

/** 畫面與同步模組之間唯一的介面 */
export interface SyncController {
  readonly store: StoreApi<SyncViewState>;
  /** 開啟網站時恢復登入：有登入 cookie 就繼續同步，沒有就顯示未登入 */
  boot(): Promise<void>;
  /** 開啟 Google 登入視窗；需要重新連線時也用這個 */
  signIn(): Promise<void>;
  /** 先推送還沒推送的修改再登出；本機資料保留 */
  signOut(): Promise<void>;
  /** 立即同步；還沒開始同步（例如先前連不上）時重新跑登入檢查 */
  syncNow(): Promise<void>;
  /** 首次登入或 3-3 選雲端資料 */
  chooseCloud(): Promise<void>;
  /** 首次登入選合併兩邊的資料 */
  chooseMerge(): Promise<void>;
  /** 3-3 選這台裝置的還原結果 */
  chooseDevice(): Promise<void>;
  /**
   * 關閉目前的對話框。
   * 還原比較與格式較新只是關閉；首次登入、3-3 等於這次不登入；重置等於不重置並登出。
   */
  dismissDialog(): Promise<void>;
  /** 重置對話框選「重置此裝置」 */
  resetDevice(): Promise<void>;
  /** 開啟還原比較畫面；已登入時先同步取得雲端最新版本 */
  startRestore(target: DataSnapshot, source: RestoreSourceInfo): Promise<void>;
  /** 比較畫面選「要還原的資料」 */
  confirmRestore(): Promise<void>;
  /** 刪除本機紀錄；完成時回傳 true（推送失敗等情況回傳 false，資料不變） */
  deleteLocal(): Promise<boolean>;
  /** 刪除所有紀錄（只有已登入可用）；完成時回傳 true */
  deleteAll(): Promise<boolean>;
  /** 目前可用的還原點與每日快照（未登入：本機還原點；已登入：雲端還原點與每日快照） */
  listRestoreSources(): Promise<RestoreSource[]>;
  /** 刪除角色或帳號前建立還原點；呼叫當下就讀取資料，失敗時只提示不阻擋刪除 */
  saveRestorePointBeforeDelete(): Promise<void>;
}

const NEED_SYNC_MESSAGE = '需要先與雲端同步才能還原，請確認網路連線後再試一次';

/**
 * 建立控制器。
 * @param deps 外部依賴
 * @returns 控制器
 */
export function createSyncController(deps: SyncControllerDeps): SyncController {
  const store = createStore<SyncViewState>(() => ({ auth: { kind: 'checking' }, busy: false, initialSyncPending: false }));
  const set = store.setState;
  let scheduler: SyncScheduler | undefined;

  function handleError(error: unknown): void {
    if (error instanceof FormatTooNewError) {
      set({ dialog: { kind: 'formatTooNew' } });
      return;
    }
    const message = describeSyncError(error);
    if (message) deps.notify.error(message);
  }

  /** 同一時間只執行一個動作；task 回傳 false 代表沒有完成 */
  async function withBusy(task: () => Promise<boolean | void>): Promise<boolean> {
    if (store.getState().busy) return false;
    set({ busy: true });
    try {
      return (await task()) !== false;
    } catch (error) {
      handleError(error);
      return false;
    } finally {
      set({ busy: false });
    }
  }

  function stop(): void {
    deps.stopSync();
    scheduler = undefined;
  }

  function begin(): void {
    set({ dialog: undefined });
    scheduler = deps.startSync({ onStatus: handleStatus, onApplied: deps.notify.applied });
  }

  function handleStatus(status: SyncStatus): void {
    set({ status, lastSyncedAt: deps.actions.state.read().lastSyncedAt });
    if (status.kind !== 'syncing') set({ initialSyncPending: false });
    const { auth } = store.getState();
    if (status.kind === 'synced' && auth.kind === 'signedIn' && !auth.user) {
      deps.auth.getUser().then(
        (user) => set({ auth: { kind: 'signedIn', user } }),
        () => undefined,
      );
    }
    if (status.kind !== 'blocked') return;
    switch (status.reason) {
      case 'needsFirstLogin':
      case 'stale':
        stop();
        void inspect();
        return;
      case 'resetDetected':
        set({ dialog: { kind: 'reset' } });
        return;
      case 'formatTooNew':
        set({ dialog: { kind: 'formatTooNew' } });
        return;
      case 'signedOut':
        stop();
        set({ auth: { kind: 'signedOut' }, status: undefined, initialSyncPending: false });
        return;
    }
  }

  /** 登入後（或引擎回報需要處理時）判斷要直接同步還是跳對話框 */
  async function inspect(): Promise<void> {
    try {
      const plan = await inspectSignIn(deps.actions);
      if (plan.kind === 'ready') begin();
      else if (plan.kind === 'chooseFirstLogin') {
        set({ dialog: { kind: 'firstLogin', reason: plan.reason, local: plan.local, cloud: plan.cloud }, initialSyncPending: false });
      } else {
        set({
          dialog: { kind: 'confirmOverwrite', restoredAt: plan.restoredAt, local: plan.local, cloud: plan.cloud },
          initialSyncPending: false,
        });
      }
    } catch (error) {
      set({ initialSyncPending: false });
      // 與同步引擎相同的錯誤對應：授權失效要重新連線、已登出就顯示未登入，其他才當成暫時連不上
      if (error instanceof AuthError && error.code === 'signedOut') {
        set({ auth: { kind: 'signedOut' }, status: undefined });
      } else if (
        (error instanceof AuthError && error.code === 'reconnectRequired') ||
        (error instanceof CloudError && error.kind === 'unauthorized')
      ) {
        set({ status: { kind: 'reconnectRequired' } });
      } else if (!(error instanceof FormatTooNewError)) {
        set({ status: { kind: 'offline' } });
      }
      handleError(error);
    }
  }

  async function afterSignIn(user: AuthUser): Promise<void> {
    set({ auth: { kind: 'signedIn', user }, initialSyncPending: true });
    await inspect();
  }

  /** 登出；失敗時丟出錯誤、維持原狀 */
  async function signOutNow(): Promise<void> {
    await deps.auth.signOut();
    stop();
    set({ auth: { kind: 'signedOut' }, status: undefined, dialog: undefined, initialSyncPending: false });
  }

  /** 等目前這輪同步結束，回傳結束時的狀態 */
  function waitUntilSettled(): Promise<SyncStatus | undefined> {
    return new Promise((resolve) => {
      const check = (): void => {
        const { status } = store.getState();
        if (status?.kind === 'syncing') return;
        unsubscribe();
        resolve(status);
      };
      const unsubscribe = store.subscribe(check);
      check();
    });
  }

  /** 3-1：先同步取得雲端最新版本，再開比較畫面（目前資料 = 雲端） */
  async function openSignedInRestore(target: DataSnapshot, source: RestoreSourceInfo, refreshed: boolean): Promise<boolean> {
    if (!scheduler) {
      deps.notify.error(NEED_SYNC_MESSAGE);
      return false;
    }
    await scheduler.syncNow();
    const status = await waitUntilSettled();
    if (status?.kind !== 'synced' && status?.kind !== 'pending') {
      set({ dialog: undefined });
      deps.notify.error(NEED_SYNC_MESSAGE);
      return false;
    }
    set({
      dialog: {
        kind: 'restore',
        mode: 'signedIn',
        source,
        current: deps.actions.local.read(),
        target,
        expectedVersion: deps.actions.state.read().lastVersion,
        refreshed,
      },
    });
    return true;
  }

  return {
    store,

    async boot() {
      try {
        await afterSignIn(await deps.auth.getUser());
      } catch (error) {
        const state = deps.actions.state.read();
        const code = error instanceof AuthError ? error.code : undefined;
        if (code === 'signedOut' || state.boundSub === undefined) {
          set({ auth: { kind: 'signedOut' } });
          return;
        }
        set({ auth: { kind: 'signedIn' } });
        if (code === 'reconnectRequired') {
          set({ status: { kind: 'reconnectRequired' } });
          return;
        }
        // 暫時連不上：交給排程器離線重試。未登入時還原過的資料要先經過 3-3，不能直接同步
        if (state.pendingCloudOverwrite) set({ status: { kind: 'offline' } });
        else begin();
      }
    },

    async signIn() {
      await withBusy(async () => afterSignIn(await deps.auth.signIn()));
    },

    async signOut() {
      await withBusy(async () => {
        if (scheduler && isPending(deps.actions.state.read())) await scheduler.syncNow();
        await signOutNow();
      });
    },

    async syncNow() {
      if (scheduler) await scheduler.syncNow();
      else if (store.getState().auth.kind === 'signedIn') await inspect();
    },

    async chooseCloud() {
      await withBusy(async () => {
        const { dialog } = store.getState();
        if (dialog?.kind !== 'firstLogin' && dialog?.kind !== 'confirmOverwrite') return false;
        await adoptCloudData(deps.actions, dialog.cloud);
        begin();
      });
    },

    async chooseMerge() {
      await withBusy(async () => {
        if (store.getState().dialog?.kind !== 'firstLogin') return false;
        await mergeBothData(deps.actions);
        begin();
      });
    },

    async chooseDevice() {
      await withBusy(async () => {
        const { dialog } = store.getState();
        if (dialog?.kind !== 'confirmOverwrite') return false;
        await keepRestoredVersion(deps.actions, dialog.cloud);
        begin();
      });
    },

    async dismissDialog() {
      const { dialog, busy } = store.getState();
      if (!dialog || busy) return;
      if (dialog.kind === 'restore' || dialog.kind === 'formatTooNew') {
        set({ dialog: undefined });
        return;
      }
      await withBusy(signOutNow);
    },

    async resetDevice() {
      await withBusy(async () => {
        if (store.getState().dialog?.kind !== 'reset') return false;
        await resetThisDevice(deps.actions);
        set({ dialog: undefined });
        await scheduler?.syncNow();
      });
    },

    async startRestore(target, source) {
      await withBusy(async () => {
        if (store.getState().auth.kind !== 'signedIn') {
          set({
            dialog: { kind: 'restore', mode: 'signedOut', source, current: deps.actions.local.read(), target, refreshed: false },
          });
          return;
        }
        return openSignedInRestore(target, source, false);
      });
    },

    async confirmRestore() {
      await withBusy(async () => {
        const { dialog } = store.getState();
        if (dialog?.kind !== 'restore') return false;
        if (dialog.mode === 'signedOut') {
          restoreSignedOut(deps.actions, dialog.target);
          set({ dialog: undefined });
          deps.notify.success('已還原，之後登入 Google 時會再確認雲端要使用哪一份資料');
          return;
        }
        const result = await restoreSignedIn(deps.actions, dialog.target, dialog.expectedVersion);
        if (result.kind === 'cloudChanged') return openSignedInRestore(dialog.target, dialog.source, true);
        set({ dialog: undefined });
        deps.notify.success('已還原，其他裝置下次同步時也會換成這份資料');
        await scheduler?.syncNow();
      });
    },

    deleteLocal() {
      return withBusy(async () => {
        if (store.getState().auth.kind !== 'signedIn') {
          clearLocalDataSignedOut(deps.actions);
          return;
        }
        stop();
        const result = await deleteLocalRecords(deps.actions);
        if (result.kind === 'pushFailed') {
          begin();
          deps.notify.error(
            result.outcome.kind === 'reconnectRequired'
              ? 'Google 授權已失效，請先重新連線，把還沒同步的修改推送到雲端'
              : '還有修改沒有同步到雲端，請確認網路連線後再試一次',
          );
          return false;
        }
        set({ auth: { kind: 'signedOut' }, status: undefined, lastSyncedAt: undefined, initialSyncPending: false });
      });
    },

    deleteAll() {
      return withBusy(async () => {
        if (store.getState().auth.kind !== 'signedIn') return false;
        await deleteAllRecords(deps.actions);
        await scheduler?.syncNow();
      });
    },

    async listRestoreSources() {
      if (store.getState().auth.kind !== 'signedIn') {
        const saved = deps.actions.localRestorePoint.read();
        return saved ? [{ kind: 'localRestorePoint', ...saved }] : [];
      }
      const [restorePoint, daily] = await Promise.all([
        readCloudSavedSnapshot(deps.actions.cloud, RESTORE_POINT_FILE),
        readCloudSavedSnapshot(deps.actions.cloud, DAILY_SNAPSHOT_FILE),
      ]);
      const sources: RestoreSource[] = [];
      if (restorePoint) sources.push({ kind: 'cloudRestorePoint', ...restorePoint });
      if (daily) sources.push({ kind: 'dailySnapshot', ...daily });
      return sources;
    },

    async saveRestorePointBeforeDelete() {
      const where = store.getState().auth.kind === 'signedIn' ? 'cloud' : 'local';
      try {
        await saveRestorePoint(deps.actions, where);
      } catch (error) {
        console.error('[sync] failed to save restore point', error);
        deps.notify.error('無法建立還原點，這次刪除之後無法從還原點復原');
      }
    },
  };
}
