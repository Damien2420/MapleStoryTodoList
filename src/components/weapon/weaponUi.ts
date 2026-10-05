import { ASTRA, DESTINY, GENESIS, SOUL_QUESTS } from '@/data/weaponRates.data';
import type { WeaponProgress, WeaponViewStatus } from '@/hooks/useWeaponProgress';
import { findBossCatalogEntry } from '@/lib/bossCatalog';
import { formatDate, formatEta, formatShortDate } from '@/lib/weapon/estimate';
import { toDisplay } from '@/lib/weapon/rates';
import {
  astraPercent,
  astraReady,
  destinyNeed,
  destinyPercent,
  destinyPhaseNeeds,
  destinyPhaseOf,
  destinyReady,
  genesisNeed,
  genesisPercent,
  genesisReady,
  soulAtGate,
  soulNextCost,
  soulPercent,
  soulStageOf,
} from '@/lib/weapon/rules';
import { soloKey, type CharacterWeaponState, type WeaponKind } from '@/lib/weapon/types';

/** 各武器的名稱與素材 */
export const WEAPON_META: Record<WeaponKind, { name: string; tab: string; unit: string; material: string; adjust: string }> = {
  soul: { name: '靈魂武器', tab: '靈魂', unit: '碎片', material: '靈魂碎片', adjust: '調整等級與靈魂' },
  genesis: { name: '創世武器', tab: '創世', unit: '痕跡', material: '黑暗痕跡', adjust: '調整階段與痕跡' },
  destiny: { name: '命運武器', tab: '命運', unit: '決心', material: '敵對者的決心', adjust: '調整階段與決心' },
  astra: { name: '阿斯特拉輔助武器', tab: '阿斯特拉', unit: '痕跡', material: '激戰的痕跡', adjust: '調整階段與素材' },
};

/** 千分位數字 */
export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/** 1/60 單位 → 千分位整數文字(無條件捨去) */
export function fmtUnits(units: number): string {
  return fmt(toDisplay(units));
}

/** BOSS 目錄名稱;查不到時顯示 id */
export function bossName(bossCatalogId: string): string {
  return findBossCatalogEntry(bossCatalogId)?.name ?? bossCatalogId;
}

/**
 * 武器的整體進度百分比(0~100 的整數);還沒完成時最多 99,避免顯示 100% 卻還沒完成
 * @param kind 武器
 * @param state 四把武器的狀態
 */
export function weaponPercent(kind: WeaponKind, state: CharacterWeaponState): number {
  const raw =
    kind === 'soul'
      ? soulPercent(state.soul)
      : kind === 'genesis'
        ? genesisPercent(state.genesis)
        : kind === 'destiny'
          ? destinyPercent(state.destiny)
          : astraPercent(state.astra);
  if (state[kind].status === 'done') return 100;
  return Math.min(99, Math.round(raw));
}

/** 分段進度條的一段 */
export interface StageSegment {
  /** 寬度比例(依需求量) */
  weight: number;
  /** 填色比例 0~1 */
  fill: number;
}

/** 單項持有量卡片 */
export interface HoldingStat {
  label: string;
  value: string;
  sub: string;
  /** 數值的顏色語意:enough 已達本階需求(綠)、cap 已達持有上限(黃);沒有時用一般文字色 */
  tone?: 'enough' | 'cap';
  /** 有值時改用進度條版面(阿斯特拉):右上角顯示 status、數值旁的 sub 為「/ 需求」,下方進度條填到 fill(0~1) */
  fill?: number;
  status?: string;
}

/** 持有量與需求的對應顏色語意:達到上限優先於已足夠 */
function holdTone(held: number, need: number, cap?: number): HoldingStat['tone'] {
  if (cap !== undefined && held >= cap) return 'cap';
  return held >= need ? 'enough' : undefined;
}

