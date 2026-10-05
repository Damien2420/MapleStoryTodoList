import { describe, expect, it } from 'vitest';
import { compactCharacter, compactWatermark } from './compact';
import { foldWeapons, type FoldInput } from './fold';
import { UNIT } from './types';
import { adjust, at, clear, daily, SETTINGS, simpleEvent, upgrade } from './testUtils';

const fold = (p: Partial<FoldInput>) => foldWeapons({ bossClears: [], dailyClears: [], events: [], settings: SETTINGS, ...p });
const t0 = at(2026, 9, 1, 10);
const genesisSetup = (pool = 0, stage = 1) => adjust(t0, { weapon: 'genesis', stage, pool });

describe('fold:創世', () => {
  it('平分累積無誤差,畫面無條件捨去', () => {
    const r = fold({
      events: [genesisSetup()],
      bossClears: [
        clear({ bossCatalogId: 'will', difficulty: '困難', partySize: 2, firstClearedAt: at(2026, 9, 3).toISOString() }),
        clear({ bossCatalogId: 'will', difficulty: '困難', partySize: 2, firstClearedAt: at(2026, 9, 10).toISOString() }),
      ],
    });
    expect(r.state.genesis.pool).toBe(75 * UNIT);
  });

  it('上限截斷並記錄 capLoss;升階後溢出保留', () => {
    const c = clear({ bossCatalogId: 'black-mage', difficulty: '困難', genesisPass: true, firstClearedAt: at(2026, 9, 3).toISOString() });
    const r = fold({ events: [genesisSetup(2800)], bossClears: [c] });
    expect(r.state.genesis.pool).toBe(3000 * UNIT);
    expect(r.capLoss.get(c.id)?.genesis).toBe(1600 * UNIT);

    const up = fold({ events: [genesisSetup(1840, 3), upgrade(at(2026, 9, 2), 'genesis', 3)] });
    expect(up.state.genesis).toMatchObject({ stage: 4, pool: 1340 * UNIT });
  });

  it('升階 id 重複只算一次;階段不符時不生效;結果小於 0 時為 0', () => {
    const e = upgrade(at(2026, 9, 2), 'genesis', 1);
    const r = fold({ events: [genesisSetup(100), e, { ...e }] });
    expect(r.state.genesis).toMatchObject({ stage: 2, pool: 0 });
    const wrong = fold({ events: [genesisSetup(600, 2), upgrade(at(2026, 9, 2), 'genesis', 1)] });
    expect(wrong.state.genesis.stage).toBe(2);
  });

  it('第 8 階升階後為已解放', () => {
    const r = fold({ events: [genesisSetup(1000, 8), upgrade(at(2026, 9, 2), 'genesis', 8)] });
    expect(r.state.genesis.status).toBe('done');
  });

  it('校正之前的紀錄被忽略', () => {
    const r = fold({
      bossClears: [clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 8, 30).toISOString() })],
      events: [genesisSetup(100)],
    });
    expect(r.state.genesis.pool).toBe(100 * UNIT);
    expect(r.adjustAt.genesis).toBe(t0.toISOString());
  });

  it('未設定的武器不累積;取消勾選(active = false)不計入', () => {
    const r = fold({ bossClears: [clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 3).toISOString() })] });
    expect(r.state.genesis).toMatchObject({ status: 'unset', pool: 0 });
    const off = fold({ events: [genesisSetup()], bossClears: [clear({ bossCatalogId: 'lucid', difficulty: '困難', active: false, firstClearedAt: at(2026, 9, 3).toISOString() })] });
    expect(off.state.genesis.pool).toBe(0);
  });
});

