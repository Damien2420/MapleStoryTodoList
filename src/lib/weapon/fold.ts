import { ASTRA, DESTINY } from '@/data/weaponRates.data';
import type { Settings } from '@/types';
import { gameWeekBounds, localDateKey } from './cycle';
import { clearAmounts, toDisplay, type ClearAmounts } from './rates';
import {
  addCapped,
  ASTRA_TRACE_CAP_UNITS,
  destinyCap,
  destinyNeed,
  GENESIS_CAP_UNITS,
  genesisNeed,
  SOUL_CAP_UNITS,
  soulAtGate,
  soulAutoLevel,
  soulLevelUp,
  soulStageOf,
} from './rules';
import {
  emptyWeaponState,
  UNIT,
  type AdjustPayload,
  type BossClear,
  type CharacterWeaponState,
  type DailyClear,
  type SoulState,
  type UpgradePayload,
  type WeaponCheckpoint,
  type WeaponEvent,
  type WeaponKind,
} from './types';

/** fold 的輸入:同一個角色的存檔點、紀錄與事件 */
export interface FoldInput {
  checkpoint?: WeaponCheckpoint;
  bossClears: BossClear[];
  dailyClears: DailyClear[];
  events: WeaponEvent[];
  settings: Settings;
}

/** 單筆擊破被持有上限截掉的量(1/60 單位) */
export interface ClearCapLoss {
  genesis: number;
  destiny: number;
  astraTrace: number;
}

/** fold 的結果 */
export interface FoldResult {
  state: CharacterWeaponState;
  /** 被持有上限截掉的量,key 為 BossClear id */
  capLoss: Map<string, ClearCapLoss>;
  /** 各武器最後一次初始設定 / 校正的時間;在這之前的紀錄已包含在使用者填的值裡(adjustIncluded 列出的除外) */
  adjustAt: Partial<Record<WeaponKind, string>>;
  /** 各武器最後一次校正時勾選加入的擊破紀錄 id:這些在校正之前,但填的值不包含,校正後再加上 */
  adjustIncluded: Partial<Record<WeaponKind, string[]>>;
}

type Item =
  | { kind: 'clear'; at: string; id: string; clear: BossClear }
  | { kind: 'daily'; at: string; id: string; daily: DailyClear }
  | { kind: 'event'; at: string; id: string; event: WeaponEvent };

/**
 * 依時間排序紀錄與事件(相同時間以 id 排序),只取存檔點之後的部分
 * @param input fold 的輸入
 */
