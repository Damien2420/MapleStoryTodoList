import { describe, expect, it } from 'vitest';
import { compactCharacter, compactWatermark } from './compact';
import { adjustUnchanged, foldWeapons, type FoldInput } from './fold';
import { emptyWeaponState, UNIT } from './types';
import { adjust, at, clear, daily, SETTINGS, simpleEvent, soulAuto, soulLevel, upgrade } from './testUtils';

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

  it('校正時勾選要加入的 BOSS:只加勾選的那幾隻,記錄在 adjustIncluded', () => {
    const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 1, 8).toISOString() });
    const will = clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 9, 1, 9).toISOString() });
    const r = fold({ bossClears: [lucid, will], events: [adjust(t0, { weapon: 'genesis', stage: 1, pool: 100, includeClearIds: [lucid.id] })] });
    expect(r.state.genesis.pool).toBe((100 + 65) * UNIT);
    expect(r.adjustIncluded.genesis).toEqual([lucid.id]);
  });

  it('加入的 BOSS 之後取消勾選不計入;取消後重新勾選(時間在校正之後)只算一次', () => {
    const off = clear({ bossCatalogId: 'lucid', difficulty: '困難', active: false, firstClearedAt: at(2026, 9, 1, 8).toISOString() });
    const e = adjust(t0, { weapon: 'genesis', stage: 1, pool: 100, includeClearIds: [off.id] });
    expect(fold({ bossClears: [off], events: [e] }).state.genesis.pool).toBe(100 * UNIT);
    const recheck = { ...off, active: true, firstClearedAt: at(2026, 9, 2).toISOString() };
    expect(fold({ bossClears: [recheck], events: [e] }).state.genesis.pool).toBe((100 + 65) * UNIT);
  });

  it('上次校正後勾的(已計入)在下次校正被勾選加入:加在新填的值上', () => {
    const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 2).toISOString() });
    const again = adjust(at(2026, 9, 3), { weapon: 'genesis', stage: 2, pool: 10, includeClearIds: [lucid.id] });
    const r = fold({ bossClears: [lucid], events: [genesisSetup(), again] });
    expect(r.state.genesis).toMatchObject({ stage: 2, pool: (10 + 65) * UNIT });
  });

  it('靈魂校正時選擇加入本週週王:加在填的值上;之後再打的只補超過本週最高的部分', () => {
    // Lv.40 停在升階關卡,碎片不會被自動升級吃掉,方便比對持有量
    const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 1, 8).toISOString() });
    const e = adjust(t0, { weapon: 'soul', level: 40, gatePassed: false, pool: 100, soloCleared: [], includeClearIds: [lucid.id] });
    expect(fold({ bossClears: [lucid], events: [e] }).state.soul.pool).toBe((100 + 80) * UNIT);
    const will = clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: at(2026, 9, 2).toISOString() });
    expect(fold({ bossClears: [lucid, will], events: [e] }).state.soul.pool).toBe((100 + 80) * UNIT);
    const gloom = clear({ bossCatalogId: 'gloom', difficulty: '渾沌', firstClearedAt: at(2026, 9, 2).toISOString() });
    expect(fold({ bossClears: [lucid, gloom], events: [e] }).state.soul.pool).toBe((100 + 90) * UNIT);
  });

  it('加入的量套用持有上限並記錄 capLoss', () => {
    const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 1, 8).toISOString() });
    const r = fold({ bossClears: [lucid], events: [adjust(t0, { weapon: 'genesis', stage: 1, pool: 2980, includeClearIds: [lucid.id] })] });
    expect(r.state.genesis.pool).toBe(3000 * UNIT);
    expect(r.capLoss.get(lucid.id)?.genesis).toBe(45 * UNIT);
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