/** 進行中武器的標題區資料 */
export interface WeaponHeadModel {
  stage: string;
  stageSub: string;
  /** 本階素材已足夠、只差升階任務 */
  waiting: boolean;
  segments: StageSegment[];
  current: number;
  percent: number;
  /** 讀屏用的百分比說明 */
  percentLabel: string;
  stats: HoldingStat[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * 進行中武器的標題區資料:階段、分段進度條、百分比與持有量卡片
 * @param kind 武器
 * @param p useWeaponProgress 的結果
 */
export function headModel(kind: WeaponKind, p: WeaponProgress): WeaponHeadModel {
  const { state } = p;
  const tw = p.thisWeek.weapons[kind];
  const percent = weaponPercent(kind, state);
  const weekSub = (cap: string, capped: boolean) => (capped ? `已達上限 ${cap}` : tw.total > 0 ? `含本週 +${fmtUnits(tw.total)}` : `上限 ${cap}`);

  if (kind === 'genesis') {
    const g = state.genesis;
    const need = genesisNeed(g.stage);
    const held = toDisplay(g.pool);
    return {
      stage: `第 ${g.stage} 階`,
      stageSub: '/ 8',
      waiting: genesisReady(g),
      segments: GENESIS.needs.map((n, i) => ({ weight: n, fill: i < g.stage - 1 ? 1 : i === g.stage - 1 ? clamp01(held / n) : 0 })),
      current: g.stage - 1,
      percent,
      percentLabel: '整體進度',
      stats: [
        { label: '持有黑暗痕跡', value: fmt(held), sub: weekSub(fmt(GENESIS.cap), held >= GENESIS.cap), tone: holdTone(held, need, GENESIS.cap) },
        { label: '本階需求', value: fmt(need), sub: held >= need ? '已足夠' : `還差 ${fmt(need - held)}`, tone: holdTone(held, need) },
      ],
    };
  }

  if (kind === 'soul') {
    const s = state.soul;
    const cost = soulNextCost(s.level);
    const held = toDisplay(s.pool);
    const progress = s.level + clamp01(cost ? held / cost : 0);
    return {
      stage: `Lv.${s.level}`,
      stageSub: `${soulStageOf(s.level, s.gatePassed)} 階`,
      waiting: soulAtGate(s),
      segments: Array.from({ length: 10 }, (_, i) => ({ weight: 1, fill: clamp01((progress - i * 10) / 10) })),
      current: soulStageOf(s.level, s.gatePassed) - 1,
      percent,
      percentLabel: '整體進度',
      stats: [
        { label: '持有靈魂碎片', value: fmt(held), sub: tw.total > 0 ? `含本週 +${fmtUnits(tw.total)}` : '本週還沒取得', tone: cost ? holdTone(held, cost) : undefined },
        soulAtGate(s)
          ? {
              // 停在升階關卡時,下一級需要多少碎片不是重點,改成告訴使用者下一步:任務沒完成先完成,完成了就升階
              label: '下一步',
              value: (SOUL_QUESTS[soulStageOf(s.level, s.gatePassed)] ?? []).some((o) => s.soloCleared.includes(soloKey(o.bossCatalogId, o.difficulty)))
                ? '請先進行升階'
                : '請先完成 BOSS 任務進行升階',
              sub: '',
            }
          : {
              label: `升到 Lv.${Math.min(100, s.level + 1)} 需要`,
              value: fmt(cost),
              sub: held >= cost ? '已足夠' : `還差 ${fmt(cost - held)}`,
              tone: holdTone(held, cost),
            },
      ],
    };
  }

  if (kind === 'destiny') {
    const d = state.destiny;
    const phase = destinyPhaseOf(d.stage);
    const needs = destinyPhaseNeeds(d.stage);
    const idx = (d.stage - 1) % 3;
    const need = destinyNeed(d.stage);
    const held = toDisplay(d.pool);
    const cap = DESTINY.phaseCaps[phase - 1];
    return {
      stage: `第 ${d.stage} 階`,
      stageSub: phase === 1 ? '/ 3 · 第一階段' : '/ 6 · 第二階段',
      waiting: destinyReady(d),
      segments: needs.map((n, i) => ({ weight: n, fill: i < idx ? 1 : i === idx ? clamp01(held / n) : 0 })),
      current: idx,
      percent,
      percentLabel: '本階段進度',
      stats: [
        { label: '持有敵對者的決心', value: fmt(held), sub: weekSub(fmt(cap), held >= cap), tone: holdTone(held, need, cap) },
        { label: '本階需求', value: fmt(need), sub: held >= need ? '已足夠' : `還差 ${fmt(need - held)}`, tone: holdTone(held, need) },
      ],
    };
  }

  const a = state.astra;
  const traceNeed = ASTRA.traceNeeds[a.stage - 1];
  const shardNeed = ASTRA.shardNeeds[a.stage - 1];
  const trace = toDisplay(a.trace);
  const shard = toDisplay(a.shard);
  const stageFill = (clamp01(trace / traceNeed) + clamp01(shard / shardNeed)) / 2;
  // 阿斯特拉兩種素材各一格:標籤只放名稱,需求寫在數值旁,狀態放右上角,下方進度條顯示離需求多遠
  const material = (label: string, held: number, need: number, cap?: number): HoldingStat => {
    const tone = holdTone(held, need, cap);
    return {
      label,
      value: fmt(held),
      sub: `/ ${fmt(need)}`,
      tone,
      fill: clamp01(held / need),
      status: tone === 'cap' ? '已達上限' : tone === 'enough' ? '已足夠' : `還差 ${fmt(need - held)}`,
    };
  };
  return {
    stage: `第 ${a.stage} 階`,
    stageSub: '/ 3',
    waiting: astraReady(a),
    segments: ASTRA.traceNeeds.map((n, i) => ({ weight: n, fill: i < a.stage - 1 ? 1 : i === a.stage - 1 ? stageFill : 0 })),
    current: a.stage - 1,
    percent,
    percentLabel: '整體進度',
    stats: [
      material('激戰的痕跡', trace, traceNeed, ASTRA.traceCap),
      material('艾里溫碎片', shard, shardNeed),
    ],
  };
}

/** 時間軸上的一個節點(含畫面位置) */
export interface TimelineTick {
  /** 0~100 的位置 */
  position: number;
  label: string;
  /** 標題列顯示的名稱:最後一個節點顯示原本的標題,其他為「升到 N 階」 */
  head: string;
  value: string;
}

/** 時間軸資料;none 為無法推算 */
export interface TimelineModel {
  label: string;
  none: boolean;
  /** 目前已走到軌道的哪裡(0~100);沒有時軌道只在預覽或固定節點時才填色 */
  progress?: number;
  value: string;
  /** 軌道左下角的文字,沒有時為「今天」 */
  startLabel?: string;
  endLabel: string;
  ticks: TimelineTick[];
  tip: string;
}

/**
 * 節點等距排列:第 i 個節點在 (i + 1) / n 的位置,最後一個固定在 100%;不依日期比例,避免日期接近的節點擠在一起、遠的節點間隔過大
 * @param count 節點數
 */
function tickPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) / count) * 100);
}

