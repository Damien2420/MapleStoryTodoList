import {
  ASTRA_SHARD_RATES,
  ASTRA_TRACE_RATES,
  DESTINY_RESOLVE_RATES,
  GENESIS_TRACE_RATES,
  SOUL_SHARD_RATES,
  type BossRateTable,
} from '@/data/weaponRates.data';
import type { BossDifficulty } from '@/types';
import { UNIT } from './types';

/** 一次擊破換算成各武器的取得量(1/60 單位) */
export interface ClearAmounts {
  soul: number;
  genesis: number;
  destiny: number;
  astraTrace: number;
  astraShard: number;
}

/** 計算取得量需要的擊破資訊 */
export interface ClearInput {
  bossCatalogId: string;
  difficulty: BossDifficulty;
  partySize: number;
  genesisPass: boolean;
  stormTraining: boolean;
}

/** 查表:沒有這隻 BOSS 或難度時回傳 0 */
function rate(table: BossRateTable, bossCatalogId: string, difficulty: BossDifficulty): number {
  return table[bossCatalogId]?.[difficulty] ?? 0;
}

/** 人數夾在 1~6 之間,避免舊資料或錯誤值讓 1/60 單位出現小數 */
function clampParty(partySize: number): number {
  return Math.min(6, Math.max(1, Math.round(partySize) || 1));
}

/**
 * 把一次擊破換算成四把武器的取得量
 * - 創世:依人數平分,通行證 x3;暴風修練只在有通行證時生效,2 人組隊不平分
 * - 命運、阿斯特拉痕跡:依人數平分
 * - 靈魂、阿斯特拉碎片:不平分
 * @param c 擊破資訊
 * @returns 各武器取得量(1/60 單位,一定是整數)
 */
export function clearAmounts(c: ClearInput): ClearAmounts {
  const party = clampParty(c.partySize);
  const genesisBase = rate(GENESIS_TRACE_RATES, c.bossCatalogId, c.difficulty) * UNIT;
  const noSplit = c.genesisPass && c.stormTraining && party === 2;
  const genesis = (genesisBase * (c.genesisPass ? 3 : 1)) / (noSplit ? 1 : party);
  return {
    soul: rate(SOUL_SHARD_RATES, c.bossCatalogId, c.difficulty) * UNIT,
    genesis,
    destiny: (rate(DESTINY_RESOLVE_RATES, c.bossCatalogId, c.difficulty) * UNIT) / party,
    astraTrace: (rate(ASTRA_TRACE_RATES, c.bossCatalogId, c.difficulty) * UNIT) / party,
    astraShard: rate(ASTRA_SHARD_RATES, c.bossCatalogId, c.difficulty) * UNIT,
  };
}

/** 這隻 BOSS 的這個難度是否對任一把武器有取得量(沒有的不寫紀錄) */
export function hasWeaponRate(bossCatalogId: string, difficulty: BossDifficulty): boolean {
  return [SOUL_SHARD_RATES, GENESIS_TRACE_RATES, DESTINY_RESOLVE_RATES, ASTRA_TRACE_RATES, ASTRA_SHARD_RATES].some(
    (t) => rate(t, bossCatalogId, difficulty) > 0,
  );
}

/** 1/60 單位換算成畫面上的整數(無條件捨去) */
export function toDisplay(units: number): number {
  return Math.floor(units / UNIT + 1e-9);
}
