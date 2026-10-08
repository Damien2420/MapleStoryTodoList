import { hasVisibleChanges, type AppliedChanges, type SyncEngine, type SyncOutcome } from '@/lib/sync/syncEngine';

/** 停止修改滿這個時間才推送，連續修改只推送一次 */
const PUSH_DEBOUNCE_MS = 3000;
/** 重試間隔：5 秒起，每次加倍，上限 5 分鐘 */
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;

/** 需要使用者處理才能繼續同步的情況 */
export type BlockedReason = 'signedOut' | 'needsFirstLogin' | 'stale' | 'resetDetected' | 'formatTooNew';

/** 顯示在 Header 的同步狀態 */
export type SyncStatus =
  | { kind: 'synced' }
  | { kind: 'pending' }
  | { kind: 'syncing' }
  | { kind: 'offline' }
  | { kind: 'reconnectRequired' }
  | { kind: 'blocked'; reason: BlockedReason };

/** 觸發同步的瀏覽器事件；每個方法註冊 callback 並回傳取消註冊的函式 */
export interface SyncTriggers {
  onVisible(callback: () => void): () => void;
  onHidden(callback: () => void): () => void;
  onFocus(callback: () => void): () => void;
  onOnline(callback: () => void): () => void;
}

export interface SyncSchedulerDeps {
  engine: SyncEngine;
  /** 是否有修改待同步（讀同步狀態的計數器） */
  isPending: () => boolean;
  triggers: SyncTriggers;
  onStatus: (status: SyncStatus) => void;
  /** 套用了其他裝置的變更時呼叫，用來顯示提示 */
  onApplied: (changes: AppliedChanges) => void;
}

/** 決定什麼時候同步的排程器 */
export interface SyncScheduler {
  /** 開始自動同步並立即同步一次 */
  start(): void;
  /** 停止自動同步，取消所有排定的動作 */
  stop(): void;
  /** 使用者修改了資料：3 秒內沒有新修改就推送 */
  notifyLocalChange(): void;
  /** 立即同步（「立即同步」按鈕、重新連線、對話框處理完後），會解除 blocked 與 reconnectRequired */
  syncNow(): Promise<void>;
}

/**
 * 建立同步排程器。
 * 拉取：開始時、切回分頁、視窗取得焦點、網路恢復；推送：修改後 3 秒、分頁隱藏時立即；
 * 失敗時依原因決定重試（離線、被搶先）或停下（需要重新連線、需要使用者決定）。
 * 同一個分頁內同時只跑一輪，進行中再被觸發只會在結束後補跑一次；跨分頁由引擎的鎖保證。
 * @param deps 外部依賴
 * @returns SyncScheduler 實例
 */
export function createSyncScheduler(deps: SyncSchedulerDeps): SyncScheduler {
  let active = false;
  let blocked = false;
  let running = false;
  let rerun = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryCount = 0;
  let unsubscribers: Array<() => void> = [];

  function clearTimers(): void {
    clearTimeout(pushTimer);
    clearTimeout(retryTimer);
    pushTimer = undefined;
    retryTimer = undefined;
  }

  function schedulePush(): void {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void run(), PUSH_DEBOUNCE_MS);
  }

  function scheduleRetry(): void {
    const delay = Math.min(RETRY_BASE_MS * 2 ** retryCount, RETRY_MAX_MS);
    retryCount += 1;
    retryTimer = setTimeout(() => void run(), delay);
  }

  function handle(outcome: SyncOutcome): void {
    const applied = 'applied' in outcome ? outcome.applied : undefined;
    if (applied && hasVisibleChanges(applied)) deps.onApplied(applied);

    switch (outcome.kind) {
      case 'synced':
        retryCount = 0;
        if (deps.isPending()) {
          deps.onStatus({ kind: 'pending' });
          schedulePush();
        } else {
          deps.onStatus({ kind: 'synced' });
        }
        return;
      case 'retryLater':
        deps.onStatus({ kind: outcome.reason === 'offline' ? 'offline' : 'pending' });
        scheduleRetry();
        return;
      case 'reconnectRequired':
        blocked = true;
        deps.onStatus({ kind: 'reconnectRequired' });
        return;
      default:
        blocked = true;
        deps.onStatus({ kind: 'blocked', reason: outcome.kind });
    }
  }

  async function run(): Promise<void> {
    if (!active) return;
    if (running) {
      rerun = true;
      return;
    }
    clearTimers();
    running = true;
    deps.onStatus({ kind: 'syncing' });
    let outcome: SyncOutcome;
    try {
      outcome = await deps.engine.syncOnce();
    } catch (error) {
      console.error('[sync] unexpected error', error);
      outcome = { kind: 'retryLater', reason: 'offline' };
    }
    running = false;
    if (!active) return;
    handle(outcome);
    if (rerun) {
      rerun = false;
      if (!blocked) await run();
    }
  }

  const whenActive = (action: () => void) => () => {
    if (active && !blocked) action();
  };

  return {
    start() {
      if (active) return;
      active = true;
      blocked = false;
      retryCount = 0;
      unsubscribers = [
        deps.triggers.onVisible(whenActive(() => void run())),
        deps.triggers.onFocus(whenActive(() => void run())),
        deps.triggers.onOnline(
          whenActive(() => {
            retryCount = 0;
            void run();
          }),
        ),
        deps.triggers.onHidden(
          whenActive(() => {
            if (deps.isPending()) void run();
          }),
        ),
      ];
      void run();
    },

    stop() {
      active = false;
      clearTimers();
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers = [];
    },

    notifyLocalChange() {
      // 進行中：結束後會依計數器自動判斷是否再推送；等待重試中：維持離線狀態，等重試時一起推送
      if (!active || blocked || running || retryTimer !== undefined) return;
      deps.onStatus({ kind: 'pending' });
      schedulePush();
    },

    async syncNow() {
      if (!active) return;
      blocked = false;
      retryCount = 0;
      await run();
    },
  };
}
