import type { CharacterTask, Settings } from '@/types';

/** 解析 "HH:mm" 字串為 { hours, minutes } */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/** 雙週週末活動的循環基準日:2026-07-31(週五)00:00,之後每 14 天循環一次,關閉於當週週日 20:30 */
const WEEKEND_EVENT_ANCHOR = new Date(2026, 6, 31);
const WEEKEND_EVENT_CYCLE_DAYS = 14;
const WEEKEND_EVENT_CLOSE_HOUR = 20;
const WEEKEND_EVENT_CLOSE_MINUTE = 30;

/** 把 Date 歸零到當天 00:00:00.000(回傳新物件,不改動原物件) */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 計算「以 now 為基準,最近一次(含現在)雙週週末活動的開放起始日」 */
function latestWeekendEventOpenBoundary(now: Date): Date {
  const anchor = startOfDay(WEEKEND_EVENT_ANCHOR);
  const daysSinceAnchor = Math.floor((startOfDay(now).getTime() - anchor.getTime()) / 86_400_000);
  const cycleIndex = Math.floor(daysSinceAnchor / WEEKEND_EVENT_CYCLE_DAYS);
  const boundary = new Date(anchor);
  boundary.setDate(boundary.getDate() + cycleIndex * WEEKEND_EVENT_CYCLE_DAYS);
  return boundary;
}

/** 計算某次開放週期(週五 00:00)對應的關閉時間點(週日 20:30) */
function weekendEventCloseTime(openBoundary: Date): Date {
  const close = new Date(openBoundary);
  close.setDate(close.getDate() + 2);
  close.setHours(WEEKEND_EVENT_CLOSE_HOUR, WEEKEND_EVENT_CLOSE_MINUTE, 0, 0);
  return close;
}

/** 判斷 now 是否落在雙週週末活動的開放時段內(週五 00:00 ~ 週日 20:30) */
export function isWeekendEventOpen(now: Date = new Date()): boolean {
  const openBoundary = latestWeekendEventOpenBoundary(now);
  return now >= openBoundary && now <= weekendEventCloseTime(openBoundary);
}

/** 判斷已勾選的雙週週末活動項目是否已跨越下一次開放時間點(下次開放窗口開始時才清空勾選) */
export function needsWeekendEventReset(checked: boolean, lastResetAt: string, now: Date = new Date()): boolean {
  if (!checked) return false;
  const lastReset = new Date(lastResetAt);
  return lastReset < latestWeekendEventOpenBoundary(now);
}

