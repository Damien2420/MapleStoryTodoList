import { describe, expect, it } from 'vitest';
import { estimateWeapons, formatEta, type EstimateInput } from './estimate';
import { foldWeapons } from './fold';
import { computeThisWeek } from './thisWeek';
import { emptyWeaponState, UNIT, type CharacterWeaponState } from './types';
import { SOUL_LEVEL_COSTS } from '@/data/weaponRates.data';
import { adjust, at, boss, clear, daily, SETTINGS, task } from './testUtils';

// 2026/10/2 是週五,本遊戲週從 10/1(週四)開始
const NOW = at(2026, 10, 2, 12);
const PROFILE = { genesisPass: false, stormTraining: false };

function stateWith(p: Partial<CharacterWeaponState>): CharacterWeaponState {
  return { ...emptyWeaponState(), ...p };
}

const est = (p: Partial<EstimateInput>) =>
  estimateWeapons({ state: emptyWeaponState(), trackedBosses: [], tasks: [], profile: PROFILE, settings: SETTINGS, now: NOW, ...p });

describe('estimate', () => {
  it('創世:加總每週取得量,節點日期為重置日,最後一個節點為解放', () => {
    const r = est({
      state: stateWith({ genesis: { status: 'active', stage: 8, pool: 0 } }),
      trackedBosses: [boss({ bossCatalogId: 'verus-hilla', difficulty: '困難' }), boss({ bossCatalogId: 'darknell', difficulty: '困難' })],
    });
    // 每週 165:本週 165 → 第 6 週累積 1,155 ≥ 1,000
    expect(r.genesis.none).toBe(false);
    expect(r.genesis.nodes).toHaveLength(1);
    expect(r.genesis.nodes[0]).toMatchObject({ label: '解放', weeks: 6 });
    expect(r.genesis.nodes[0].date).toEqual(at(2026, 11, 12, 0));
  });

  it('本週只加還能取得的量(已勾選的不重複計入)', () => {
    const tracked = [boss({ bossCatalogId: 'verus-hilla', difficulty: '困難', checked: true })];
    const r = est({ state: stateWith({ genesis: { status: 'active', stage: 1, pool: 450 * UNIT } }), trackedBosses: tracked });
    // 本週已打,剩餘 0;下週 +90 → 540 ≥ 500
    expect(r.genesis.nodes[0]).toMatchObject({ label: '2 階', weeks: 1 });
  });

  it('月王只在每月重置的那一週加入', () => {
    const r = est({
      state: stateWith({ genesis: { status: 'active', stage: 4, pool: 0 } }),
      trackedBosses: [boss({ bossCatalogId: 'black-mage', difficulty: '困難', checked: true })],
    });
    // 每月 +600:11/1 那週 600,12/1 那週 1,200 ≥ 1,000
    expect(r.genesis.nodes[0].date).toEqual(at(2026, 11, 26, 0));
  });

  it('每週取得量為 0 時無法推算', () => {
    const r = est({ state: stateWith({ genesis: { status: 'active', stage: 1, pool: 0 } }) });
    expect(r.genesis.none).toBe(true);
  });

  it('靈魂取最高;時間軸只到本階段結束', () => {
    const r = est({
      state: stateWith({ soul: { status: 'active', level: 48, gatePassed: false, pool: 380 * UNIT, soloCleared: [] } }),
      trackedBosses: [boss({ bossCatalogId: 'seren', difficulty: '普通', checked: true }), boss({ bossCatalogId: 'lucid', difficulty: '困難' })],
    });
    // 本週已打賽蓮(最高),不再增加;下週 +160 → 540 升 Lv.49(剩 132);再 2 週 452 升 Lv.50
    expect(r.soul.nodes.map((n) => [n.label, n.weeks])).toEqual([
      ['Lv.49', 1],
      ['Lv.50', 3],
    ]);
    expect(r.soulFull.slice(0, 4).every((row) => row.done)).toBe(true);
    expect(r.soulFull[4]).toMatchObject({ done: false, weeks: 3 });
  });

  it('命運:第一階段完成後接第二階段,時間軸只推到第一階段完成;套用上限', () => {
    const r = est({
      state: stateWith({ genesis: { status: 'done', stage: 8, pool: 0 }, destiny: { status: 'active', stage: 3, pool: 2900 * UNIT } }),
      trackedBosses: [boss({ bossCatalogId: 'yubitae', difficulty: '困難' })],
    });
    expect(r.destiny.nodes.map((n) => n.label)).toEqual(['完成']);
    expect(r.destinyFull[2]).toMatchObject({ weeks: 0 });
    // 第二階段:每週 500,10,000 需要 20 週
    expect(r.destinyFull[3].weeks).toBe(20);
  });

  it('阿斯特拉以較慢的素材為準,每日 x 7;沒追蹤每日時只算 BOSS', () => {
    const state = stateWith({ genesis: { status: 'done', stage: 8, pool: 0 }, astra: { status: 'active', stage: 3, trace: 800 * UNIT, shard: 3000 * UNIT } });
    const tracked = [boss({ bossCatalogId: 'yubitae', difficulty: '普通', checked: true })];
    const withDaily = est({ state, trackedBosses: tracked, tasks: [task({ name: '塔拉哈特', presetId: 'grandis-daily' })] });
    // 碎片還差 1,000;每週 45 + 45 x 7 = 360
    expect(withDaily.astra.nodes[0].label).toBe('完成');
    const bossOnly = est({ state, trackedBosses: tracked });
    expect(bossOnly.astra.nodes[0].weeks).toBeGreaterThan(withDaily.astra.nodes[0].weeks);
  });

  it('時間文字:本週、週、個月、年', () => {
    expect(formatEta(0, NOW, NOW)).toBe('本週');
    expect(formatEta(3, at(2026, 10, 22), NOW)).toBe('約 3 週');
    expect(formatEta(20, at(2027, 2, 18), NOW)).toBe('約 5 個月');
    expect(formatEta(300, at(2031, 6, 26), NOW)).toBe('約 4.7 年');
    expect(formatEta(40, at(2027, 7, 2), NOW)).toBe('約 9 個月');
    expect(formatEta(78, at(2028, 4, 2), NOW)).toBe('約 1.5 年');
  });

  it('模擬上限 30 年', () => {
    const r = est({
      state: stateWith({ soul: { status: 'active', level: 90, gatePassed: true, pool: 0, soloCleared: [] } }),
      trackedBosses: [boss({ bossCatalogId: 'cygnus', difficulty: '普通' })],
    });
    // 每週 10,Lv.91~100 需要 45,000:約 86 年
    expect(r.soul.none).toBe(true);
  });
});