describe('fold:靈魂自動升級開關', () => {
  const lucid = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: at(2026, 9, 3).toISOString() });
  const manualSetup = adjust(t0, { weapon: 'soul', level: 48, gatePassed: false, pool: 1000, soloCleared: [], autoLevel: false });

  it('關閉時填的碎片與打王累積都不升級;之後校正沒帶開關時維持關閉', () => {
    expect(fold({ events: [manualSetup], bossClears: [lucid] }).state.soul).toMatchObject({ level: 48, pool: 1080 * UNIT, autoLevel: false });
    const again = adjust(at(2026, 9, 2), { weapon: 'soul', level: 48, gatePassed: false, pool: 2000, soloCleared: [] });
    expect(fold({ events: [manualSetup, again] }).state.soul).toMatchObject({ level: 48, pool: 2000 * UNIT });
  });

  it('從關閉改成開啟時立即升級,停在升階關卡', () => {
    // 1000 - 408(Lv.49)- 434(Lv.50)= 158,停在 Lv.50 的升階關卡
    const r = fold({ events: [manualSetup, soulAuto(at(2026, 9, 2), true)] });
    expect(r.state.soul).toMatchObject({ level: 50, pool: 158 * UNIT, autoLevel: true });
  });

  it('關閉前已自動升的等級不會被退回,之後的碎片只累積', () => {
    // 1000 - 332(Lv.46)- 358(Lv.47)= 310;關閉後 +80 = 390,超過 Lv.48 的 383 也不升級
    const auto = adjust(t0, { weapon: 'soul', level: 45, gatePassed: false, pool: 1000, soloCleared: [] });
    const r = fold({ events: [auto, soulAuto(at(2026, 9, 2), false)], bossClears: [lucid] });
    expect(r.state.soul).toMatchObject({ level: 47, pool: 390 * UNIT });
  });

  it('手動升級:扣掉各級碎片,不超過碎片足夠與升階關卡的等級', () => {
    expect(fold({ events: [manualSetup, soulLevel(at(2026, 9, 2), 49)] }).state.soul).toMatchObject({ level: 49, pool: 592 * UNIT });
    expect(fold({ events: [manualSetup, soulLevel(at(2026, 9, 2), 60)] }).state.soul).toMatchObject({ level: 50, pool: 158 * UNIT });
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

describe('adjustUnchanged', () => {
  it('進行中且填的值與畫面顯示的目前狀態相同時視為沒改;持有量的小數以畫面顯示的整數比較', () => {
    const state = emptyWeaponState();
    state.genesis = { status: 'active', stage: 3, pool: 112.5 * UNIT };
    expect(adjustUnchanged(state, { weapon: 'genesis', stage: 3, pool: 112 })).toBe(true);
    expect(adjustUnchanged(state, { weapon: 'genesis', stage: 3, pool: 113 })).toBe(false);
    expect(adjustUnchanged(state, { weapon: 'genesis', stage: 4, pool: 112 })).toBe(false);
  });

  it('未設定或已完成的武器一律視為有改', () => {
    const state = emptyWeaponState();
    expect(adjustUnchanged(state, { weapon: 'genesis', stage: 1, pool: 0 })).toBe(false);
    state.genesis = { status: 'done', stage: 8, pool: 0 };
    expect(adjustUnchanged(state, { weapon: 'genesis', stage: 8, pool: 0 })).toBe(false);
  });

  it('靈魂比較等級、關卡、碎片與單人擊破清單(不看順序)', () => {
    const state = emptyWeaponState();
    state.soul = { status: 'active', level: 50, gatePassed: false, pool: 30 * UNIT, soloCleared: ['a', 'b'] };
    expect(adjustUnchanged(state, { weapon: 'soul', level: 50, gatePassed: false, pool: 30, soloCleared: ['b', 'a'] })).toBe(true);
    expect(adjustUnchanged(state, { weapon: 'soul', level: 50, gatePassed: false, pool: 30, soloCleared: ['a'] })).toBe(false);
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

  it('還沒壓縮的校正事件加入的 BOSS 紀錄保留,壓縮後結果不變', () => {
    const wm = compactWatermark(now, SETTINGS);
    const old = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: new Date(wm.getTime() - 3600_000).toISOString() });
    const e = adjust(new Date(wm.getTime() + 3600_000), { weapon: 'genesis', stage: 1, pool: 0, includeClearIds: [old.id] });
    const input = { characterId: 'c1', bossClears: [old], dailyClears: [], events: [e] };
    const full = foldWeapons({ ...input, settings: SETTINGS }).state;
    const result = compactCharacter(input, wm, SETTINGS, now.toISOString());
    expect(result?.removeBossClearIds ?? []).not.toContain(old.id);
    const after = foldWeapons({ ...input, checkpoint: result?.checkpoint, settings: SETTINGS }).state;
    expect(after.genesis).toEqual(full.genesis);
    expect(after.genesis.pool).toBe(65 * UNIT);
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