/**
 * 時間軸資料:標題、預設顯示的完成日期與各節點
 * @param kind 武器
 * @param p useWeaponProgress 的結果
 */
export function timelineModel(kind: WeaponKind, p: WeaponProgress): TimelineModel {
  const est = p.estimate[kind];
  const d = p.state.destiny;
  const label =
    kind === 'soul' ? '本階段完成' : kind === 'genesis' ? '預計解放' : kind === 'destiny' ? (destinyPhaseOf(d.stage) === 1 ? '第一階段完成' : '預計二次解放') : '預計完成';
  const g = p.estimate.gain;
  const m = g.monthly;
  const per = (units: number) => `+${fmtUnits(units)}`;
  const tip =
    kind === 'soul'
      ? `依清單中追蹤的週王推算，每週取給最多的一隻（目前 ${per(g.soul)}）；不含 BOSS 任務卡關的時間。`
      : kind === 'genesis'
        ? `依清單中追蹤的 BOSS 推算：每週約 ${per(g.genesis)}${m.genesis ? `、每月 ${per(m.genesis)}` : ''}${p.profile.genesisPass ? '（目前套用創世通行證 ×3）' : ''}；不含 BOSS 任務卡關的時間。`
        : kind === 'destiny'
          ? `依清單中追蹤的 BOSS 推算：每週約 ${per(g.destiny)}；不含決戰任務卡關的時間。`
          : `依清單推算：激戰的痕跡每週約 ${per(g.astraTrace)}，艾里溫碎片每週約 ${per(g.astraShard)}${p.thisWeek.daily.untracked ? '（清單沒有格蘭蒂斯每日任務，只算 BOSS）' : '（每日任務＋BOSS）'}，以較慢的素材為準。`;
  if (kind === 'soul') {
    const s = p.state.soul;
    // 停在升階關卡(例如 Lv.50 還沒升階):本階段的終點已經達成,整條填滿,終點顯示「待升階」,不往下一階推算
    if (soulAtGate(s)) {
      return {
        label,
        none: false,
        progress: 100,
        value: '待升階',
        startLabel: `今天 · Lv.${s.level}`,
        endLabel: `Lv.${s.level} 已達成`,
        tip: '已經達到本階段的終點，完成升階任務並升階後，會繼續往下一階推算。',
        ticks: [{ position: 100, label: `Lv.${s.level}`, head: label, value: '待升階' }],
      };
    }
    if (est.none || est.nodes.length === 0) return { label, none: true, value: '無法推算', endLabel: '', ticks: [], tip };
    // 從今天開始,每一級一個節點(同一週升好幾級時,這些節點的日期相同)
    const positions = tickPositions(est.nodes.length);
    const end = est.nodes[est.nodes.length - 1];
    const endHead = end.label === 'Lv.100' ? '滿等 Lv.100' : `升到 ${end.label} 可升階`;
    return {
      label,
      none: false,
      value: `${formatDate(end.date)} · ${formatEta(end.weeks, end.date, p.now)}`,
      startLabel: `今天 · Lv.${s.level}`,
      endLabel: `${end.label === 'Lv.100' ? '滿等' : `${end.label} 升階`} ${formatShortDate(end.date)}`,
      tip,
      ticks: est.nodes.map((n, i) => ({
        position: positions[i],
        label: n.label,
        head: i === est.nodes.length - 1 ? endHead : `升到 ${n.label}`,
        value: `${formatDate(n.date)} · ${formatEta(n.weeks, n.date, p.now)}`,
      })),
    };
  }
  if (est.none || est.nodes.length === 0) return { label, none: true, value: '無法推算', endLabel: '', ticks: [], tip };
  const last = est.nodes[est.nodes.length - 1];
  const positions = tickPositions(est.nodes.length);
  return {
    label,
    none: false,
    value: `${formatDate(last.date)} · ${formatEta(last.weeks, last.date, p.now)}`,
    endLabel: formatShortDate(last.date),
    tip,
    ticks: est.nodes.map((n, i) => ({
      position: positions[i],
      label: n.label,
      head: i === est.nodes.length - 1 ? label : `升到 ${n.label}`,
      value: `${formatDate(n.date)} · ${formatEta(n.weeks, n.date, p.now)}`,
    })),
  };
}

/** 入口與 Tab 用:武器狀態是否顯示進度條 */
export function hasProgress(status: WeaponViewStatus): boolean {
  return status === 'active' || status === 'done' || status === 'phase1done';
}