describe('estimate 邊界', () => {
  it('月初剛好落在週重置時刻(10/1 週四 00:00)時,那個月的月王算在該週', () => {
    // 2026/9/28 是週一,10/1 00:00 同時是週重置與月重置
    const r = est({
      now: at(2026, 9, 28, 12),
      state: stateWith({ genesis: { status: 'active', stage: 8, pool: 0 } }),
      trackedBosses: [boss({ bossCatalogId: 'black-mage', difficulty: '困難', checked: true, lastResetAt: at(2026, 9, 28, 1).toISOString() })],
    });
    // 每月 +600:10/1 那週 600、11/1 那週共 1,200 ≥ 1,000,在第 5 週(舊寫法漏掉 10/1 那一次,要到第 9 週)
    expect(r.genesis.nodes[0].weeks).toBe(5);
  });

  it('追蹤項目被刪掉後,本週靈魂只加還能多拿的差額', () => {
    const level = 12;
    const state = (pool: number) => stateWith({ soul: { status: 'active', level, gatePassed: false, pool: pool * UNIT, soloCleared: [] } });
    const cost = SOUL_LEVEL_COSTS[level + 1];
    const tracked = [boss({ bossCatalogId: 'seren', difficulty: '普通' })];
    // 差 160 就能升級:本週還沒打時本週就能升;本週已打過 160(之後追蹤項目被刪掉)時要等下週
    const fresh = est({ state: state(cost - 160), trackedBosses: tracked });
    const done = est({ state: state(cost - 160), trackedBosses: tracked, soulDoneThisWeek: 160 * UNIT });
    expect(fresh.soul.nodes[0].weeks).toBe(0);
    expect(done.soul.nodes[0].weeks).toBe(1);
  });

  it('每日重置晚於每週重置時,本週每日碎片最多算 7 天', () => {
    const settings = { ...SETTINGS, dailyResetTime: '05:00' };
    const a = est({ settings, now: at(2026, 10, 1, 3), state: stateWith({ astra: { status: 'active', stage: 1, trace: 0, shard: 0 } }), tasks: [task({ name: '卡爾西溫', presetId: 'grandis-daily' })] });
    const b = est({ settings, now: at(2026, 10, 1, 6), state: stateWith({ astra: { status: 'active', stage: 1, trace: 0, shard: 0 } }), tasks: [task({ name: '卡爾西溫', presetId: 'grandis-daily' })] });
    expect(a.gain.astraShard).toBe(b.gain.astraShard);
  });
});

describe('thisWeek 邊界', () => {
  it('每日重置晚於每週重置時,週重置後到每日重置前仍有今天格', () => {
    const settings = { ...SETTINGS, dailyResetTime: '05:00' };
    const now = at(2026, 10, 1, 3);
    const fold = foldWeapons({ bossClears: [], dailyClears: [], events: [], settings });
    const r = computeThisWeek({ bossClears: [], dailyClears: [], fold, trackedBosses: [], tasks: [task({ name: '卡爾西溫', presetId: 'grandis-daily' })], profile: PROFILE, settings, now });
    expect(r.daily.cells.filter((c) => c.today)).toHaveLength(1);
  });
});