function collectItems(input: FoldInput): Item[] {
  const watermark = input.checkpoint?.watermark ?? '';
  const items: Item[] = [
    ...input.bossClears
      .filter((c) => c.active)
      .map((c): Item => ({ kind: 'clear', at: c.firstClearedAt, id: c.id, clear: c })),
    ...input.dailyClears.map((d): Item => ({ kind: 'daily', at: d.firstClearedAt, id: d.id, daily: d })),
    ...input.events.map((e): Item => ({ kind: 'event', at: e.at, id: e.id, event: e })),
  ];
  return items
    .filter((it) => it.at >= watermark)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 靈魂的校正內容 */
type SoulAdjustPayload = Extract<AdjustPayload, { weapon: 'soul' }>;

/**
 * 靈魂校正後的狀態:填的值加上校正時選擇加入的本週週王碎片,自動升級開啟時再依碎片升級。
 * 調整視窗的預覽也用這個函式,和儲存後的結果一致
 * @param prev 校正前的靈魂狀態(填的值沒帶自動升級設定時沿用)
 * @param p 靈魂的校正內容
 * @param included 加入的本週週王碎片(1/60 單位)
 * @returns 校正後的靈魂狀態
 */
export function soulAfterAdjust(prev: SoulState, p: SoulAdjustPayload, included = 0): SoulState {
  const level = clampInt(p.level, 1, 100);
  const pool = Math.min(nonNegative(p.pool) * UNIT, SOUL_CAP_UNITS);
  return soulAutoLevel({
    status: 'active',
    level,
    gatePassed: level % 10 === 0 && level < 100 && p.gatePassed,
    pool: addCapped(pool, included, SOUL_CAP_UNITS).pool,
    soloCleared: [...new Set(p.soloCleared)],
    autoLevel: p.autoLevel ?? prev.autoLevel,
  });
}

/** 套用初始設定 / 校正(靈魂由 soulAfterAdjust 處理):狀態直接設成使用者填的值(持有量套用上限) */
function applyAdjust(state: CharacterWeaponState, p: Exclude<AdjustPayload, SoulAdjustPayload>): void {
  if (p.weapon === 'genesis') {
    state.genesis = { status: 'active', stage: clampInt(p.stage, 1, 8), pool: Math.min(nonNegative(p.pool) * UNIT, GENESIS_CAP_UNITS) };
  } else if (p.weapon === 'destiny') {
    const stage = clampInt(p.stage, 1, 6);
    state.destiny = { status: 'active', stage, pool: Math.min(nonNegative(p.pool) * UNIT, destinyCap(stage) * UNIT) };
  } else {
    state.astra = {
      status: 'active',
      stage: clampInt(p.stage, 1, 3),
      trace: Math.min(nonNegative(p.trace) * UNIT, ASTRA_TRACE_CAP_UNITS),
      shard: nonNegative(p.shard) * UNIT,
    };
  }
}

/**
 * 調整視窗填的值是否與目前狀態相同(持有量以畫面顯示的整數比較)。
 * 相同時不必產生調整事件,否則本週期已勾選的 BOSS 會被視為已包含在填的值裡
 * @param state 目前的武器狀態
 * @param p 調整視窗填的值
 * @returns 武器進行中且每個欄位都沒改時為 true;未設定或已完成一律為 false
 */
export function adjustUnchanged(state: CharacterWeaponState, p: AdjustPayload): boolean {
  if (p.weapon === 'genesis') {
    const g = state.genesis;
    return g.status === 'active' && g.stage === p.stage && toDisplay(g.pool) === p.pool;
  }
  if (p.weapon === 'destiny') {
    const d = state.destiny;
    return d.status === 'active' && d.stage === p.stage && toDisplay(d.pool) === p.pool;
  }
  if (p.weapon === 'astra') {
    const a = state.astra;
    return a.status === 'active' && a.stage === p.stage && toDisplay(a.trace) === p.trace && toDisplay(a.shard) === p.shard;
  }
  const s = state.soul;
  const solo = new Set(p.soloCleared);
  return (
    s.status === 'active' &&
    s.level === p.level &&
    s.gatePassed === p.gatePassed &&
    toDisplay(s.pool) === p.pool &&
    solo.size === s.soloCleared.length &&
    s.soloCleared.every((k) => solo.has(k))
  );
}

/** 整數並夾在範圍內 */
/** 校正量不接受負數與 NaN(UI 打不出來,資料被手動改過或損毀時才會遇到) */
function nonNegative(v: number): number {
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v) || min));
}

/** 套用升階:只有目前階段與事件記錄的階段相同時才生效;扣除本階需求,溢出保留,小於 0 時為 0 */
function applyUpgrade(state: CharacterWeaponState, weapon: WeaponKind, p: UpgradePayload): void {
  if (weapon === 'genesis') {
    const g = state.genesis;
    if (g.status !== 'active' || g.stage !== p.fromStage) return;
    const pool = Math.max(0, g.pool - genesisNeed(g.stage) * UNIT);
    state.genesis = g.stage >= 8 ? { status: 'done', stage: 8, pool } : { status: 'active', stage: g.stage + 1, pool };
  } else if (weapon === 'destiny') {
    const d = state.destiny;
    if (d.status !== 'active' || d.stage !== p.fromStage) return;
    const pool = Math.max(0, d.pool - destinyNeed(d.stage) * UNIT);
    if (d.stage === 3) state.destiny = { status: 'phase1done', stage: 3, pool: 0 };
    else if (d.stage >= DESTINY.needs.length) state.destiny = { status: 'done', stage: 6, pool };
    else state.destiny = { status: 'active', stage: d.stage + 1, pool };
  } else if (weapon === 'astra') {
    const a = state.astra;
    if (a.status !== 'active' || a.stage !== p.fromStage) return;
    const trace = Math.max(0, a.trace - ASTRA.traceNeeds[a.stage - 1] * UNIT);
    const shard = Math.max(0, a.shard - ASTRA.shardNeeds[a.stage - 1] * UNIT);
    state.astra = a.stage >= 3 ? { status: 'done', stage: 3, trace, shard } : { status: 'active', stage: a.stage + 1, trace, shard };
  } else {
    const s = state.soul;
    if (s.status !== 'active' || !soulAtGate(s) || soulStageOf(s.level, false) !== p.fromStage) return;
    const soloCleared = p.soulQuestKey && !s.soloCleared.includes(p.soulQuestKey) ? [...s.soloCleared, p.soulQuestKey] : s.soloCleared;
    state.soul = soulAutoLevel({ ...s, gatePassed: true, soloCleared });
  }
}

