import type { CharacterTask, Settings } from '@/types';

/** 解析 "HH:mm" 字串為 { hours, minutes } */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
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

/** 判斷單一任務是否已跨越下一次重置時間點,需要把勾選狀態清掉 */
export function needsReset(task: CharacterTask, settings: Settings, now: Date = new Date()): boolean {
  if (!task.checked) return false;
  if (task.resetCycle === 'once') return false;

  const lastReset = new Date(task.lastResetAt);
  const boundary =
    task.resetCycle === 'daily'
      ? latestDailyBoundary(now, settings.dailyResetTime)
      : latestWeeklyBoundary(now, task.weeklyResetDay ?? settings.weeklyResetDay, settings.weeklyResetTime);

  return lastReset < boundary;
}

/** 計算「以 now 為基準,下一次的每日/每週重置時間點」;每週任務可傳入 weeklyResetDay 覆寫全域設定 */
export function nextResetBoundary(
  resetCycle: 'daily' | 'weekly',
  settings: Settings,
  now: Date = new Date(),
  weeklyResetDay?: number,
): Date {
  if (resetCycle === 'daily') {
    const next = latestDailyBoundary(now, settings.dailyResetTime);
    next.setDate(next.getDate() + 1);
    return next;
  }
  const next = latestWeeklyBoundary(now, weeklyResetDay ?? settings.weeklyResetDay, settings.weeklyResetTime);
  next.setDate(next.getDate() + 7);
  return next;
}

/** 計算「距離下次重置」還剩幾分鐘 */
export function minutesUntilReset(
  resetCycle: 'daily' | 'weekly',
  settings: Settings,
  now: Date = new Date(),
  weeklyResetDay?: number,
): number {
  const diffMs = Math.max(0, nextResetBoundary(resetCycle, settings, now, weeklyResetDay).getTime() - now.getTime());
  return Math.floor(diffMs / 60_000);
}

/** 把「距離下次重置」的時間差格式化成「剩餘 X 天 X 小時 / X 小時 / X 分鐘」 */
export function formatTimeUntilReset(
  resetCycle: 'daily' | 'weekly',
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