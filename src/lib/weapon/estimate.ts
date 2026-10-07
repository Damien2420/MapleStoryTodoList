import { ASTRA, DESTINY, GENESIS, GRANDIS_DAILY_PRESET_ID, GRANDIS_DAILY_SHARDS } from '@/data/weaponRates.data';
import type { BossDifficulty, CharacterBossTrackList, CharacterTask, Settings } from '@/types';
import { addDays, cycleBounds, dayBounds, daysBetween, gameWeekBounds } from './cycle';
import { clearAmounts, hasWeaponRate, type ClearAmounts } from './rates';
import { addCapped, destinyCap, soulAtGate, soulNextCost, soulStageOf, SOUL_CAP_UNITS } from './rules';
import { UNIT, type CharacterWeaponState, type WeaponProfile } from './types';

/** 模擬的上限:30 年 */
export const MAX_SIM_WEEKS = 30 * 52 + 8;

/** 時間軸上的一個節點 */
export interface EstimateNode {
  /** 節點標籤,例如「5 階」「Lv.49」「解放」 */
  label: string;
  /** 預計達成日:本週為今天,之後為達標那一週的重置日 */
  date: Date;
  /** 從本週起算第幾週(0 = 本週) */
  weeks: number;
}

/** 單一武器的預估;none 代表每週取得量為 0、無法推算 */
export interface WeaponEstimate {
  none: boolean;
  nodes: EstimateNode[];
}

/** 完整預估的一列(靈魂 1~10 階、命運 1~6 階);沒完成且 date 為 null 代表超過 30 年 */
export interface FullEstimateRow {
  stage: number;
  done: boolean;
  date: Date | null;
  weeks: number;
}

/** 每週取得量(1/60 單位) */
export interface WeeklyGain {
  soul: number;
  genesis: number;
  destiny: number;
  astraTrace: number;
  astraShard: number;
  /** 月王只在每月重置的那一週加入 */
  monthly: Omit<WeeklyGain, 'monthly'>;
}

/** estimate 的輸入 */
export interface EstimateInput {
  state: CharacterWeaponState;
  trackedBosses: CharacterBossTrackList[];
  tasks: CharacterTask[];
  profile: Pick<WeaponProfile, 'genesisPass' | 'stormTraining'>;
  settings: Settings;
  now: Date;
}

/** 四把武器的預估與完整預估 */
export interface EstimateResult {
  gain: WeeklyGain;
  /** 清單中給最多靈魂碎片的 BOSS(完整預估的說明用) */
  soulSource: { bossCatalogId: string; difficulty: BossDifficulty } | null;
  soul: WeaponEstimate;
  soulFull: FullEstimateRow[];
  genesis: WeaponEstimate;
  destiny: WeaponEstimate;
  destinyFull: FullEstimateRow[];
  astra: WeaponEstimate;
}

type Gain = Omit<WeeklyGain, 'monthly'>;
const ZERO: Gain = { soul: 0, genesis: 0, destiny: 0, astraTrace: 0, astraShard: 0 };

/** 加總兩份取得量;靈魂取最高 */
function addGain(a: Gain, b: ClearAmounts | Gain): Gain {
  return {
    soul: Math.max(a.soul, b.soul),
    genesis: a.genesis + b.genesis,
    destiny: a.destiny + b.destiny,
    astraTrace: a.astraTrace + b.astraTrace,
    astraShard: a.astraShard + b.astraShard,
  };
}

/** 清單中可做的最高格蘭蒂斯地區取得量(遊戲內整數),沒追蹤時為 0 */
export function topGrandisShards(tasks: CharacterTask[]): number {
  return Math.max(0, ...tasks.filter((t) => t.presetId === GRANDIS_DAILY_PRESET_ID).map((t) => GRANDIS_DAILY_SHARDS[t.name] ?? 0));
}

/**
 * 依清單中追蹤的項目(目前設定的難度、人數、VIP 與角色目前的加成)計算每週取得量
 * @param input 追蹤中的 BOSS、任務與加成設定
 * @param onlyUnchecked 只算還沒勾選的項目(本週還能取得的量)
 */
