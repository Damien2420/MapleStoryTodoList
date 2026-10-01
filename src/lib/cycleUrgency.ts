import { findBossCatalogEntry, isBossExpired } from '@/lib/bossCatalog';
import { isRegularMonthlyBoss, isRegularWeeklyBoss } from '@/lib/characterSummary';
import { findPresetExpiresAt, isTaskExpired } from '@/lib/presetTasks';
import { hoursUntilExpiry, nextResetBoundary } from '@/lib/reset';
import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';

/** 距下次重置/截止不到這個時數就顯示急迫標籤,沿用 TaskItem 既有的 expiringSoon(<24小時)慣例 */
export const EXPIRY_IMMINENT_HOURS = 24;

/** 各週期是否要顯示急迫標籤;每日一定在當天結束前重置、VIP 沒有共同截止時間,所以不提供 */
export interface CycleUrgency {
  weekly: boolean;
  monthly: boolean;
  season: boolean;
}

/** 急迫標籤的文字,展開版週期卡與收合版跳轉磚共用 */
export const URGENCY_LABELS: Record<keyof CycleUrgency, string> = {
  weekly: '即將重置',
  monthly: '即將重置',
  season: '即將截止',
};

/**
 * 判斷每週/每月/賽季是否要顯示急迫標籤,展開版週期卡與收合版跳轉磚共用。
 * 只看「未完成且未下架」的項目,週期分桶與 summarizeCharacterCycles 一致(VIP 王不算進每週/每月):
 * - 每週:任一項距它自己的下次重置不到 24 小時(重置日取項目自己的 weeklyResetDay,沒有才用全域設定)
 * - 每月:有項目且距下次每月重置(1 號)不到 24 小時
 * - 賽季:任一項距截止日不到 24 小時;任務的截止日取預設範本的 expiresAt,手動建立的沒有範本才用 dueDate
 * 下次重置時間用 nextResetBoundary 計算,與清單每一列顯示的「剩餘 X 小時」一致。
 * @param tasks 該角色的任務
 * @param bosses 該角色追蹤中的 BOSS
 * @param settings 重置時間設定
 * @param now 目前時間
 * @returns 各週期是否急迫
 */
export function getCycleUrgency(
  tasks: CharacterTask[],
  bosses: CharacterBossTrackList[],
  settings: Settings,
  now: Date,
): CycleUrgency {
  const pendingTasks = tasks.filter((t) => !t.checked && !isTaskExpired(t, now));
  const pendingBosses = bosses.filter((b) => !b.checked && !isBossExpired(b, now));

  const resetsSoon = (cycle: 'weekly' | 'monthly', weeklyResetDay?: number) =>
    nextResetBoundary(cycle, settings, now, weeklyResetDay).getTime() - now.getTime() <
    EXPIRY_IMMINENT_HOURS * 3_600_000;
  const expiresSoon = (expiresAt: string | undefined) =>
    expiresAt !== undefined && hoursUntilExpiry(expiresAt, now) < EXPIRY_IMMINENT_HOURS;

  const weeklyItems = [...pendingTasks.filter((t) => t.resetCycle === 'weekly'), ...pendingBosses.filter(isRegularWeeklyBoss)];
  const hasMonthlyItems =
    pendingTasks.some((t) => t.resetCycle === 'monthly') || pendingBosses.some(isRegularMonthlyBoss);

  return {
    weekly: weeklyItems.some((item) => resetsSoon('weekly', item.weeklyResetDay)),
    monthly: hasMonthlyItems && resetsSoon('monthly'),
    season:
      pendingTasks.some(
        (t) =>
          t.resetCycle === 'season' &&
          expiresSoon((t.presetId ? findPresetExpiresAt(t.presetId) : undefined) ?? t.dueDate),
      ) ||
      pendingBosses.some(
        (b) =>
          b.category === 'season' &&
          expiresSoon(b.bossCatalogId ? findBossCatalogEntry(b.bossCatalogId)?.expiresAt : undefined),
      ),
  };
}