/**
 * 存檔點 + 紀錄 + 事件 → 四把武器的狀態。純函式:不讀 store、不讀目前時間
 * @param input 同一個角色的存檔點、紀錄、事件與重置設定
 * @returns 狀態、每筆擊破被上限截掉的量、各武器最後一次校正的時間
 */
export function foldWeapons(input: FoldInput): FoldResult {
  const state: CharacterWeaponState = structuredClone(input.checkpoint?.state ?? emptyWeaponState());
  const capLoss = new Map<string, ClearCapLoss>();
  const adjustAt: Partial<Record<WeaponKind, string>> = {};
  const adjustIncluded: Partial<Record<WeaponKind, string[]>> = {};
  // 校正時勾選加入的擊破要用 id 找回來;取消勾選(active = false)的不算
  const activeClears = new Map(input.bossClears.filter((c) => c.active).map((c) => [c.id, c]));
  // 靈魂:每個遊戲週已計入的最高量;校正前的擊破也會更新,避免校正後打較低的王又被重複計入
  const soulWeekMax = new Map<string, number>();

  for (const it of collectItems(input)) {
    if (it.kind === 'event') {
      const e = it.event;
      if (e.kind === 'adjust' && e.payload && 'weapon' in e.payload) {
        adjustAt[e.weapon] = e.at;
        const included = e.payload.includeClearIds ?? [];
        adjustIncluded[e.weapon] = included;
        // 校正前已勾選、使用者選擇填的值還沒包含的擊破:再加一次;取消後重新勾選的(時間在校正之後)會照一般紀錄累積,這裡跳過
        const includedClears = included.map((id) => activeClears.get(id)).filter((c): c is BossClear => !!c && c.firstClearedAt < e.at);
        if (e.payload.weapon === 'soul') {
          // 靈魂一週只算一隻:取加入的最高量;本週最高量在校正前已記下,之後打的只補超過它的部分
          state.soul = soulAfterAdjust(state.soul, e.payload, Math.max(0, ...includedClears.map((c) => clearAmounts(c).soul)));
        } else {
          applyAdjust(state, e.payload);
          for (const c of includedClears) {
            const loss = capLoss.get(c.id) ?? { genesis: 0, destiny: 0, astraTrace: 0 };
            addMaterial(state, e.payload.weapon, clearAmounts(c), loss);
            capLoss.set(c.id, loss);
          }
        }
      } else if (e.kind === 'upgrade' && e.payload && 'fromStage' in e.payload) {
        applyUpgrade(state, e.weapon, e.payload);
      } else if (e.kind === 'complete') {
        if (e.weapon === 'soul') state.soul = { ...state.soul, status: 'done', level: 100, gatePassed: false };
        else if (e.weapon === 'genesis') state.genesis = { ...state.genesis, status: 'done', stage: 8 };
        else if (e.weapon === 'destiny') state.destiny = { ...state.destiny, status: 'done', stage: 6 };
        else state.astra = { ...state.astra, status: 'done', stage: 3 };
      } else if (e.kind === 'destinyPhase2' && state.destiny.status === 'phase1done') {
        state.destiny = { status: 'active', stage: 4, pool: 0 };
      } else if (e.kind === 'soulAutoLevel' && e.payload && 'enabled' in e.payload) {
        // 開啟時立即用持有的碎片升級;關閉不會退回已經升的等級
        const s = { ...state.soul, autoLevel: e.payload.enabled };
        state.soul = s.status === 'active' ? soulAutoLevel(s) : s;
      } else if (e.kind === 'soulLevelUp' && e.payload && 'toLevel' in e.payload && state.soul.status === 'active') {
        state.soul = soulLevelUp(state.soul, e.payload.toLevel);
      }
      continue;
    }

    const genesisDone = state.genesis.status === 'done';
    if (it.kind === 'daily') {
      if (genesisDone && state.astra.status === 'active') {
        state.astra = { ...state.astra, shard: state.astra.shard + it.daily.topRegionShards * UNIT };
      }
      continue;
    }

    const c = it.clear;
    const amt = clearAmounts(c);
    const loss: ClearCapLoss = { genesis: 0, destiny: 0, astraTrace: 0 };

    // 靈魂:同一個遊戲週只取最高一隻,只補上比目前最高多出來的部分
    if (amt.soul > 0) {
      const weekKey = localDateKey(gameWeekBounds(input.settings, new Date(c.firstClearedAt)).start);
      const prev = soulWeekMax.get(weekKey) ?? 0;
      if (amt.soul > prev) {
        soulWeekMax.set(weekKey, amt.soul);
        if (state.soul.status === 'active') {
          const { pool } = addCapped(state.soul.pool, amt.soul - prev, SOUL_CAP_UNITS);
          state.soul = soulAutoLevel({ ...state.soul, pool });
        }
      }
    }
    // 單人擊破(組隊人數 1)記入已攻略清單,作為之後升階任務的依據
    if (c.partySize === 1 && state.soul.status !== 'unset') {
      const key = `${c.bossCatalogId}|${c.difficulty}`;
      if (!state.soul.soloCleared.includes(key)) state.soul = { ...state.soul, soloCleared: [...state.soul.soloCleared, key] };
    }

    for (const w of ['genesis', 'destiny', 'astra'] as const) addMaterial(state, w, amt, loss);
    if (loss.genesis || loss.destiny || loss.astraTrace) capLoss.set(c.id, loss);
  }

  return { state, capLoss, adjustAt, adjustIncluded };
}