function gainOf(input: Pick<EstimateInput, 'trackedBosses' | 'profile'>, onlyUnchecked: boolean): { weekly: Gain; monthly: Gain } {
  let weekly = ZERO;
  let monthly = ZERO;
  for (const b of input.trackedBosses) {
    if (!b.bossCatalogId || b.resetCycle === 'daily' || !hasWeaponRate(b.bossCatalogId, b.difficulty)) continue;
    if (onlyUnchecked && b.checked) continue;
    const a = clearAmounts({ ...b, bossCatalogId: b.bossCatalogId, ...input.profile });
    if (b.resetCycle === 'monthly') monthly = addGain(monthly, a);
    else weekly = addGain(weekly, a);
  }
  return { weekly, monthly };
}

/** 單週的取得量:本週只加還能取得的量,之後每週加每週取得量,月重置那一週再加月王 */
type WeekGainFn = (week: number) => Gain;

/**
 * 建立「第 k 週取得量」的函式
 * @param input estimate 的輸入
 */
function weekGainFn(input: EstimateInput): { fn: WeekGainFn; gain: WeeklyGain } {
  const { weekly, monthly } = gainOf(input, false);
  const remaining = gainOf(input, true);
  const daily = topGrandisShards(input.tasks) * UNIT;
  const week0 = gameWeekBounds(input.settings, input.now);
  // 本週剩下幾天的每日任務(今天還沒做也算)
  const today = dayBounds(input.settings, input.now);
  const todayDone = input.tasks.some(
    (t) => t.presetId === GRANDIS_DAILY_PRESET_ID && t.checked && new Date(t.lastResetAt) >= today.start,
  );
  const daysLeft = Math.min(7, Math.max(0, Math.round(daysBetween(today.start, week0.end)))) - (todayDone ? 1 : 0);
  // 本週靈魂:只取最高一隻,已打的部分已經計入,本週最多只會再增加「清單最高 − 本週已打的最高」
  // 看追蹤中已勾選的項目(含設定前就打的);取消勾選或刪除追蹤項目時紀錄也會失效,本週紀錄不會比這裡多
  const soulThisWeek = Math.max(
    0,
    ...input.trackedBosses
      .filter((b) => b.checked && b.bossCatalogId && b.resetCycle !== 'daily')
      .map((b) => clearAmounts({ ...b, bossCatalogId: b.bossCatalogId!, ...input.profile }).soul),
  );

  const monthStarts = (k: number): boolean => {
    const start = addDays(week0.start, 7 * k);
    const end = addDays(start, 7);
    const m = cycleBounds('monthly', input.settings, end).start;
    return m >= start && m < end;
  };

  const fn: WeekGainFn = (k) => {
    if (k === 0) {
      const g = addGain(remaining.weekly, remaining.monthly);
      return { ...g, soul: Math.max(0, weekly.soul - soulThisWeek), astraShard: g.astraShard + daily * Math.max(0, daysLeft) };
    }
    const g = { ...weekly, astraShard: weekly.astraShard + daily * 7 };
    return monthStarts(k) ? addGain(g, monthly) : g;
  };
  return { fn, gain: { ...weekly, astraShard: weekly.astraShard + daily * 7, monthly } };
}

/** 第 k 週節點的日期:本週為今天,之後為該週的重置日 */
function nodeDate(input: EstimateInput, k: number): Date {
  return k === 0 ? input.now : addDays(gameWeekBounds(input.settings, input.now).start, 7 * k);
}

/** 創世:到解放為止的各階節點 */
function estimateGenesis(input: EstimateInput, fn: WeekGainFn, hasGain: boolean): WeaponEstimate {
  const g = input.state.genesis;
  if (g.status !== 'active' || !hasGain) return { none: true, nodes: [] };
  let { stage, pool } = g;
  const nodes: EstimateNode[] = [];
  for (let k = 0; k <= MAX_SIM_WEEKS; k++) {
    pool = addCapped(pool, fn(k).genesis, GENESIS.cap * UNIT).pool;
    while (pool >= GENESIS.needs[stage - 1] * UNIT) {
      pool -= GENESIS.needs[stage - 1] * UNIT;
      nodes.push({ label: stage >= 8 ? '解放' : `${stage + 1} 階`, date: nodeDate(input, k), weeks: k });
      if (stage >= 8) return { none: false, nodes };
      stage++;
    }
  }
  return { none: true, nodes: [] };
}

