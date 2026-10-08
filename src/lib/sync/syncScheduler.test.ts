import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppliedChanges, SyncEngine, SyncOutcome } from '@/lib/sync/syncEngine';
import { createSyncScheduler, type SyncStatus, type SyncTriggers } from '@/lib/sync/syncScheduler';

const NO_CHANGES: AppliedChanges = { addedCharacterNames: [], removedCharacterNames: [], changedCharacterNames: [], accountsChanged: false };
const CHANGES: AppliedChanges = { ...NO_CHANGES, changedCharacterNames: ['白砂'] };

type TriggerName = 'visible' | 'hidden' | 'focus' | 'online';

/**
 * 建立受測的排程器：假引擎依序回傳 outcomes（用完後一律 synced），回傳 synced 時清除待推送；
 * 觸發事件由 fire() 手動發出。
 */
function setup(outcomes: SyncOutcome[] = []) {
  const queue = [...outcomes];
  let pending = false;
  const syncOnce = vi.fn(async (): Promise<SyncOutcome> => {
    const next = queue.shift() ?? { kind: 'synced' };
    if (next.kind === 'synced') pending = false;
    return next;
  });
  const handlers: Record<TriggerName, Array<() => void>> = { visible: [], hidden: [], focus: [], online: [] };
  const listen = (name: TriggerName) => (callback: () => void) => {
    handlers[name].push(callback);
    return () => {
      handlers[name] = handlers[name].filter((c) => c !== callback);
    };
  };
  const triggers: SyncTriggers = {
    onVisible: listen('visible'),
    onHidden: listen('hidden'),
    onFocus: listen('focus'),
    onOnline: listen('online'),
  };
  const statuses: SyncStatus[] = [];
  const applied: AppliedChanges[] = [];
  const scheduler = createSyncScheduler({
    engine: { syncOnce } satisfies SyncEngine,
    isPending: () => pending,
    triggers,
    onStatus: (status) => statuses.push(status),
    onApplied: (result) => applied.push(result),
  });
  return {
    scheduler,
    syncOnce,
    statuses,
    applied,
    fire: (name: TriggerName) => {
      for (const callback of [...handlers[name]]) callback();
    },
    setPending: (value: boolean) => {
      pending = value;
    },
    lastStatus: () => statuses[statuses.length - 1],
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createSyncScheduler', () => {
  it('start 後立即同步一次，狀態依序為 syncing、synced', async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
    expect(t.statuses).toEqual([{ kind: 'syncing' }, { kind: 'synced' }]);
  });

  it('本機修改後狀態為 pending，停止修改滿 3 秒才同步，期間的多次修改只同步一次', async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.syncOnce.mockClear();
    t.setPending(true);
    t.scheduler.notifyLocalChange();
    await vi.advanceTimersByTimeAsync(2000);
    t.scheduler.notifyLocalChange();
    await vi.advanceTimersByTimeAsync(2999);
    expect(t.syncOnce).not.toHaveBeenCalled();
    expect(t.lastStatus()).toEqual({ kind: 'pending' });
    await vi.advanceTimersByTimeAsync(1);
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
  });

  it('分頁隱藏時若有待推送立即同步、不再等 3 秒；沒有待推送則不同步', async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.syncOnce.mockClear();
    t.fire('hidden');
    await flush();
    expect(t.syncOnce).not.toHaveBeenCalled();

    t.setPending(true);
    t.scheduler.notifyLocalChange();
    t.fire('hidden');
    await flush();
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
  });

  it('切回分頁或視窗取得焦點時拉取', async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.fire('visible');
    await flush();
    t.fire('focus');
    await flush();
    expect(t.syncOnce).toHaveBeenCalledTimes(3);
  });

  it('只有真的套用了其他裝置的變更時才呼叫 onApplied', async () => {
    const t = setup([
      { kind: 'synced', applied: NO_CHANGES },
      { kind: 'synced', applied: CHANGES },
    ]);
    t.scheduler.start();
    await flush();
    t.fire('focus');
    await flush();
    expect(t.applied).toEqual([CHANGES]);
  });

  it('同步完成時仍有待推送（上傳期間又有修改）時狀態為 pending，3 秒後再推送一次', async () => {
    const t = setup();
    t.setPending(true);
    t.syncOnce.mockImplementationOnce(async () => ({ kind: 'synced' }));
    t.scheduler.start();
    await flush();
    expect(t.lastStatus()).toEqual({ kind: 'pending' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
  });

  it('離線時狀態為 offline，以 5 秒、10 秒逐漸拉長間隔重試；網路恢復時立即重試', async () => {
    const offline: SyncOutcome = { kind: 'retryLater', reason: 'offline' };
    const t = setup([offline, offline, offline]);
    t.scheduler.start();
    await flush();
    expect(t.lastStatus()).toEqual({ kind: 'offline' });
    await vi.advanceTimersByTimeAsync(4999);
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9999);
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.syncOnce).toHaveBeenCalledTimes(3);
    t.fire('online');
    await flush();
    expect(t.syncOnce).toHaveBeenCalledTimes(4);
    expect(t.lastStatus()).toEqual({ kind: 'synced' });
  });

  it('多次被其他寫入搶先時狀態為 pending，5 秒後重試', async () => {
    const t = setup([{ kind: 'retryLater', reason: 'conflict' }]);
    t.scheduler.start();
    await flush();
    expect(t.lastStatus()).toEqual({ kind: 'pending' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
  });

  it('需要重新連線時停止自動同步，任何觸發都不同步，直到呼叫 syncNow', async () => {
    const t = setup([{ kind: 'reconnectRequired' }]);
    t.scheduler.start();
    await flush();
    expect(t.lastStatus()).toEqual({ kind: 'reconnectRequired' });
    t.setPending(true);
    t.scheduler.notifyLocalChange();
    t.fire('visible');
    t.fire('focus');
    t.fire('hidden');
    t.fire('online');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
    await t.scheduler.syncNow();
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
  });

  it('雲端被重置等需要使用者決定的情況，狀態為 blocked 並帶原因', async () => {
    const t = setup([{ kind: 'resetDetected' }]);
    t.scheduler.start();
    await flush();
    expect(t.lastStatus()).toEqual({ kind: 'blocked', reason: 'resetDetected' });
  });

  it('同步進行中又被觸發多次時，結束後只再同步一次', async () => {
    const t = setup();
    let release: () => void = () => {};
    t.syncOnce.mockImplementationOnce(
      () =>
        new Promise<SyncOutcome>((resolve) => {
          release = () => resolve({ kind: 'synced' });
        }),
    );
    t.scheduler.start();
    await flush();
    t.fire('focus');
    t.fire('visible');
    t.fire('focus');
    release();
    await flush();
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
  });

  it('引擎丟出未預期的錯誤時記錄下來，視為離線並排定重試', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = setup();
    t.syncOnce.mockImplementationOnce(async () => {
      throw new SyntaxError('broken');
    });
    t.scheduler.start();
    await flush();
    expect(log).toHaveBeenCalled();
    expect(t.lastStatus()).toEqual({ kind: 'offline' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.syncOnce).toHaveBeenCalledTimes(2);
  });

  it('stop 之後不再回應任何觸發，也不會執行已排定的重試', async () => {
    const t = setup([{ kind: 'retryLater', reason: 'offline' }]);
    t.scheduler.start();
    await flush();
    t.scheduler.stop();
    t.fire('focus');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.syncOnce).toHaveBeenCalledTimes(1);
  });
});
