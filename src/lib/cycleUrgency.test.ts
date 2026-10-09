import { describe, expect, it, vi } from 'vitest';
import type { BossCatalogEntry } from '@/lib/bossCatalog';
import { getCycleUrgency } from '@/lib/cycleUrgency';
import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';

// 只把測試用的賽季王目錄項目換成固定截止日,其餘沿用真實目錄
vi.mock('@/lib/bossCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bossCatalog')>();
  return {
    ...actual,
    findBossCatalogEntry: (id: string) =>
      id === 'season-test' ? ({ id, expiresAt: '2026-10-01' } as BossCatalogEntry) : actual.findBossCatalogEntry(id),
  };
});

// 只把測試用的賽季任務範本換成固定截止日,其餘沿用真實目錄
vi.mock('@/lib/presetTasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/presetTasks')>();
  return {
    ...actual,
    findPresetExpiresAt: (id: string) => (id === 'season-preset-test' ? '2026-10-01' : actual.findPresetExpiresAt(id)),
  };
});

// 全域每週重置日是星期三,重置時間都是 00:00
const SETTINGS: Settings = { dailyResetTime: '00:00', weeklyResetDay: 3, weeklyResetTime: '00:00' };

// 2026-09-30 是星期三、2026-10-01 是星期四
const WED = new Date('2026-09-30T10:00:00');
const THU = new Date('2026-10-01T10:00:00');

function task(overrides: Partial<CharacterTask>): CharacterTask {
  return {
    id: 't1',
    characterId: 'c1',
    name: '任務',
    category: '一般',
    resetCycle: 'weekly',
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function boss(overrides: Partial<CharacterBossTrackList>): CharacterBossTrackList {
  return {
    id: 'b1',
    characterId: 'c1',
    bossName: 'BOSS',
    difficulty: '普通',
    resetCycle: 'weekly',
    crystalValue: 0,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getCycleUrgency', () => {
  it('沒有項目時都不急迫', () => {
    expect(getCycleUrgency([], [], SETTINGS, WED)).toEqual({ weekly: false, monthly: false, season: false });
  });

  describe('每週', () => {
    it('未完成項目距下次重置不到 24 小時時急迫', () => {
      // 週四 00:00 重置,週三 10:00 還剩 14 小時
      expect(getCycleUrgency([task({ weeklyResetDay: 4 })], [], SETTINGS, WED).weekly).toBe(true);
    });

    it('重置日當天已經重置過,不急迫', () => {
      // 週四 10:00 時下一次重置是下週四
      expect(getCycleUrgency([task({ weeklyResetDay: 4 })], [], SETTINGS, THU).weekly).toBe(false);
    });

    it('依項目自己的重置日判斷,而不是全域設定', () => {
      // 全域是週三:沒有覆寫的任務週三 10:00 剛重置完,不急迫;週四重置的週王還剩 14 小時,急迫
      expect(getCycleUrgency([task({})], [], SETTINGS, WED).weekly).toBe(false);
      expect(getCycleUrgency([task({})], [boss({ weeklyResetDay: 4 })], SETTINGS, WED).weekly).toBe(true);
    });

    it('即將重置的項目已完成時不急迫', () => {
      const bosses = [boss({ weeklyResetDay: 4, checked: true })];
      expect(getCycleUrgency([task({})], bosses, SETTINGS, WED).weekly).toBe(false);
    });

    it('VIP 週重置王不算進每週', () => {
      const bosses = [boss({ weeklyResetDay: 4, category: 'vip' })];
      expect(getCycleUrgency([], bosses, SETTINGS, WED).weekly).toBe(false);
    });
  });

  describe('每月', () => {
    it('月底最後一天、有未完成項目時急迫', () => {
      expect(getCycleUrgency([task({ resetCycle: 'monthly' })], [], SETTINGS, WED).monthly).toBe(true);
      expect(getCycleUrgency([], [boss({ resetCycle: 'monthly' })], SETTINGS, WED).monthly).toBe(true);
    });

    it('1 號當天已經重置過,不急迫', () => {
      expect(getCycleUrgency([task({ resetCycle: 'monthly' })], [], SETTINGS, THU).monthly).toBe(false);
    });

    it('全部完成時不急迫', () => {
      expect(getCycleUrgency([task({ resetCycle: 'monthly', checked: true })], [], SETTINGS, WED).monthly).toBe(false);
    });
  });

  describe('賽季', () => {
    const seasonBoss = boss({ category: 'season', bossCatalogId: 'season-test' });

    it('賽季王距截止不到 24 小時且未完成時急迫', () => {
      expect(getCycleUrgency([], [seasonBoss], SETTINGS, THU).season).toBe(true);
      expect(getCycleUrgency([], [seasonBoss], SETTINGS, new Date('2026-09-28T10:00:00')).season).toBe(false);
    });

    it('即將截止的賽季王已完成時不急迫', () => {
      expect(getCycleUrgency([], [{ ...seasonBoss, checked: true }], SETTINGS, THU).season).toBe(false);
    });

    it('賽季任務以預設範本的截止日為準', () => {
      const seasonTask = task({ resetCycle: 'season', presetId: 'season-preset-test', dueDate: '2026-12-31' });
      expect(getCycleUrgency([seasonTask], [], SETTINGS, THU).season).toBe(true);
      expect(getCycleUrgency([seasonTask], [], SETTINGS, new Date('2026-09-28T10:00:00')).season).toBe(false);
    });

    it('沒有範本的賽季任務改用 dueDate', () => {
      const seasonTask = task({ resetCycle: 'season', dueDate: '2026-10-01' });
      expect(getCycleUrgency([seasonTask], [], SETTINGS, THU).season).toBe(true);
      expect(getCycleUrgency([{ ...seasonTask, checked: true }], [], SETTINGS, THU).season).toBe(false);
    });
  });
});