/**
 * 命運:第一階段的時間軸只推到第一階段完成,第二階段推到二次解放;完整預估一律推到 6 階
 * 第一階段完成後直接接第二階段(決心從 0 開始、上限 15,000)
 */
function simulateDestiny(input: EstimateInput, fn: WeekGainFn): { nodes: EstimateNode[]; full: FullEstimateRow[] } | null {
  const d = input.state.destiny;
  let stage = d.status === 'phase1done' ? 4 : d.stage;
  let pool = d.status === 'phase1done' ? 0 : d.pool;
  const nodes: EstimateNode[] = [];
  const full: FullEstimateRow[] = Array.from({ length: 6 }, (_, i) => ({ stage: i + 1, done: i + 1 < stage, date: null, weeks: 0 }));
  for (let k = 0; k <= MAX_SIM_WEEKS; k++) {
    pool = addCapped(pool, fn(k).destiny, destinyCap(stage) * UNIT).pool;
    while (pool >= DESTINY.needs[stage - 1] * UNIT) {
      pool -= DESTINY.needs[stage - 1] * UNIT;
      const lastOfPhase = stage === 3 || stage === 6;
      nodes.push({ label: lastOfPhase ? '完成' : `${stage + 1} 階`, date: nodeDate(input, k), weeks: k });
      full[stage - 1] = { stage, done: false, date: nodeDate(input, k), weeks: k };
      if (stage === 6) return { nodes, full };
      if (stage === 3) pool = 0;
      stage++;
    }
  }
  return { nodes: [], full };
}

/** 阿斯特拉:兩種素材都達標才升階,以較慢的素材為準 */
function estimateAstra(input: EstimateInput, fn: WeekGainFn, hasGain: boolean): WeaponEstimate {
  const a = input.state.astra;
  if (a.status !== 'active' || !hasGain) return { none: true, nodes: [] };
  let { stage, trace, shard } = a;
  const nodes: EstimateNode[] = [];
  for (let k = 0; k <= MAX_SIM_WEEKS; k++) {
    const g = fn(k);
    trace = addCapped(trace, g.astraTrace, ASTRA.traceCap * UNIT).pool;
    shard += g.astraShard;
    while (trace >= ASTRA.traceNeeds[stage - 1] * UNIT && shard >= ASTRA.shardNeeds[stage - 1] * UNIT) {
      trace -= ASTRA.traceNeeds[stage - 1] * UNIT;
      shard -= ASTRA.shardNeeds[stage - 1] * UNIT;
      nodes.push({ label: stage >= 3 ? '完成' : `${stage + 1} 階`, date: nodeDate(input, k), weeks: k });
      if (stage >= 3) return { none: false, nodes };
      stage++;
    }
  }
  return { none: true, nodes: [] };
}

/**
 * 靈魂:逐週加碎片並自動升級(假設升階任務都能在到達等級的那一週完成);
 * 時間軸只到本階段結束(下一次升階的等級),停在升階等級時改看下一階;完整預估列出 1~10 階的完成日
 */
