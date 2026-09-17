import { describe, expect, it } from 'vitest';
import { getWeeklyRevenueCountedIds, isWeeklyRevenueExcluded, WEEKLY_BOSS_LIMIT } from '@/lib/bossCatalog';

/** 建立測試用的最小週王紀錄,只帶測試需要的欄位 */
function makeBoss(id: string, checked: boolean, crystalValue: number) {
  return { id, checked, crystalValue, partySize: 1 };
}

describe('getWeeklyRevenueCountedIds', () => {
  it('已勾選總數未超過上限時,一般週王與VIP週重置王全部計入(10+2=12的情境)', () => {
    const normalWeekly = [
      ...Array.from({ length: 10 }, (_, i) => makeBoss(`normal-checked-${i}`, true, 100)),
      makeBoss('normal-unchecked-1', false, 999),
      makeBoss('normal-unchecked-2', false, 999),
    ];
    const vipWeekly = [makeBoss('vip-checked-1', true, 50), makeBoss('vip-checked-2', true, 50)];

    const countedIds = getWeeklyRevenueCountedIds([...normalWeekly, ...vipWeekly]);

    expect(countedIds.size).toBe(12);
    for (let i = 0; i < 10; i++) expect(countedIds.has(`normal-checked-${i}`)).toBe(true);
    expect(countedIds.has('vip-checked-1')).toBe(true);
    expect(countedIds.has('vip-checked-2')).toBe(true);
    // 未勾選的王完全不佔名額,即使價值更高
    expect(countedIds.has('normal-unchecked-1')).toBe(false);
  });

  it('已勾選總數超過上限時,只取結晶價值前 WEEKLY_BOSS_LIMIT 高的,其餘排除', () => {
    const bosses = [
      ...Array.from({ length: 12 }, (_, i) => makeBoss(`high-${i}`, true, 1000)),
      makeBoss('low-vip', true, 1),
    ];

    const countedIds = getWeeklyRevenueCountedIds(bosses);

    expect(countedIds.size).toBe(WEEKLY_BOSS_LIMIT);
    for (let i = 0; i < 12; i++) expect(countedIds.has(`high-${i}`)).toBe(true);
    expect(countedIds.has('low-vip')).toBe(false);
  });

  it('未勾選的王不參與排序也不佔名額', () => {
    const bosses = [makeBoss('checked', true, 1), makeBoss('unchecked-higher-value', false, 100000)];

    const countedIds = getWeeklyRevenueCountedIds(bosses);

    expect(countedIds).toEqual(new Set(['checked']));
  });
});

describe('isWeeklyRevenueExcluded', () => {
  const countedIds = new Set(['counted-id']);

  it('已勾選但未上榜的週王要隱藏收益', () => {
    const boss = { id: 'excluded-id', resetCycle: 'weekly' as const, category: undefined, checked: true };
    expect(isWeeklyRevenueExcluded(boss, countedIds)).toBe(true);
  });

  it('已勾選且有上榜的週王不隱藏收益', () => {
    const boss = { id: 'counted-id', resetCycle: 'weekly' as const, category: undefined, checked: true };
    expect(isWeeklyRevenueExcluded(boss, countedIds)).toBe(false);
  });

  it('未勾選的週王一律不隱藏,仍顯示參考價值', () => {
    const boss = { id: 'unchecked-id', resetCycle: 'weekly' as const, category: undefined, checked: false };
    expect(isWeeklyRevenueExcluded(boss, countedIds)).toBe(false);
  });

  it('非每週重置(日/月)的王不受此規則影響', () => {
    const boss = { id: 'monthly-id', resetCycle: 'monthly' as const, category: undefined, checked: true };
    expect(isWeeklyRevenueExcluded(boss, countedIds)).toBe(false);
  });

  it('賽季王不受此規則影響', () => {
    const boss = { id: 'season-id', resetCycle: 'weekly' as const, category: 'season' as const, checked: true };
    expect(isWeeklyRevenueExcluded(boss, countedIds)).toBe(false);
  });
});