/**
 * 把一筆擊破的素材加到指定武器(套用持有上限),被截掉的量寫進 loss
 * - 命運、阿斯特拉:創世完成後才會累積;停在第一階段完成畫面期間不計入
 * @param state 目前的武器狀態(直接修改)
 * @param weapon 要加的武器(靈魂另外處理)
 * @param amt 這筆擊破的取得量
 * @param loss 被上限截掉的量(直接修改)
 */
function addMaterial(state: CharacterWeaponState, weapon: Exclude<WeaponKind, 'soul'>, amt: ClearAmounts, loss: ClearCapLoss): void {
  const genesisDone = state.genesis.status === 'done';
  if (weapon === 'genesis') {
    if (amt.genesis <= 0 || state.genesis.status !== 'active') return;
    const r = addCapped(state.genesis.pool, amt.genesis, GENESIS_CAP_UNITS);
    state.genesis = { ...state.genesis, pool: r.pool };
    loss.genesis = r.lost;
  } else if (weapon === 'destiny') {
    if (amt.destiny <= 0 || !genesisDone || state.destiny.status !== 'active') return;
    const r = addCapped(state.destiny.pool, amt.destiny, destinyCap(state.destiny.stage) * UNIT);
    state.destiny = { ...state.destiny, pool: r.pool };
    loss.destiny = r.lost;
  } else {
    if (!genesisDone || state.astra.status !== 'active' || (amt.astraTrace <= 0 && amt.astraShard <= 0)) return;
    const r = addCapped(state.astra.trace, amt.astraTrace, ASTRA_TRACE_CAP_UNITS);
    state.astra = { ...state.astra, trace: r.pool, shard: state.astra.shard + amt.astraShard };
    loss.astraTrace = r.lost;
  }
}
