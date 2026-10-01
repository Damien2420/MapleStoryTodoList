import { findBossCatalogEntry, isBossExpired } from '@/lib/bossCatalog';
import type { CycleSummary } from '@/lib/characterSummary';
import { hoursUntilExpiry } from '@/lib/reset';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { CharacterBossTrackList } from '@/types';

/** 賽季的急迫感門檻,沿用 TaskItem 既有的 expiringSoon(<24小時)慣例 */
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

function hasItems(cycle: CycleSummary): boolean {
  return cycle.taskTotal > 0 || cycle.bossTotal > 0;
}

function isAllDone(cycle: CycleSummary): boolean {
  return cycle.taskDone === cycle.taskTotal && cycle.bossDone === cycle.bossTotal;
}

/**
 * 角色追蹤中「未下架」的賽季王裡最早的截止日期。
 * 過期的賽季王要排除,否則取最小日期會拿到過去的日期,讓急迫標籤誤亮。
 * @param bosses 該角色追蹤中的 BOSS
 * @param now 目前時間
 * @returns 最早的截止日期(YYYY-MM-DD),沒有則為 undefined
 */
function getSeasonExpiresAt(bosses: CharacterBossTrackList[], now: Date): string | undefined {
  const dates = bosses
    .filter((b) => b.category === 'season' && !isBossExpired(b, now))
    .map((b) => (b.bossCatalogId ? findBossCatalogEntry(b.bossCatalogId)?.expiresAt : undefined))
    .filter((d): d is string => !!d);
  return dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min)) : undefined;
}

/**
 * 判斷每週/每月/賽季是否要顯示急迫標籤,展開版週期卡與收合版跳轉磚共用。
 * 每週:今天是設定的重置日;每月:今天是 1 號;賽季:距最早截止日不到 24 小時。三者都要求該週期有項目且尚未全部完成。
 * 注意:每週比對的是全域重置日而非各項目自己的重置日,這是已知問題,本次刻意維持原行為。
 * @param summary 各週期的進度摘要(summarizeCharacterCycles 的結果)
 * @param bosses 該角色追蹤中的 BOSS,用來找賽季截止日
 * @param weeklyResetDay 設定中的每週重置日(0 = 星期日)
 * @param now 目前時間
 * @returns 各週期是否急迫
 */
export function getCycleUrgency(
  summary: Record<BossCycleKey, CycleSummary>,
  bosses: CharacterBossTrackList[],
  weeklyResetDay: number,
  now: Date,
): CycleUrgency {
  const { weekly, monthly, season } = summary;
  const seasonExpiresAt = getSeasonExpiresAt(bosses, now);
  return {
    weekly: hasItems(weekly) && !isAllDone(weekly) && now.getDay() === weeklyResetDay,
    monthly: hasItems(monthly) && !isAllDone(monthly) && now.getDate() === 1,
    season:
      hasItems(season) &&
      !isAllDone(season) &&
      seasonExpiresAt !== undefined &&
      hoursUntilExpiry(seasonExpiresAt, now) < EXPIRY_IMMINENT_HOURS,
  };
}