describe('fold:靈魂', () => {
  const soulSetup = adjust(t0, { weapon: 'soul', level: 48, gatePassed: false, pool: 0, soloCleared: [] });

  it('每個遊戲週只取最高一隻', () => {
    const r = fold({
      events: [soulSetup],
      bossClears: [
        clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 3, 10).toISOString() }),
        clear({ bossCatalogId: 'seren', difficulty: '普通', firstClearedAt: at(2026, 9, 4, 10).toISOString() }),
        clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 9, 5, 10).toISOString() }),
        // 下一個遊戲週(9/10 週四之後)
        clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 9, 10, 10).toISOString() }),
      ],
    });
    // 160 + 80 = 240,不夠升 Lv.49(408)
    expect(r.state.soul).toMatchObject({ level: 48, pool: 240 * UNIT });
  });

  it('單人擊破記入已攻略清單,升階後繼續升級', () => {
    const r = fold({
      events: [adjust(t0, { weapon: 'soul', level: 50, gatePassed: false, pool: 500, soloCleared: [] }), upgrade(at(2026, 9, 6), 'soul', 5, 1, 'kalos|渾沌')],
      bossClears: [clear({ bossCatalogId: 'kalos', difficulty: '渾沌', firstClearedAt: at(2026, 9, 3).toISOString() })],
    });
    expect(r.state.soul.soloCleared).toContain('kalos|渾沌');
    // 500 + 550 = 1050;升階後 Lv.51 需要 442、Lv.52 需要 490
    expect(r.state.soul).toMatchObject({ level: 52, pool: (1050 - 442 - 490) * UNIT });
  });

  it('組隊擊破不算單人', () => {
    const r = fold({ events: [soulSetup], bossClears: [clear({ bossCatalogId: 'seren', difficulty: '普通', partySize: 2, firstClearedAt: at(2026, 9, 3).toISOString() })] });
    expect(r.state.soul.soloCleared).toEqual([]);
  });
});

describe('fold:命運與阿斯特拉', () => {
  const genesisDone = [genesisSetup(), simpleEvent(at(2026, 9, 1, 11), 'genesis', 'complete')];

  it('創世未完成時命運不累積', () => {
    const r = fold({
      events: [genesisSetup(), adjust(at(2026, 9, 1, 11), { weapon: 'destiny', stage: 1, pool: 0 })],
      bossClears: [clear({ bossCatalogId: 'limbo', difficulty: '普通', firstClearedAt: at(2026, 9, 3).toISOString() })],
    });
    expect(r.state.destiny.pool).toBe(0);
  });

  it('停在第一階段完成畫面期間不計入;第二階段從 0 開始、上限 15,000', () => {
    const r = fold({
      events: [
        ...genesisDone,
        adjust(at(2026, 9, 1, 12), { weapon: 'destiny', stage: 3, pool: 3000 }),
        upgrade(at(2026, 9, 2), 'destiny', 3, 1),
      ],
      bossClears: [clear({ bossCatalogId: 'limbo', difficulty: '普通', firstClearedAt: at(2026, 9, 3).toISOString() })],
    });
    expect(r.state.destiny).toMatchObject({ status: 'phase1done', pool: 0 });

    const p2 = fold({
      events: [
        ...genesisDone,
        adjust(at(2026, 9, 1, 12), { weapon: 'destiny', stage: 3, pool: 3000 }),
        upgrade(at(2026, 9, 2), 'destiny', 3, 1),
        simpleEvent(at(2026, 9, 2, 13), 'destiny', 'destinyPhase2'),
      ],
      bossClears: [
        clear({ bossCatalogId: 'yubitae', difficulty: '困難', firstClearedAt: at(2026, 9, 3).toISOString() }),
        clear({ bossCatalogId: 'baldrix', difficulty: '困難', firstClearedAt: at(2026, 9, 3, 13).toISOString() }),
      ],
    });
    expect(p2.state.destiny).toMatchObject({ status: 'active', stage: 4, pool: 950 * UNIT });
    const capped = fold({ events: [...genesisDone, adjust(at(2026, 9, 1, 12), { weapon: 'destiny', stage: 5, pool: 99_999 })] });
    expect(capped.state.destiny.pool).toBe(15_000 * UNIT);
  });

  it('阿斯特拉:碎片無上限、每日加最高地區;兩種素材都扣除', () => {
    const r = fold({
      events: [...genesisDone, adjust(at(2026, 9, 1, 12), { weapon: 'astra', stage: 2, trace: 760, shard: 2990 })],
      dailyClears: [daily(at(2026, 9, 3, 9), 25)],
      bossClears: [clear({ bossCatalogId: 'kaling', difficulty: '困難', partySize: 2, firstClearedAt: at(2026, 9, 3, 10).toISOString() })],
    });
    expect(r.state.astra).toMatchObject({ trace: 880 * UNIT, shard: 3075 * UNIT });
    const up = fold({ events: [...genesisDone, adjust(at(2026, 9, 1, 12), { weapon: 'astra', stage: 2, trace: 760, shard: 3120 }), upgrade(at(2026, 9, 2), 'astra', 2)] });
    expect(up.state.astra).toMatchObject({ stage: 3, trace: 160 * UNIT, shard: 120 * UNIT });
  });

  it('創世改回進行中時,命運的紀錄保留', () => {
    const r = fold({
      events: [...genesisDone, adjust(at(2026, 9, 1, 12), { weapon: 'destiny', stage: 2, pool: 1000 }), adjust(at(2026, 9, 3), { weapon: 'genesis', stage: 8, pool: 0 })],
    });
    expect(r.state.genesis.status).toBe('active');
    expect(r.state.destiny).toMatchObject({ status: 'active', stage: 2, pool: 1000 * UNIT });
  });
});

