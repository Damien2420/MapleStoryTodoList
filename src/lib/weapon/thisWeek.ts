import { GRANDIS_DAILY_PRESET_ID, GRANDIS_DAILY_SHARDS } from '@/data/weaponRates.data';
import { bossCatalogRank } from '@/lib/bossCatalog';
import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';
import { addDays, dayBounds, gameWeekBounds, localDateKey } from './cycle';
import type { FoldResult } from './fold';
import { clearAmounts, hasWeaponRate, type ClearAmounts } from './rates';
import { UNIT, type BossClear, type DailyClear, type WeaponKind, type WeaponProfile } from './types';

/** 本週已取得清單的一列 */
export interface ThisWeekRow {
  clear: BossClear;
  /** 這把武器的計入量(1/60 單位);阿斯特拉為激戰的痕跡 */
  amount: number;
  /** 阿斯特拉的艾里溫碎片(1/60 單位) */
  shard?: number;
  /** 組隊平分的人數;沒有平分時為 undefined */
  split?: number;
  /** 是否為月王 */
  monthly: boolean;
}

/** 單一武器的本週資料 */
export interface WeaponThisWeek {
  rows: ThisWeekRow[];
  /** 本週期所有已勾選的擊破(含已計入持有量的),調整進度時讓使用者選擇要不要加在填的值上;靈魂只有本週給最多的那一隻 */
  cycleRows: ThisWeekRow[];
  /** 合計(1/60 單位);阿斯特拉為激戰的痕跡 */
  total: number;
  /** 阿斯特拉艾里溫碎片合計(BOSS + 每日),1/60 單位 */
  shardTotal: number;
  /** 本週被持有上限截掉、沒有計入的量(1/60 單位) */
  capLoss: number;
  /** 清單中追蹤的來源 BOSS 全部打完,本週還能取得的量(1/60 單位);阿斯特拉為痕跡 */
  potential: number;
  /** 清單完全沒有追蹤會計入這把武器的 BOSS */
  untracked: boolean;
}

/** 阿斯特拉每日 7 格的一格 */
export interface DailyCell {
  /** 星期(四、五…三) */
  weekday: string;
  /** 當天取得的碎片(遊戲內整數),沒做或還沒到為 0 */
  shards: number;
  /** full 做到最高地區、part 較低地區、miss 沒做、future 還沒到 */
  status: 'full' | 'part' | 'miss' | 'future';
  /** 當天完成的最高地區 */
  region?: string;
  today: boolean;
}

/** 阿斯特拉的每日任務資料;untracked 代表任務清單沒有格蘭蒂斯地區每日任務 */
export interface AstraDaily {
  untracked: boolean;
  cells: DailyCell[];
  /** 本週每日合計(遊戲內整數) */
  total: number;
  /** 可做的最高地區與單日數量 */
  maxRegion?: string;
  maxShards: number;
}

/** thisWeek 的輸入 */
export interface ThisWeekInput {
  bossClears: BossClear[];
  dailyClears: DailyClear[];
  fold: FoldResult;
  trackedBosses: CharacterBossTrackList[];
  tasks: CharacterTask[];
  profile: Pick<WeaponProfile, 'genesisPass' | 'stormTraining'>;
  settings: Settings;
  now: Date;
}

