import { describe, expect, it } from 'vitest';
import {
  ASTRA,
  ASTRA_SHARD_RATES,
  ASTRA_TRACE_RATES,
  DESTINY,
  DESTINY_RESOLVE_RATES,
  GENESIS,
  GENESIS_TRACE_RATES,
  SOUL_LEVEL_COSTS,
  SOUL_QUESTS,
  SOUL_SHARD_RATES,
} from '@/data/weaponRates.data';
import { findBossCatalogEntry, findDifficultyOption } from '@/lib/bossCatalog';
import type { BossDifficulty } from '@/types';
import { clearAmounts } from './rates';
import { GENESIS_TOTAL, SOUL_TOTAL, soulLevelUp, soulStageOf } from './rules';
import { UNIT } from './types';

describe('數值表', () => {
  it('各武器總需求與官方表一致', () => {
    expect(GENESIS_TOTAL).toBe(6500);
    expect(SOUL_TOTAL).toBe(129_500);
    expect(DESTINY.needs.slice(0, 3).reduce((a, b) => a + b, 0)).toBe(7500);
    expect(DESTINY.needs.slice(3).reduce((a, b) => a + b, 0)).toBe(37_500);
    expect(ASTRA.traceNeeds.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(ASTRA.shardNeeds.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it('靈魂每階的總需求與官方表一致', () => {
    const stageTotals = Array.from({ length: 10 }, (_, s) => SOUL_LEVEL_COSTS.slice(s * 10 + 1, s * 10 + 11).reduce((a, b) => a + b, 0));
    expect(stageTotals).toEqual([100, 450, 900, 1800, 3200, 6550, 9750, 22750, 39000, 45000]);
    expect(SOUL_LEVEL_COSTS[49]).toBe(408);
  });

  it('每個 BOSS 與難度都存在於 BOSS 目錄', () => {
    const tables = [SOUL_SHARD_RATES, GENESIS_TRACE_RATES, DESTINY_RESOLVE_RATES, ASTRA_TRACE_RATES, ASTRA_SHARD_RATES];
    for (const table of tables) {
      for (const [id, row] of Object.entries(table)) {
        const entry = findBossCatalogEntry(id);
        expect(entry, id).toBeDefined();
        for (const difficulty of Object.keys(row) as BossDifficulty[]) {
          expect(findDifficultyOption(entry!, difficulty), `${id} ${difficulty}`).toBeDefined();
        }
      }
    }
    for (const list of Object.values(SOUL_QUESTS)) {
      for (const q of list) expect(findDifficultyOption(findBossCatalogEntry(q.bossCatalogId)!, q.difficulty)).toBeDefined();
    }
    for (const q of [...GENESIS.quests, ...DESTINY.quests]) expect(findBossCatalogEntry(q.bossCatalogId), q.name).toBeDefined();
  });
});

describe('取得量換算', () => {
  const base = { partySize: 1, genesisPass: false, stormTraining: false };

  it('平分以 1/60 單位累積沒有誤差', () => {
    const a = clearAmounts({ ...base, bossCatalogId: 'will', difficulty: '困難', partySize: 2 });
    expect(a.genesis).toBe((75 * UNIT) / 2);
    const six = clearAmounts({ ...base, bossCatalogId: 'black-mage', difficulty: '困難', partySize: 6 });
    expect(six.genesis * 6).toBe(600 * UNIT);
    expect(Number.isInteger(clearAmounts({ ...base, bossCatalogId: 'lucid', difficulty: '簡單', partySize: 4 }).genesis)).toBe(true);
  });

  it('通行證 x3;暴風修練只在有通行證時讓 2 人組隊不平分', () => {
    expect(clearAmounts({ ...base, bossCatalogId: 'lucid', difficulty: '困難', genesisPass: true }).genesis).toBe(195 * UNIT);
    expect(clearAmounts({ ...base, bossCatalogId: 'will', difficulty: '困難', partySize: 2, genesisPass: true, stormTraining: true }).genesis).toBe(225 * UNIT);
    expect(clearAmounts({ ...base, bossCatalogId: 'will', difficulty: '困難', partySize: 2, stormTraining: true }).genesis).toBe(37.5 * UNIT);
    // 3 人組隊時暴風修練不生效
    expect(clearAmounts({ ...base, bossCatalogId: 'will', difficulty: '困難', partySize: 3, genesisPass: true, stormTraining: true }).genesis).toBe(75 * UNIT);
  });

  it('靈魂與艾里溫碎片不平分;命運與激戰的痕跡平分', () => {
    const a = clearAmounts({ ...base, bossCatalogId: 'kaling', difficulty: '困難', partySize: 2 });
    expect(a.soul).toBe(900 * UNIT);
    expect(a.astraShard).toBe(60 * UNIT);
    expect(a.destiny).toBe(80 * UNIT);
    expect(a.astraTrace).toBe(120 * UNIT);
  });
});

describe('靈魂等級', () => {
  it('依碎片自動升級並停在升階等級', () => {
    const s = soulLevelUp({ status: 'active', level: 48, gatePassed: false, pool: 2000 * UNIT, soloCleared: [] });
    expect(s.level).toBe(50);
    expect(s.pool).toBe((2000 - 408 - 434) * UNIT);
    expect(soulStageOf(50, false)).toBe(5);
    expect(soulStageOf(50, true)).toBe(6);
  });

  it('升到 Lv.100 時標記為已完成', () => {
    const s = soulLevelUp({ status: 'active', level: 99, gatePassed: false, pool: 6000 * UNIT, soloCleared: [] });
    expect(s.level).toBe(100);
    expect(s.status).toBe('done');
  });
});