function simulateSoul(input: EstimateInput, fn: WeekGainFn): { nodes: EstimateNode[]; full: FullEstimateRow[] } | null {
  const s = input.state.soul;
  if (s.status !== 'active') return null;
  let { level, pool } = s;
  const targetLevel = Math.min(100, soulStageOf(level, s.gatePassed || soulAtGate(s)) * 10);
  const stageDone = (st: number) => s.level >= 100 || s.level > st * 10 || (s.level === st * 10 && s.gatePassed);
  const full: FullEstimateRow[] = Array.from({ length: 10 }, (_, i) => ({ stage: i + 1, done: stageDone(i + 1), date: null, weeks: 0 }));
  const mark = (st: number, k: number) => {
    const row = full[st - 1];
    if (!row.done && !row.date) full[st - 1] = { ...row, date: nodeDate(input, k), weeks: k };
  };
  const nodes: EstimateNode[] = [];
  for (let k = 0; k <= MAX_SIM_WEEKS && level < 100; k++) {
    pool = Math.min(SOUL_CAP_UNITS, pool + fn(k).soul);
    // 停在升階等級:任務不卡關,該階在這一週完成
    if (level % 10 === 0) mark(level / 10, k);
    while (level < 100 && pool >= soulNextCost(level) * UNIT) {
      pool -= soulNextCost(level) * UNIT;
      level++;
      if (level <= targetLevel) nodes.push({ label: `Lv.${level}`, date: nodeDate(input, k), weeks: k });
      if (level % 10 === 0) mark(level / 10, k);
    }
  }
  return level >= targetLevel ? { nodes, full } : { nodes: [], full };
}

/**
 * 推算四把武器的預估時間:每週取得量依清單中追蹤的項目,本週只加還能取得的量,之後逐週模擬並套用上限
 * @param input fold 後的狀態、追蹤中的 BOSS 與任務、加成設定與時間
 */
export function estimateWeapons(input: EstimateInput): EstimateResult {
  const { fn, gain } = weekGainFn(input);
  const m = gain.monthly;
  const soulSim = gain.soul > 0 ? simulateSoul(input, fn) : null;
  const d = input.state.destiny;
  const destinyOn = d.status === 'active' || d.status === 'phase1done';
  const destinySim = destinyOn && gain.destiny + m.destiny > 0 ? simulateDestiny(input, fn) : null;
  // 命運時間軸:第一階段只到第一階段完成,第二階段到二次解放
  const destinyNodes = destinySim
    ? d.status === 'active' && d.stage <= 3
      ? destinySim.nodes.slice(0, destinySim.nodes.findIndex((n) => n.label === '完成') + 1)
      : destinySim.nodes
    : [];
  let soulSource: EstimateResult['soulSource'] = null;
  let soulBest = 0;
  for (const b of input.trackedBosses) {
    if (!b.bossCatalogId || b.resetCycle === 'daily') continue;
    const amt = clearAmounts({ ...b, bossCatalogId: b.bossCatalogId, ...input.profile }).soul;
    if (amt > soulBest) {
      soulBest = amt;
      soulSource = { bossCatalogId: b.bossCatalogId, difficulty: b.difficulty };
    }
  }
  return {
    gain,
    soulSource,
    soul: soulSim ? { none: soulSim.nodes.length === 0, nodes: soulSim.nodes } : { none: true, nodes: [] },
    soulFull: soulSim?.full ?? [],
    genesis: estimateGenesis(input, fn, gain.genesis + m.genesis > 0),
    destiny: destinyNodes.length ? { none: false, nodes: destinyNodes } : { none: true, nodes: [] },
    destinyFull: destinySim?.full ?? [],
    astra: estimateAstra(input, fn, gain.astraTrace + m.astraTrace > 0 && gain.astraShard + m.astraShard > 0),
  };
}

/** 日期文字:2026/10/22 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** 短日期文字:10/22 */
export function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 還要多久的文字:本週、8 週內「約 N 週」,超過「約 N 個月」,超過 12 個月「約 N 年」
 * @param weeks 從本週起算第幾週
 * @param date 預計日期
 * @param now 目前時間
 */
export function formatEta(weeks: number, date: Date, now: Date): string {
  if (weeks <= 0) return '本週';
  if (weeks <= 8) return `約 ${weeks} 週`;
  const days = daysBetween(now, date);
  // 超過 12 個月改用年,避免同一份清單裡出現「約 18 個月」和「約 2.4 年」
  if (days > 365) return `約 ${Number((days / 365.25).toFixed(1))} 年`;
  return `約 ${Math.max(2, Math.round(days / 30.44))} 個月`;
}