/** 四把武器的本週資料與阿斯特拉每日任務 */
export interface ThisWeekResult {
  weapons: Record<WeaponKind, WeaponThisWeek>;
  daily: AstraDaily;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 依武器取出計入量 */
function weaponAmount(a: ClearAmounts, weapon: WeaponKind): number {
  if (weapon === 'astra') return a.astraTrace;
  return a[weapon];
}

/** 這一列是否有組隊平分(暴風修練搭配通行證時,2 人組隊的創世不平分) */
function splitOf(c: Pick<BossClear, 'partySize' | 'genesisPass' | 'stormTraining'>, weapon: WeaponKind): number | undefined {
  if (c.partySize <= 1 || weapon === 'soul') return undefined;
  if (weapon === 'genesis' && c.genesisPass && c.stormTraining && c.partySize === 2) return undefined;
  return c.partySize;
}

/** 計入量最高的一列(同量時取排在前面的);沒有時回傳 undefined */
function topOf(rows: ThisWeekRow[]): ThisWeekRow | undefined {
  return rows.length > 0 ? rows.reduce((t, r) => (r.amount > t.amount ? r : t)) : undefined;
}

/** 地區取得量對應回地區名稱 */
function regionOf(shards: number): string | undefined {
  return Object.entries(GRANDIS_DAILY_SHARDS).find(([, v]) => v === shards)?.[0];
}

/**
 * 計算本週已取得清單、超過上限的量、本週還能取得的量,以及阿斯特拉每日 7 格
 * - 本週 = 紀錄所屬週期還在進行中;校正之前的紀錄已包含在使用者填的值裡,不列出
 * - 靈魂只回傳本週最高的一隻
 * @param input 同一個角色的紀錄、fold 結果、追蹤中的 BOSS 與任務、加成設定與時間
 */
export function computeThisWeek(input: ThisWeekInput): ThisWeekResult {
  const { now, fold } = input;
  const nowIso = now.toISOString();
  const current = input.bossClears.filter((c) => c.active && c.cycleEnd > nowIso);
  const tracked = input.trackedBosses.filter(
    (b) => b.bossCatalogId && b.resetCycle !== 'daily' && hasWeaponRate(b.bossCatalogId, b.difficulty),
  );

  const build = (weapon: WeaponKind): WeaponThisWeek => {
    const all: ThisWeekRow[] = current
      .map((c) => {
        const a = clearAmounts(c);
        return {
          clear: c,
          amount: weaponAmount(a, weapon),
          shard: weapon === 'astra' ? a.astraShard : undefined,
          split: splitOf(c, weapon),
          monthly: isMonthly(c, input.trackedBosses),
        };
      })
      .filter((r) => r.amount > 0 || (r.shard ?? 0) > 0)
      .sort((a, b) => bossCatalogRank(a.clear.bossCatalogId, a.clear.difficulty) - bossCatalogRank(b.clear.bossCatalogId, b.clear.difficulty));
    // 校正之前打的不列出(校正時勾選加入的除外):素材已包含在使用者填的持有量裡,列出來會跟持有量對不上
    const since = fold.adjustAt[weapon] ?? '';
    const included = new Set(fold.adjustIncluded[weapon]);
    const counted = (r: ThisWeekRow) => r.clear.firstClearedAt >= since || included.has(r.clear.id);
    let rows = all.filter(counted);
    if (weapon === 'soul') {
      // 靈魂一週只算給最多的那一隻,和 fold 的算法一致:
      // 本週計入 = 校正時選擇加入的量 + 校正後打到超過「校正前本週最高」的部分
      const pre = all.filter((r) => r.clear.firstClearedAt < since);
      const preMax = Math.max(0, ...pre.map((r) => r.amount));
      const inc = topOf(pre.filter((r) => included.has(r.clear.id)));
      const after = topOf(all.filter((r) => r.clear.firstClearedAt >= since));
      const extra = after && after.amount > preMax ? after.amount - preMax : 0;
      const shown = extra > 0 ? after : inc;
      const amount = (inc?.amount ?? 0) + extra;
      rows = shown && amount > 0 ? [{ ...shown, amount }] : [];
    }
    // 校正時讓使用者選擇要不要加在填的值上:本週期所有已勾選的;靈魂一週只算一隻,只給最多的那一隻
    const soulTop = weapon === 'soul' ? topOf(all) : undefined;
    const cycleRows = weapon === 'soul' ? (soulTop ? [soulTop] : []) : all;

    const capLoss = rows.reduce((s, r) => {
      const l = fold.capLoss.get(r.clear.id);
      if (!l) return s;
      return s + (weapon === 'genesis' ? l.genesis : weapon === 'destiny' ? l.destiny : weapon === 'astra' ? l.astraTrace : 0);
    }, 0);

    const sources = tracked.filter((b) => {
      const a = clearAmounts({ ...b, bossCatalogId: b.bossCatalogId!, ...input.profile });
      return weaponAmount(a, weapon) > 0 || (weapon === 'astra' && a.astraShard > 0);
    });
    const amounts = sources
      .filter((b) => !b.checked)
      .map((b) => weaponAmount(clearAmounts({ ...b, bossCatalogId: b.bossCatalogId!, ...input.profile }), weapon));
    const potential = weapon === 'soul' ? Math.max(0, ...amounts) : amounts.reduce((s, x) => s + x, 0);

    return {
      rows,
      cycleRows,
      total: rows.reduce((s, r) => s + r.amount, 0),
      shardTotal: rows.reduce((s, r) => s + (r.shard ?? 0), 0),
      capLoss,
      potential,
      untracked: sources.length === 0,
    };
  };

  const weapons: Record<WeaponKind, WeaponThisWeek> = {
    soul: build('soul'),
    genesis: build('genesis'),
    destiny: build('destiny'),
    astra: build('astra'),
  };
  const daily = computeDaily(input);
  weapons.astra.shardTotal += daily.total * UNIT;
  return { weapons, daily };
}

/** 擊破紀錄是否來自月王(依目前追蹤項目的週期判斷,查不到時以 BOSS 種類判斷) */
function isMonthly(c: BossClear, bosses: CharacterBossTrackList[]): boolean {
  const tracked = bosses.find((b) => b.bossCatalogId === c.bossCatalogId);
  return tracked ? tracked.resetCycle === 'monthly' : c.bossCatalogId === 'black-mage';
}

/** 阿斯特拉每日 7 格(週四重置日到週三) */
function computeDaily(input: ThisWeekInput): AstraDaily {
  const { settings, now } = input;
  const zones = input.tasks
    .filter((t) => t.presetId === GRANDIS_DAILY_PRESET_ID)
    .map((t) => GRANDIS_DAILY_SHARDS[t.name] ?? 0);
  const maxShards = Math.max(0, ...zones);
  if (zones.length === 0) return { untracked: true, cells: [], total: 0, maxShards: 0 };

  const week = gameWeekBounds(settings, now);
  // 每日重置晚於每週重置時,週四重置後到每日重置前仍屬於上一個遊戲日,今天格改落在本週第一格
  const todayStart = dayBounds(settings, now).start;
  const todayKey = localDateKey(todayStart < week.start ? week.start : todayStart);
  const since = input.fold.adjustAt.astra ?? '';
  const byDay = new Map(
    input.dailyClears.filter((d) => d.firstClearedAt >= since).map((d) => [localDateKey(new Date(d.day)), d.topRegionShards]),
  );
  let total = 0;
  const cells: DailyCell[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(week.start, i);
    const key = localDateKey(day);
    const shards = byDay.get(key) ?? 0;
    const today = key === todayKey;
    const future = !today && key > todayKey;
    total += shards;
    cells.push({
      weekday: WEEKDAYS[day.getDay()],
      shards,
      status: shards > 0 ? (shards >= maxShards ? 'full' : 'part') : future || today ? 'future' : 'miss',
      region: shards > 0 ? regionOf(shards) : undefined,
      today,
    });
  }
  return { untracked: false, cells, total, maxRegion: regionOf(maxShards), maxShards };
}
