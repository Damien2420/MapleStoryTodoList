import { describe, expect, it } from 'vitest';
import type { CharacterBossTrackList, CharacterTask } from '@/types';
import { summarizeCharacterCycles } from '@/lib/characterSummary';

let taskIdCounter = 0;
function makeTask(overrides: Partial<CharacterTask> = {}): CharacterTask {
  taskIdCounter += 1;
  return {
    id: `task-${taskIdCounter}`,
    characterId: 'c1',
    name: '測試任務',
    category: '測試',
    resetCycle: 'daily',
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    order: 0,
    ...overrides,
  };
}

let bossIdCounter = 0;
function makeBoss(overrides: Partial<CharacterBossTrackList> = {}): CharacterBossTrackList {
  bossIdCounter += 1;
  return {
    id: `boss-${bossIdCounter}`,
    characterId: 'c1',
    bossName: '測試王',
    difficulty: '普通',
    resetCycle: 'weekly',
    crystalValue: 1000,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('summarizeCharacterCycles', () => {
  describe('分桶', () => {
    it('VIP 每週重置王只進 vip,不進 weekly', () => {
      const boss = makeBoss({ category: 'vip', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([], [boss]);
      expect(summary.weekly.bossTotal).toBe(0);
      expect(summary.vip.bossTotal).toBe(1);
    });

    it('VIP 每月重置王只進 vip,不進 monthly', () => {
      const boss = makeBoss({ category: 'vip', resetCycle: 'monthly' });
      const summary = summarizeCharacterCycles([], [boss]);
      expect(summary.monthly.bossTotal).toBe(0);
      expect(summary.vip.bossTotal).toBe(1);
    });

    it('賽季王不論 resetCycle 都只進 season', () => {
      const boss = makeBoss({ category: 'season', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([], [boss]);
      expect(summary.weekly.bossTotal).toBe(0);
      expect(summary.season.bossTotal).toBe(1);
    });

    it('回歸案例:同一角色同時有普通週王、賽季王、VIP週王,weekly 只算普通週王', () => {
      const bosses = [
        makeBoss({ resetCycle: 'weekly' }),
        makeBoss({ category: 'season', resetCycle: 'weekly' }),
        makeBoss({ category: 'vip', resetCycle: 'weekly' }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.weekly.bossTotal).toBe(1);
      expect(summary.season.bossTotal).toBe(1);
      expect(summary.vip.bossTotal).toBe(1);
    });

    it('VIP 週券王 + VIP 月券王,vip.bossTotal 是兩者合計', () => {
      const bosses = [
        makeBoss({ category: 'vip', resetCycle: 'weekly' }),
        makeBoss({ category: 'vip', resetCycle: 'monthly' }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.vip.bossTotal).toBe(2);
    });

    it("'once'/'biweekly-weekend' 任務不出現在任何週期", () => {
      const tasks = [makeTask({ resetCycle: 'once' }), makeTask({ resetCycle: 'biweekly-weekend' })];
      const summary = summarizeCharacterCycles(tasks, []);
      expect(summary.daily.taskTotal).toBe(0);
      expect(summary.weekly.taskTotal).toBe(0);
      expect(summary.monthly.taskTotal).toBe(0);
      expect(summary.season.taskTotal).toBe(0);
    });
  });

  describe('expiry(用注入的 now 判斷下架)', () => {
    it('presetId 已過期的任務不計入,無 expiresAt 的任務仍計入', () => {
      const expired = makeTask({ presetId: 'frieren-diary-check-in', resetCycle: 'daily' });
      const evergreen = makeTask({ presetId: 'guild-weekly', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([expired, evergreen], [], new Date('2026-12-01'));
      expect(summary.daily.taskTotal).toBe(0);
      expect(summary.weekly.taskTotal).toBe(1);
    });

    it('同一組任務在下架日之前查詢,兩筆都計入(證明是 now 在作用)', () => {
      const notYetExpired = makeTask({ presetId: 'frieren-diary-check-in', resetCycle: 'daily' });
      const evergreen = makeTask({ presetId: 'guild-weekly', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([notYetExpired, evergreen], [], new Date('2026-09-20'));
      expect(summary.daily.taskTotal).toBe(1);
      expect(summary.weekly.taskTotal).toBe(1);
    });

    it('bossCatalogId 已過期的 BOSS 不計入下架日之後的查詢', () => {
      const boss = makeBoss({ bossCatalogId: 'kai', category: 'season', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([], [boss], new Date('2026-12-01'));
      expect(summary.season.bossTotal).toBe(0);
    });

    it('同一隻 BOSS 在下架日之前查詢仍計入', () => {
      const boss = makeBoss({ bossCatalogId: 'kai', category: 'season', resetCycle: 'weekly' });
      const summary = summarizeCharacterCycles([], [boss], new Date('2026-09-20'));
      expect(summary.season.bossTotal).toBe(1);
    });
  });

  describe('收益:$0 vs 不存在', () => {
    it('只計 checked 的 BOSS', () => {
      const bosses = [
        makeBoss({ resetCycle: 'daily', checked: true, crystalValue: 100, partySize: 1 }),
        makeBoss({ resetCycle: 'daily', checked: false, crystalValue: 999, partySize: 1 }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.daily.revenue).toBe(100);
    });

    it('逐隻用 getEffectiveCrystalValue 先 round 再加總,不是加總後才 round', () => {
      // 兩隻都是 100/3 = 33.33 → round 各自為 33,加總應為 66;
      // 若誤寫成先加總再除(200/3 = 66.67 → round 67)會多算 1
      const bosses = [
        makeBoss({ resetCycle: 'daily', checked: true, crystalValue: 100, partySize: 3 }),
        makeBoss({ resetCycle: 'daily', checked: true, crystalValue: 100, partySize: 3 }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.daily.revenue).toBe(66);
    });

    it('該週期有追蹤但全部未勾選,revenue 是 0 而不是 undefined', () => {
      const boss = makeBoss({ resetCycle: 'daily', checked: false });
      const summary = summarizeCharacterCycles([], [boss]);
      expect(summary.daily.revenue).toBe(0);
    });

    it('該週期 bossTotal 為 0,revenue 是 undefined', () => {
      const summary = summarizeCharacterCycles([], []);
      expect(summary.daily.bossTotal).toBe(0);
      expect(summary.daily.revenue).toBeUndefined();
    });

    it('season/vip 恆為 undefined,即使有已勾選的 BOSS', () => {
      const bosses = [
        makeBoss({ category: 'season', resetCycle: 'weekly', checked: true, crystalValue: 500 }),
        makeBoss({ category: 'vip', resetCycle: 'weekly', checked: true, crystalValue: 500 }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.season.revenue).toBeUndefined();
      expect(summary.vip.revenue).toBeUndefined();
    });
  });

  describe('週收益共用上限(一般週王 + VIP 週重置王)', () => {
    it('8 隻一般週王 + 5 隻 VIP 週王共 13 隻都勾選,價值最低的 1 隻不計入', () => {
      const regularWeekly = Array.from({ length: 8 }, (_, i) =>
        makeBoss({ resetCycle: 'weekly', checked: true, crystalValue: (i + 1) * 100, partySize: 1 }),
      );
      const vipWeekly = Array.from({ length: 5 }, (_, i) =>
        makeBoss({
          category: 'vip',
          resetCycle: 'weekly',
          checked: true,
          crystalValue: (i + 9) * 100,
          partySize: 1,
        }),
      );
      const summary = summarizeCharacterCycles([], [...regularWeekly, ...vipWeekly]);
      const totalIfUncapped = [...regularWeekly, ...vipWeekly].reduce((sum, b) => sum + b.crystalValue, 0);
      expect(summary.weekly.revenue).toBe(totalIfUncapped - 100); // 最低價值 100 的那隻被排除
    });

    it('只有一般週王、沒有 VIP 週王時,等同單純加總', () => {
      const bosses = [
        makeBoss({ resetCycle: 'weekly', checked: true, crystalValue: 100, partySize: 1 }),
        makeBoss({ resetCycle: 'weekly', checked: true, crystalValue: 200, partySize: 1 }),
        makeBoss({ resetCycle: 'weekly', checked: true, crystalValue: 300, partySize: 1 }),
      ];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.weekly.revenue).toBe(600);
    });

    it('只有 VIP 週王、完全沒有一般週王,weekly.revenue 是 undefined', () => {
      const bosses = [makeBoss({ category: 'vip', resetCycle: 'weekly', checked: true, crystalValue: 500 })];
      const summary = summarizeCharacterCycles([], bosses);
      expect(summary.weekly.bossTotal).toBe(0);
      expect(summary.weekly.revenue).toBeUndefined();
    });
  });

  describe('月收益合併不設上限(一般月王 + VIP 月重置王)', () => {
    it('一般月王 + VIP 月王共 13 隻都勾選,全部計入不設上限', () => {
      const regularMonthly = Array.from({ length: 8 }, () =>
        makeBoss({ resetCycle: 'monthly', checked: true, crystalValue: 100, partySize: 1 }),
      );
      const vipMonthly = Array.from({ length: 5 }, () =>
        makeBoss({ category: 'vip', resetCycle: 'monthly', checked: true, crystalValue: 100, partySize: 1 }),
      );
      const summary = summarizeCharacterCycles([], [...regularMonthly, ...vipMonthly]);
      expect(summary.monthly.revenue).toBe(1300);
    });

    it('只有 VIP 月王、沒有一般月王,monthly.revenue 仍有值', () => {
      const boss = makeBoss({ category: 'vip', resetCycle: 'monthly', checked: true, crystalValue: 500 });
      const summary = summarizeCharacterCycles([], [boss]);
      expect(summary.monthly.bossTotal).toBe(0);
      expect(summary.monthly.revenue).toBe(500);
    });
  });
});
