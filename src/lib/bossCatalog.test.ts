import { describe, expect, it } from 'vitest';
import type { CharacterBossTrackList } from '@/types';
import {
  buildTrackedGroupKeys,
  getEditableDifficulties,
  getWeeklyRevenueCountedIds,
  isWeeklyRevenueExcluded,
  WEEKLY_BOSS_LIMIT,
} from '@/lib/bossCatalog';

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

/** 建立測試用的完整 BOSS 追蹤紀錄,預設為一般 BOSS,可用 overrides 覆寫 */
function makeTracked(overrides: Partial<CharacterBossTrackList>): CharacterBossTrackList {
  return {
    id: 'b1',
    characterId: 'c1',
    bossName: 'test',
    difficulty: '普通',
    resetCycle: 'daily',
    crystalValue: 1,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildTrackedGroupKeys', () => {
  it('一般追蹤的週王會鎖住該王的每週群組', () => {
    const bosses = [makeTracked({ bossCatalogId: 'lotus', difficulty: '困難', resetCycle: 'weekly' })];
    expect(buildTrackedGroupKeys(bosses, 'c1').has('lotus|weekly')).toBe(true);
  });

  it('VIP 重置券追蹤的王不鎖每週群組(VIP 是另外一次討伐)', () => {
    const bosses = [
      makeTracked({ bossCatalogId: 'lotus', difficulty: '困難', resetCycle: 'weekly', category: 'vip', vipTicketLevel: '中' }),
    ];
    expect(buildTrackedGroupKeys(bosses, 'c1').has('lotus|weekly')).toBe(false);
  });
});

describe('getEditableDifficulties', () => {
  it('一般 BOSS 只回傳同一重置週期的難度(炎魔日王不含週王渾沌)', () => {
    const boss = makeTracked({ bossCatalogId: 'zakum', difficulty: '普通', resetCycle: 'daily' });
    expect(getEditableDifficulties(boss)).toEqual(['簡單', '普通']);
  });

  it('炎魔渾沌(週)只有自己一個難度', () => {
    const boss = makeTracked({ bossCatalogId: 'zakum', difficulty: '渾沌', resetCycle: 'weekly' });
    expect(getEditableDifficulties(boss)).toEqual(['渾沌']);
  });

  it('一般週王回傳該王全部週期相同的難度', () => {
    const boss = makeTracked({ bossCatalogId: 'lucid', difficulty: '困難', resetCycle: 'weekly' });
    expect(getEditableDifficulties(boss)).toEqual(['簡單', '普通', '困難']);
  });

  it('VIP BOSS 依券等級的對照表回傳,不含其他券才能選的難度(中級券史烏沒有極限)', () => {
    const boss = makeTracked({
      bossCatalogId: 'lotus',
      difficulty: '困難',
      resetCycle: 'weekly',
      category: 'vip',
      vipTicketLevel: '中',
    });
    expect(getEditableDifficulties(boss)).toEqual(['普通', '困難']);
  });

  it('沒有 bossCatalogId 的舊資料回傳空陣列', () => {
    expect(getEditableDifficulties(makeTracked({ bossCatalogId: undefined }))).toEqual([]);
  });

  it('目錄查無對應項目時回傳空陣列', () => {
    expect(getEditableDifficulties(makeTracked({ bossCatalogId: 'no-such-boss' }))).toEqual([]);
  });
});