/** 把雙週週末活動的開放狀態格式化成顯示文字:開放中顯示倒數關閉時間,未開放顯示下次開放日期(M/D) */
export function formatWeekendEventStatus(now: Date = new Date()): string {
  const openBoundary = latestWeekendEventOpenBoundary(now);
  const closeTime = weekendEventCloseTime(openBoundary);
  if (now <= closeTime) {
    const totalMinutes = Math.floor(Math.max(0, closeTime.getTime() - now.getTime()) / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `開放中，剩餘 ${days} 天 ${hours} 小時`;
    if (hours > 0) return `開放中，剩餘 ${hours} 小時`;
    return `開放中，剩餘 ${minutes} 分鐘`;
  }
  const nextOpen = new Date(openBoundary);
  nextOpen.setDate(nextOpen.getDate() + WEEKEND_EVENT_CYCLE_DAYS);
  return `尚未開放，${nextOpen.getMonth() + 1}/${nextOpen.getDate()} 開放`;
}

/** 計算「以 now 為基準,最近一次的每日重置時間點」 */
function latestDailyBoundary(now: Date, dailyResetTime: string): Date {
  const { hours, minutes } = parseTime(dailyResetTime);
  const boundary = new Date(now);
  boundary.setHours(hours, minutes, 0, 0);
  if (boundary > now) {
    boundary.setDate(boundary.getDate() - 1);
  }
  return boundary;
}

/** 計算「以 now 為基準,最近一次的每週重置時間點」 */
function latestWeeklyBoundary(now: Date, weeklyResetDay: number, weeklyResetTime: string): Date {
  const { hours, minutes } = parseTime(weeklyResetTime);
  const boundary = new Date(now);
  boundary.setHours(hours, minutes, 0, 0);
  const dayDiff = (boundary.getDay() - weeklyResetDay + 7) % 7;
  boundary.setDate(boundary.getDate() - dayDiff);
  if (boundary > now) {
    boundary.setDate(boundary.getDate() - 7);
  }
  return boundary;
}

/** 計算「以 now 為基準,最近一次的每月重置時間點」,固定在每月 1 號重置 */
function latestMonthlyBoundary(now: Date, resetTime: string): Date {
  const { hours, minutes } = parseTime(resetTime);
  const boundary = new Date(now.getFullYear(), now.getMonth(), 1, hours, minutes, 0, 0);
  if (boundary > now) {
    boundary.setMonth(boundary.getMonth() - 1);
  }
  return boundary;
}

/** 判斷已勾選的每月項目是否已跨越下一次重置時間點(每月 1 號,沿用每日重置時間) */
export function needsMonthlyReset(checked: boolean, lastResetAt: string, settings: Settings, now: Date = new Date()): boolean {
  if (!checked) return false;
  const lastReset = new Date(lastResetAt);
  const boundary = latestMonthlyBoundary(now, settings.dailyResetTime);
  return lastReset < boundary;
}

/** 判斷單一任務是否已跨越下一次重置時間點,需要把勾選狀態清掉 */
export function needsReset(task: CharacterTask, settings: Settings, now: Date = new Date()): boolean {
  if (!task.checked) return false;
  if (task.resetCycle === 'once') return false;
  if (task.resetCycle === 'monthly') return needsMonthlyReset(task.checked, task.lastResetAt, settings, now);
  if (task.resetCycle === 'biweekly-weekend') return needsWeekendEventReset(task.checked, task.lastResetAt, now);

  const lastReset = new Date(task.lastResetAt);
  const boundary =
    task.resetCycle === 'daily'
      ? latestDailyBoundary(now, settings.dailyResetTime)
      : latestWeeklyBoundary(now, task.weeklyResetDay ?? settings.weeklyResetDay, settings.weeklyResetTime);

  return lastReset < boundary;
}

/** 計算「以 now 為基準,下一次的每日/每週/每月重置時間點」;每週任務可傳入 weeklyResetDay 覆寫全域設定 */
export function nextResetBoundary(
  resetCycle: 'daily' | 'weekly' | 'monthly',
  settings: Settings,
  now: Date = new Date(),
  weeklyResetDay?: number,
): Date {
  if (resetCycle === 'daily') {
    const next = latestDailyBoundary(now, settings.dailyResetTime);
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (resetCycle === 'weekly') {
    const next = latestWeeklyBoundary(now, weeklyResetDay ?? settings.weeklyResetDay, settings.weeklyResetTime);
    next.setDate(next.getDate() + 7);
    return next;
  }
  const next = latestMonthlyBoundary(now, settings.dailyResetTime);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/** 計算「距離下次重置」還剩幾分鐘 */
export function minutesUntilReset(
  resetCycle: 'daily' | 'weekly' | 'monthly',
  settings: Settings,
  now: Date = new Date(),
  weeklyResetDay?: number,
): number {
  const diffMs = Math.max(0, nextResetBoundary(resetCycle, settings, now, weeklyResetDay).getTime() - now.getTime());
  return Math.floor(diffMs / 60_000);
}

/** 把「距離下次重置」的時間差格式化成「剩餘 X 天 X 小時 / X 小時 / X 分鐘」 */
export function formatTimeUntilReset(
  resetCycle: 'daily' | 'weekly' | 'monthly',
  settings: Settings,
  now: Date = new Date(),
  weeklyResetDay?: number,
): string {
  const totalMinutes = minutesUntilReset(resetCycle, settings, now, weeklyResetDay);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `剩餘 ${days} 天 ${hours} 小時`;
  if (hours > 0) return `剩餘 ${hours} 小時`;
  return `剩餘 ${minutes} 分鐘`;
}

/** 把 expiresAt(YYYY-MM-DD)視為當天 23:59:59.999 到期,回傳對應的 Date */
function endOfExpiryDay(expiresAt: string): Date {
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** 計算「距離截止日期(含當天)結束」還剩幾個完整小時,超過視為 0 */
export function hoursUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const diffMs = Math.max(0, endOfExpiryDay(expiresAt).getTime() - now.getTime());
  return Math.floor(diffMs / 3_600_000);
}

/** 把「距離截止日期」的時間差格式化成「還有 X 天」(剩餘 >= 24 小時)或「還有 X 小時」(剩餘 < 24 小時) */
export function formatTimeUntilExpiry(expiresAt: string, now: Date = new Date()): string {
  const totalHours = hoursUntilExpiry(expiresAt, now);
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    return `還有 ${days} 天`;
  }
  return `還有 ${totalHours} 小時`;
}

/** 把 expiresAt(YYYY-MM-DD)格式化成 tooltip 顯示用的完整日期文字,例如「2026/08/01 截止」 */
export function formatExpiryDate(expiresAt: string): string {
  const [year, month, day] = expiresAt.split('-');
  return `${year}/${Number(month)}/${Number(day)} 截止`;
}