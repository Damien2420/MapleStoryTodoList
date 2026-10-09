import { describe, expect, it } from 'vitest';
import { derivedNeedsPush } from './syncClears';
import { at, clear, daily } from './testUtils';
import { emptyWeaponSnapshot } from './types';

describe('derivedNeedsPush', () => {
  const boss = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() });
  const day = daily(at(2026, 10, 1), 25);
  const written = { ...emptyWeaponSnapshot(), bossClears: [boss], dailyClears: [day] };

  it('新增了寫回快照裡沒有的紀錄時需要推送', () => {
    const other = clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() });
    expect(derivedNeedsPush(written, { bossClears: [other], dailyClears: [] })).toBe(true);
    expect(derivedNeedsPush(emptyWeaponSnapshot(), { bossClears: [], dailyClears: [day] })).toBe(true);
  });

  it('每日碎片變高時需要推送', () => {
    expect(derivedNeedsPush(written, { bossClears: [], dailyClears: [{ ...day, topRegionShards: 40 }] })).toBe(true);
  });

  it('只修改既有紀錄（生效狀態、碎片變低）時不需要推送', () => {
    expect(derivedNeedsPush(written, { bossClears: [{ ...boss, active: false }], dailyClears: [{ ...day, topRegionShards: 10 }] })).toBe(false);
    expect(derivedNeedsPush(written, { bossClears: [], dailyClears: [] })).toBe(false);
  });
});
