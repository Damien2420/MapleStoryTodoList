import type { CharacterBossTrackList, CharacterTask } from '@/types';
import type { BossCycleKey } from '@/store/useListFilterStore';
import { isTaskExpired } from '@/lib/presetTasks';
import { getEffectiveCrystalValue, getWeeklyRevenueCountedIds, isBossExpired } from '@/lib/bossCatalog';

export interface CycleSummary {
  taskDone: number;
  taskTotal: number;
  bossDone: number;
  bossTotal: number;
  /** undefined = 這個週期不顯示收益行;數字(含 0)= 顯示 */
  revenue?: number;
}

/** 一般每週王(不含賽季、不含 VIP)。VIP 每週重置王的 resetCycle 也是 weekly,但要獨立算進 vip 週期,天真的 filter 會重複計算 */
export function isRegularWeeklyBoss(boss: Pick<CharacterBossTrackList, 'resetCycle' | 'category'>): boolean {
  return boss.resetCycle === 'weekly' && boss.category !== 'season' && boss.category !== 'vip';
}

/** 一般每月王(不含 VIP) */
export function isRegularMonthlyBoss(boss: Pick<CharacterBossTrackList, 'resetCycle' | 'category'>): boolean {
  return boss.resetCycle === 'monthly' && boss.category !== 'vip';
}

function sumRevenue(bosses: Pick<CharacterBossTrackList, 'checked' | 'crystalValue' | 'partySize'>[]): number {
  return bosses.reduce((sum, b) => sum + (b.checked ? getEffectiveCrystalValue(b) : 0), 0);
}

function countChecked(items: { checked: boolean }[]): number {
  return items.filter((i) => i.checked).length;
}

/**
 * 傳入「已經篩到同一隻角色」的任務與 BOSS 追蹤紀錄,回傳五個週期的完成度與收益。
 * 內部負責:排除已下架的任務範本/BOSS 目錄項目、依週期分桶(含 VIP/賽季陷阱)、週收益共用上限、收益顯示條件。
 * @param now 判斷下架的基準時間,預設現在;測試用
 */
export function summarizeCharacterCycles(
  tasks: CharacterTask[],
  bosses: CharacterBossTrackList[],
  now: Date = new Date(),
): Record<BossCycleKey, CycleSummary> {
  const activeTasks = tasks.filter((t) => !isTaskExpired(t, now));
  const activeBosses = bosses.filter((b) => !isBossExpired(b, now));

  // 'once'/'biweekly-weekend' 任務不屬於任何週期,靜默丟棄
  const dailyTasks = activeTasks.filter((t) => t.resetCycle === 'daily');
  const weeklyTasks = activeTasks.filter((t) => t.resetCycle === 'weekly');
  const monthlyTasks = activeTasks.filter((t) => t.resetCycle === 'monthly');
  const seasonTasks = activeTasks.filter((t) => t.resetCycle === 'season');

  const dailyBosses = activeBosses.filter((b) => b.resetCycle === 'daily');
  const weeklyBosses = activeBosses.filter(isRegularWeeklyBoss);
  const monthlyBosses = activeBosses.filter(isRegularMonthlyBoss);
  const seasonBosses = activeBosses.filter((b) => b.category === 'season');
  const vipBosses = activeBosses.filter((b) => b.category === 'vip');
  // VIP重置券裡「下/中/上/終極」是每週重置,跟一般週王共用同一個每週收益上限;「每月」不受週上限限制,收益併入每月討伐收益
  const vipWeeklyBosses = vipBosses.filter((b) => b.resetCycle === 'weekly');
  const vipMonthlyBosses = vipBosses.filter((b) => b.resetCycle === 'monthly');

  // 每週收益上限是一般週王 + VIP週重置王共用同一個名額,已討伐的王依結晶價值取前 WEEKLY_BOSS_LIMIT 名計入收益
  const weeklyEligibleBosses = [...weeklyBosses, ...vipWeeklyBosses];
  const weeklyCountedIds = getWeeklyRevenueCountedIds(weeklyEligibleBosses);
  const weeklyRevenue = weeklyEligibleBosses.reduce(
    (sum, b) => sum + (weeklyCountedIds.has(b.id) ? getEffectiveCrystalValue(b) : 0),
    0,
  );
  // 每月收益不受週上限限制,一般月王 + VIP每月重置王直接加總
  const monthlyRevenue = sumRevenue([...monthlyBosses, ...vipMonthlyBosses]);

  return {
    daily: {
      taskDone: countChecked(dailyTasks),
      taskTotal: dailyTasks.length,
      bossDone: countChecked(dailyBosses),
      bossTotal: dailyBosses.length,
      revenue: dailyBosses.length > 0 ? sumRevenue(dailyBosses) : undefined,
    },
    weekly: {
      taskDone: countChecked(weeklyTasks),
      taskTotal: weeklyTasks.length,
      bossDone: countChecked(weeklyBosses),
      bossTotal: weeklyBosses.length,
      // 顯示條件只看一般週王,不含 VIP:只掛 VIP 週王、沒有一般週王的角色,週收益是 undefined
      revenue: weeklyBosses.length > 0 ? weeklyRevenue : undefined,
    },
    monthly: {
      taskDone: countChecked(monthlyTasks),
      taskTotal: monthlyTasks.length,
      bossDone: countChecked(monthlyBosses),
      bossTotal: monthlyBosses.length,
      // 顯示條件是一般月王或 VIP月王任一有追蹤,跟 weekly 口徑不同
      revenue: monthlyBosses.length > 0 || vipMonthlyBosses.length > 0 ? monthlyRevenue : undefined,
    },
    season: {
      taskDone: countChecked(seasonTasks),
      taskTotal: seasonTasks.length,
      bossDone: countChecked(seasonBosses),
      bossTotal: seasonBosses.length,
      revenue: undefined,
    },
    vip: {
      taskDone: 0,
      taskTotal: 0,
      bossDone: countChecked(vipBosses),
      bossTotal: vipBosses.length,
      revenue: undefined,
    },
  };
}