describe('thisWeek', () => {
  const setup = adjust(at(2026, 9, 1), { weapon: 'genesis', stage: 3, pool: 2200 });

  it('清單、計入量標記與超過上限的量', () => {
    const clears = [
      clear({ bossCatalogId: 'lucid', difficulty: '困難', genesisPass: true, firstClearedAt: at(2026, 10, 1, 10).toISOString() }),
      clear({ bossCatalogId: 'will', difficulty: '困難', genesisPass: true, partySize: 2, firstClearedAt: at(2026, 10, 1, 11).toISOString() }),
      clear({ bossCatalogId: 'black-mage', difficulty: '困難', genesisPass: true, partySize: 6, firstClearedAt: at(2026, 10, 2, 10).toISOString(), cycleEnd: at(2026, 11, 1, 0).toISOString() }),
      // 上週的紀錄不列出
      clear({ bossCatalogId: 'gloom', difficulty: '渾沌', firstClearedAt: at(2026, 9, 25, 10).toISOString() }),
    ];
    const fold = foldWeapons({ checkpoint: undefined, bossClears: clears, dailyClears: [], events: [setup], settings: SETTINGS });
    const r = computeThisWeek({ bossClears: clears, dailyClears: [], fold, trackedBosses: [], tasks: [], profile: PROFILE, settings: SETTINGS, now: NOW });
    const g = r.weapons.genesis;
    expect(g.rows.map((row) => row.clear.bossCatalogId)).toEqual(['black-mage', 'lucid', 'will']);
    expect(g.rows.find((row) => row.clear.bossCatalogId === 'will')?.split).toBe(2);
    expect(g.rows.find((row) => row.clear.bossCatalogId === 'black-mage')?.monthly).toBe(true);
    expect(g.total).toBe((300 + 195 + 112.5) * UNIT);
    // 2,200 + 65(上週戴斯克)+ 607.5 = 2,872.5,未超過
    expect(g.capLoss).toBe(0);
  });

  it('勾選之後才校正:本週已打的 BOSS 照樣列出,但持有量只加校正後勾的', () => {
    const clears = [
      clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 10, 1, 10).toISOString() }),
      clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 10, 2, 11).toISOString() }),
    ];
    const adj = adjust(at(2026, 10, 2, 9), { weapon: 'genesis', stage: 3, pool: 2200 });
    const fold = foldWeapons({ checkpoint: undefined, bossClears: clears, dailyClears: [], events: [adj], settings: SETTINGS });
    const r = computeThisWeek({ bossClears: clears, dailyClears: [], fold, trackedBosses: [], tasks: [], profile: PROFILE, settings: SETTINGS, now: NOW });
    const rows = r.weapons.genesis.rows;
    expect(rows.map((row) => row.clear.bossCatalogId)).toEqual(['will', 'lucid']);
    // 路西德在校正之前打,已包含在填的 2,200 裡;只有校正後的威爾會再加上去
    expect(fold.state.genesis.pool).toBe(2200 * UNIT + rows[0].amount);
  });

  it('本週還沒打時回傳還能取得的量;清單沒追蹤來源時標記 untracked', () => {
    const fold = foldWeapons({ bossClears: [], dailyClears: [], events: [setup], settings: SETTINGS });
    const base = { bossClears: [], dailyClears: [], fold, tasks: [], profile: PROFILE, settings: SETTINGS, now: NOW };
    const r = computeThisWeek({ ...base, trackedBosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難' }), boss({ bossCatalogId: 'seren', difficulty: '普通' })] });
    expect(r.weapons.genesis).toMatchObject({ potential: 65 * UNIT, untracked: false });
    expect(r.weapons.soul.potential).toBe(160 * UNIT);
    expect(r.weapons.destiny.untracked).toBe(true);
  });

  it('每日 7 格五種狀態', () => {
    const fold = foldWeapons({ bossClears: [], dailyClears: [], events: [], settings: SETTINGS });
    const tasks = [task({ name: '桃源境', presetId: 'grandis-daily' }), task({ name: '卡爾西溫', presetId: 'grandis-daily' })];
    const now = at(2026, 10, 6, 12); // 週二
    const dailies = [daily(at(2026, 10, 1, 9), 25), daily(at(2026, 10, 2, 9), 10), daily(at(2026, 10, 4, 9), 25)];
    const r = computeThisWeek({ bossClears: [], dailyClears: dailies, fold, trackedBosses: [], tasks, profile: PROFILE, settings: SETTINGS, now });
    expect(r.daily.cells.map((c) => c.status)).toEqual(['full', 'part', 'miss', 'full', 'miss', 'future', 'future']);
    expect(r.daily.cells[5].today).toBe(true);
    expect(r.daily.total).toBe(60);
    expect(r.daily.maxRegion).toBe('卡爾西溫');
    const none = computeThisWeek({ bossClears: [], dailyClears: [], fold, trackedBosses: [], tasks: [], profile: PROFILE, settings: SETTINGS, now });
    expect(none.daily.untracked).toBe(true);
  });
});
