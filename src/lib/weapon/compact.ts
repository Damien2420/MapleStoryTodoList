import type { Settings } from '@/types';
import { addDays, cycleBounds, gameWeekBounds } from './cycle';
import { foldWeapons } from './fold';
import { RULES_VERSION, type BossClear, type DailyClear, type WeaponCheckpoint, type WeaponEvent } from './types';

/** 紀錄保留的寬限期:週期結束超過 4 週的紀錄才會折入存檔點 */
export const COMPACT_GRACE_DAYS = 28;

/**
 * 計算這次壓縮的截止時間(新的 watermark):時間早於這個點的紀錄,所屬週期一定都已經結束超過寬限期。
 * - 取「寬限期再往前 7 天」與「寬限期所在月份的月初」較早者,週王(任一重置星期)與月王的週期都已結束
 * - 再往前對齊到遊戲週(週四)的開始,靈魂「每週取最高」的分組不會被切成兩半
 * @param now 目前時間
 * @param settings 重置時間設定
 */
export function compactWatermark(now: Date, settings: Settings): Date {
  const cutoff = addDays(now, -COMPACT_GRACE_DAYS);
  const weekSafe = addDays(cutoff, -7);
  const monthStart = cycleBounds('monthly', settings, cutoff).start;
  const earliest = weekSafe < monthStart ? weekSafe : monthStart;
  return gameWeekBounds(settings, earliest).start;
}

/** 單一角色要壓縮的資料 */
export interface CompactInput {
  characterId: string;
  checkpoint?: WeaponCheckpoint;
  bossClears: BossClear[];
  dailyClears: DailyClear[];
  events: WeaponEvent[];
}

/** 壓縮結果:新的存檔點與要刪除的紀錄 id */
export interface CompactResult {
  checkpoint: WeaponCheckpoint;
  removeBossClearIds: string[];
  removeDailyClearIds: string[];
  removeEventIds: string[];
}

/**
 * 把早於 watermark 的紀錄與事件折進存檔點。用和畫面相同的 fold 函式,壓縮前後算出的狀態一定相同
 * @param input 單一角色的存檔點、紀錄與事件
 * @param watermark 新的截止時間(compactWatermark 的結果)
 * @param settings 重置時間設定
 * @param nowIso 寫入 updatedAt 用的時間
 * @returns 沒有可壓縮的資料時回傳 null
 */
export function compactCharacter(
  input: CompactInput,
  watermark: Date,
  settings: Settings,
  nowIso: string,
): CompactResult | null {
  const wm = watermark.toISOString();
  if (input.checkpoint && input.checkpoint.watermark >= wm) return null;
  const oldEvents = input.events.filter((e) => e.at < wm);
  const oldBoss = input.bossClears.filter((c) => c.firstClearedAt < wm);
  // 還沒壓縮的校正事件勾選加入的擊破:照樣折進存檔點(對其他武器的累積不變),但紀錄要留著,fold 才找得到它們再加一次
  const referenced = new Set(
    input.events.filter((e) => e.at >= wm && e.payload && 'includeClearIds' in e.payload).flatMap((e) => (e.payload as { includeClearIds?: string[] }).includeClearIds ?? []),
  );
  const oldDaily = input.dailyClears.filter((d) => d.firstClearedAt < wm);
  if (oldBoss.length + oldDaily.length + oldEvents.length === 0) return null;

  const { state } = foldWeapons({
    checkpoint: input.checkpoint,
    bossClears: oldBoss,
    dailyClears: oldDaily,
    events: oldEvents,
    settings,
  });
  return {
    checkpoint: { id: input.characterId, watermark: wm, state, rulesVersion: RULES_VERSION, updatedAt: nowIso },
    removeBossClearIds: oldBoss.filter((c) => !referenced.has(c.id)).map((c) => c.id),
    removeDailyClearIds: oldDaily.map((d) => d.id),
    removeEventIds: oldEvents.map((e) => e.id),
  };
}
