import { ASTRA, DESTINY, GENESIS, SOUL_CAP, SOUL_LEVEL_COSTS } from '@/data/weaponRates.data';
import type { AstraState, DestinyState, GenesisState, SoulState } from './types';
import { UNIT } from './types';

/** 創世全部階段的總需求 */
export const GENESIS_TOTAL = GENESIS.needs.reduce((s, x) => s + x, 0);
/** 靈魂 Lv.1 → Lv.100 的總需求 */
export const SOUL_TOTAL = SOUL_LEVEL_COSTS.reduce((s, x) => s + x, 0);

/** 命運的階段是第幾個階段(1 或 2) */
export function destinyPhaseOf(stage: number): 1 | 2 {
  return stage <= 3 ? 1 : 2;
}

/** 命運目前階段的持有上限(遊戲內整數) */
export function destinyCap(stage: number): number {
  return DESTINY.phaseCaps[destinyPhaseOf(stage) - 1];
}

/**
 * 靈魂武器目前的階:Lv.1~10 為 1 階…;停在整十等級且已完成升階任務時算下一階
 * @param level 目前等級
 * @param gatePassed 整十等級時是否已完成升階任務
 */
export function soulStageOf(level: number, gatePassed: boolean): number {
  const atTen = level % 10 === 0 && level < 100;
  return Math.min(10, Math.ceil(level / 10) + (atTen && gatePassed ? 1 : 0));
}

/** 靈魂是否停在需要完成升階任務的等級(Lv.10、20…90 且還沒升階) */
export function soulAtGate(s: Pick<SoulState, 'level' | 'gatePassed'>): boolean {
  return s.level % 10 === 0 && s.level < 100 && !s.gatePassed;
}

/** 升到下一級需要的碎片(遊戲內整數);已滿級回傳 0 */
export function soulNextCost(level: number): number {
  return level >= 100 ? 0 : SOUL_LEVEL_COSTS[level + 1];
}

/**
 * 依持有的碎片自動升級,停在需要升階任務的等級或 Lv.100;回傳新物件
 * @param s 靈魂狀態
 */
export function soulLevelUp(s: SoulState): SoulState {
  let { level, pool, gatePassed } = s;
  while (level < 100 && !soulAtGate({ level, gatePassed }) && pool >= soulNextCost(level) * UNIT) {
    pool -= soulNextCost(level) * UNIT;
    level++;
    gatePassed = false;
  }
  return { ...s, level, pool, gatePassed, status: level >= 100 && s.status === 'active' ? 'done' : s.status };
}

/** 素材加進持有量並套用上限,回傳新持有量與被上限截掉的量 */
export function addCapped(pool: number, amount: number, cap: number): { pool: number; lost: number } {
  const next = pool + amount;
  return next > cap ? { pool: Math.max(pool, cap), lost: next - Math.max(pool, cap) } : { pool: next, lost: 0 };
}

/** 創世的持有上限(1/60 單位) */
export const GENESIS_CAP_UNITS = GENESIS.cap * UNIT;
/** 靈魂的持有上限(1/60 單位) */
export const SOUL_CAP_UNITS = SOUL_CAP * UNIT;
/** 阿斯特拉痕跡的持有上限(1/60 單位) */
export const ASTRA_TRACE_CAP_UNITS = ASTRA.traceCap * UNIT;

/** 創世本階需求(遊戲內整數) */
export function genesisNeed(stage: number): number {
  return GENESIS.needs[stage - 1] ?? 0;
}

/** 命運本階需求(遊戲內整數) */
export function destinyNeed(stage: number): number {
  return DESTINY.needs[stage - 1] ?? 0;
}

/** 創世本階素材是否足夠(只差 BOSS 任務) */
export function genesisReady(s: GenesisState): boolean {
  return s.status === 'active' && s.pool >= genesisNeed(s.stage) * UNIT;
}

/** 命運本階素材是否足夠 */
export function destinyReady(s: DestinyState): boolean {
  return s.status === 'active' && s.pool >= destinyNeed(s.stage) * UNIT;
}

/** 阿斯特拉兩種素材是否都足夠 */
export function astraReady(s: AstraState): boolean {
  return (
    s.status === 'active' &&
    s.trace >= ASTRA.traceNeeds[s.stage - 1] * UNIT &&
    s.shard >= ASTRA.shardNeeds[s.stage - 1] * UNIT
  );
}

/**
 * 各武器的整體進度(0~100 的小數):和分段進度條同一份資料算出
 * - 創世:(已完成階段需求 + 本階已累積,最多到本階需求)÷ 總需求
 * - 靈魂:(目前等級 + 往下一級的進度)÷ 100
 * - 命運:只看目前所在的階段
 * - 阿斯特拉:兩種素材整體完成度的平均
 */
export function genesisPercent(s: GenesisState): number {
  if (s.status === 'done') return 100;
  const done = GENESIS.needs.slice(0, s.stage - 1).reduce((a, b) => a + b, 0);
  return ((done + Math.min(s.pool / UNIT, genesisNeed(s.stage))) / GENESIS_TOTAL) * 100;
}

export function soulPercent(s: SoulState): number {
  if (s.status === 'done' || s.level >= 100) return 100;
  const cost = soulNextCost(s.level);
  return ((s.level + Math.min(1, cost ? s.pool / UNIT / cost : 0)) / 100) * 100;
}

/** 命運目前所在階段的三個需求 */
export function destinyPhaseNeeds(stage: number): number[] {
  const from = destinyPhaseOf(stage) === 1 ? 0 : 3;
  return DESTINY.needs.slice(from, from + 3);
}

export function destinyPercent(s: DestinyState): number {
  if (s.status === 'done' || s.status === 'phase1done') return 100;
  const needs = destinyPhaseNeeds(s.stage);
  const idx = (s.stage - 1) % 3;
  const done = needs.slice(0, idx).reduce((a, b) => a + b, 0);
  return ((done + Math.min(s.pool / UNIT, needs[idx])) / needs.reduce((a, b) => a + b, 0)) * 100;
}

/** 阿斯特拉單一素材的整體完成度 */
function astraMaterialPercent(needs: readonly number[], stage: number, held: number): number {
  const done = needs.slice(0, stage - 1).reduce((a, b) => a + b, 0);
  return (done + Math.min(held / UNIT, needs[stage - 1])) / needs.reduce((a, b) => a + b, 0);
}

export function astraPercent(s: AstraState): number {
  if (s.status === 'done') return 100;
  return (
    ((astraMaterialPercent(ASTRA.traceNeeds, s.stage, s.trace) + astraMaterialPercent(ASTRA.shardNeeds, s.stage, s.shard)) /
      2) *
    100
  );
}
