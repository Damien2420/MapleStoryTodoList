import { describe, expect, it, vi } from 'vitest';
import type { BossCatalogEntry } from '@/lib/bossCatalog';
import type { CycleSummary } from '@/lib/characterSummary';
import { getCycleUrgency } from '@/lib/cycleUrgency';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { CharacterBossTrackList } from '@/types';

// 只把測試用的賽季王目錄項目換成固定截止日,其餘沿用真實目錄
vi.mock('@/lib/bossCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bossCatalog')>();
  return {
    ...actual,
    findBossCatalogEntry: (id: string) =>
      id === 'season-test' ? ({ id, expiresAt: '2026-10-01' } as BossCatalogEntry) : actual.findBossCatalogEntry(id),
  };
});

const EMPTY: CycleSummary = { taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 0 };

function summaryWith(overrides: Partial<Record<BossCycleKey, CycleSummary>>): Record<BossCycleKey, CycleSummary> {
  return { daily: EMPTY, weekly: EMPTY, monthly: EMPTY, season: EMPTY, vip: EMPTY, ...overrides };
}

const seasonBoss = {
  id: 'b1',
  characterId: 'c1',
  bossName: '賽季王',
  difficulty: '普通',
  resetCycle: 'weekly',
  category: 'season',
  bossCatalogId: 'season-test',
  crystalValue: 0,
  partySize: 1,
  checked: false,
  lastResetAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as CharacterBossTrackList;

describe('getCycleUrgency', () => {
  // 2026-09-30 是星期三(getDay() === 3)
  const wednesday = new Date('2026-09-30T10:00:00');

  it('每週:今天是重置日且未全部完成時急迫', () => {
    const summary = summaryWith({ weekly: { taskDone: 1, taskTotal: 2, bossDone: 0, bossTotal: 0 } });
    expect(getCycleUrgency(summary, [], 3, wednesday).weekly).toBe(true);
    expect(getCycleUrgency(summary, [], 4, wednesday).weekly).toBe(false);
  });

  it('每週:全部完成就不急迫', () => {
    const summary = summaryWith({ weekly: { taskDone: 2, taskTotal: 2, bossDone: 1, bossTotal: 1 } });
    expect(getCycleUrgency(summary, [], 3, wednesday).weekly).toBe(false);
  });

  it('每月:只有 1 號且未全部完成時急迫', () => {
    const summary = summaryWith({ monthly: { taskDone: 0, taskTotal: 1, bossDone: 0, bossTotal: 0 } });
    expect(getCycleUrgency(summary, [], 3, new Date('2026-10-01T10:00:00')).monthly).toBe(true);
    expect(getCycleUrgency(summary, [], 3, wednesday).monthly).toBe(false);
  });

  it('沒有項目的週期不急迫', () => {
    expect(getCycleUrgency(summaryWith({}), [], 3, wednesday)).toEqual({ weekly: false, monthly: false, season: false });
  });

  it('賽季:距截止不到 24 小時且未完成時急迫', () => {
    const summary = summaryWith({ season: { taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 1 } });
    expect(getCycleUrgency(summary, [seasonBoss], 3, new Date('2026-10-01T10:00:00')).season).toBe(true);
    expect(getCycleUrgency(summary, [seasonBoss], 3, new Date('2026-09-28T10:00:00')).season).toBe(false);
  });
});
