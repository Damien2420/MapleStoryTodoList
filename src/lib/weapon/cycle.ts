import { nextResetBoundary } from '@/lib/reset';
import type { Settings } from '@/types';

/** 遊戲週的重置星期(週四),靈魂「每週取最高」、阿斯特拉每日 7 格都以遊戲週分組 */
export const GAME_WEEK_RESET_DAY = 4;

const DAY_MS = 86_400_000;

/** 一個重置週期的起訖時間 */
export interface CycleBounds {
  start: Date;
  end: Date;
}

/**
 * 計算時間點 t 所在的重置週期;週期邊界直接沿用 reset.ts 的下一次重置時間,與勾選框的重置時間一致
 * @param cycle 重置週期
 * @param settings 重置時間設定
 * @param t 要查詢的時間點
 * @param weeklyResetDay 每週重置的星期,未設定沿用全域設定
 * @returns 週期的開始(含)與結束(不含)
 */
export function cycleBounds(
  cycle: 'daily' | 'weekly' | 'monthly',
  settings: Settings,
  t: Date,
  weeklyResetDay?: number,
): CycleBounds {
  const end = nextResetBoundary(cycle, settings, t, weeklyResetDay);
  const start = new Date(end);
  if (cycle === 'daily') start.setDate(start.getDate() - 1);
  else if (cycle === 'weekly') start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return { start, end };
}

/** 本機時區的 YYYY-MM-DD,用來組紀錄 id */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 時間點 t 所在遊戲週(週四重置)的起訖 */
export function gameWeekBounds(settings: Settings, t: Date): CycleBounds {
  return cycleBounds('weekly', settings, t, GAME_WEEK_RESET_DAY);
}

/** 時間點 t 所在的一天(每日重置時間點起算) */
export function dayBounds(settings: Settings, t: Date): CycleBounds {
  return cycleBounds('daily', settings, t);
}

/** 加上 n 天(回傳新物件) */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 兩個時間點相差的天數(可為小數) */
export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}
