import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBackupStale } from '@/lib/backupStatus';

describe('isBackupStale', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('從沒備份過(undefined)不算過時', () => {
    expect(isBackupStale(undefined)).toBe(false);
  });

  it('距今超過門檻天數視為過時', () => {
    const overThreshold = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale(overThreshold, 30)).toBe(true);
  });

  it('距今未超過門檻天數不算過時', () => {
    const withinThreshold = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale(withinThreshold, 30)).toBe(false);
  });

  it('剛好卡在門檻天數整數時,不算過時(判斷式是嚴格大於);用 fake timer 固定「現在」,避免執行當下的些微時間差把 30 天整算成超過', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const exactlyAtThreshold = new Date('2026-01-02T00:00:00.000Z').toISOString();
    expect(isBackupStale(exactlyAtThreshold, 30)).toBe(false);
  });
});