describe('compact', () => {
  const now = at(2026, 11, 20);
  const records = {
    characterId: 'c1',
    events: [
      adjust(t0, { weapon: 'soul', level: 48, gatePassed: false, pool: 0, soloCleared: [] }),
      genesisSetup(),
      upgrade(at(2026, 9, 20), 'genesis', 1),
    ],
    bossClears: Array.from({ length: 10 }, (_, w) => [
      clear({ bossCatalogId: 'lucid', difficulty: '困難', partySize: 1, firstClearedAt: at(2026, 9, 3 + w * 7, 10).toISOString() }),
      clear({ bossCatalogId: 'seren', difficulty: '普通', partySize: 2, firstClearedAt: at(2026, 9, 4 + w * 7, 10).toISOString() }),
    ]).flat(),
    dailyClears: [daily(at(2026, 9, 5), 10)],
  };

  it('先壓縮再算,結果等於全部重算(含靈魂已單人擊破清單)', () => {
    const wm = compactWatermark(now, SETTINGS);
    const full = foldWeapons({ ...records, settings: SETTINGS }).state;
    const result = compactCharacter(records, wm, SETTINGS, now.toISOString())!;
    expect(result).not.toBeNull();
    const removed = new Set(result.removeBossClearIds);
    const after = foldWeapons({
      checkpoint: result.checkpoint,
      bossClears: records.bossClears.filter((c) => !removed.has(c.id)),
      dailyClears: records.dailyClears.filter((d) => !result.removeDailyClearIds.includes(d.id)),
      events: records.events.filter((e) => !result.removeEventIds.includes(e.id)),
      settings: SETTINGS,
    }).state;
    expect(after).toEqual(full);
    expect(after.soul.soloCleared).toContain('lucid|困難');
  });

  it('watermark 對齊遊戲週,未結束的月週期不被壓縮', () => {
    const wm = compactWatermark(now, SETTINGS);
    expect(wm.getDay()).toBe(4);
    // 月王的週期(10 月)在 11/1 結束,早於寬限期(10/23)… 10 月的紀錄只有在 watermark 之前的才會被壓縮
    expect(wm <= at(2026, 10, 1, 0)).toBe(true);
  });

  it('沒有可壓縮的資料時回傳 null', () => {
    expect(compactCharacter({ characterId: 'c1', bossClears: [], dailyClears: [], events: [] }, compactWatermark(now, SETTINGS), SETTINGS, now.toISOString())).toBeNull();
    const wm = compactWatermark(now, SETTINGS);
    const once = compactCharacter(records, wm, SETTINGS, now.toISOString())!;
    expect(compactCharacter({ ...records, checkpoint: once.checkpoint }, wm, SETTINGS, now.toISOString())).toBeNull();
  });
});

describe('校正量防呆', () => {
  it('負數與 NaN 的持有量一律當 0', () => {
    for (const pool of [-100, Number.NaN]) {
      const { state } = foldWeapons({ bossClears: [], dailyClears: [], events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 2, pool })], settings: SETTINGS });
      expect(state.genesis.pool).toBe(0);
      const d = foldWeapons({ bossClears: [], dailyClears: [], events: [adjust(at(2026, 10, 1), { weapon: 'destiny', stage: 2, pool })], settings: SETTINGS });
      expect(d.state.destiny.pool).toBe(0);
    }
  });
});
