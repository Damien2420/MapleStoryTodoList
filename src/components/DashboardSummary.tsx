import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { isPresetExpired } from '@/lib/presetTasks';
import { findBossCatalogEntry, getEffectiveCrystalValue, isCatalogEntryExpired } from '@/lib/bossCatalog';
import { formatCrystalValue } from '@/lib/formatCrystal';
import type { Character, CharacterTask } from '@/types';

/** 任務對應的預設範本是否已下架(沒有 presetId 的任務視為未下架) */
function isTaskExpired(task: CharacterTask): boolean {
  return task.presetId ? isPresetExpired(task.presetId) : false;
}

/** BOSS 討伐記錄對應的目錄項目是否已下架(沒有 bossCatalogId 視為未下架) */
function isBossExpired(boss: { bossCatalogId?: string }): boolean {
  if (!boss.bossCatalogId) return false;
  const entry = findBossCatalogEntry(boss.bossCatalogId);
  return entry ? isCatalogEntryExpired(entry) : false;
}

/** 角色總覽摘要:顯示任務完成進度與已討伐 BOSS 的結晶收益(只計已勾選),不帶卡片外框,由 CharacterHeader 併入同一橫帶顯示 */
export function DashboardSummary({ character, className }: { character: Character; className?: string }) {
  const allTasks = useTaskStore((s) => s.tasks);
  const allBosses = useBossStore((s) => s.bosses);

  const tasks = useMemo(
    () => allTasks.filter((t) => t.characterId === character.id && !isTaskExpired(t)),
    [allTasks, character.id],
  );
  const bosses = useMemo(
    () => allBosses.filter((b) => b.characterId === character.id && !isBossExpired(b)),
    [allBosses, character.id],
  );

  const dailyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'daily'), [tasks]);
  const weeklyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'weekly'), [tasks]);
  const dailyDoneCount = useMemo(() => dailyTasks.filter((t) => t.checked).length, [dailyTasks]);
  const weeklyDoneCount = useMemo(() => weeklyTasks.filter((t) => t.checked).length, [weeklyTasks]);

  const dailyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'daily'), [bosses]);
  const weeklyBosses = useMemo(
    () => bosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season'),
    [bosses],
  );
  const monthlyBosses = useMemo(() => bosses.filter((b) => b.resetCycle === 'monthly'), [bosses]);
  const seasonBosses = useMemo(() => bosses.filter((b) => b.category === 'season'), [bosses]);
  // 討伐進度:該週期已勾選(已討伐)的 BOSS 數 / 該週期未下架的追蹤中 BOSS 總數
  const dailyDoneBossCount = useMemo(() => dailyBosses.filter((b) => b.checked).length, [dailyBosses]);
  const weeklyDoneBossCount = useMemo(() => weeklyBosses.filter((b) => b.checked).length, [weeklyBosses]);
  const monthlyDoneBossCount = useMemo(() => monthlyBosses.filter((b) => b.checked).length, [monthlyBosses]);
  const seasonDoneBossCount = useMemo(() => seasonBosses.filter((b) => b.checked).length, [seasonBosses]);
  // 收益只計入已勾選(已討伐)的 BOSS,未勾選不算;收益依攻略人數平分後計算
  const dailyTotal = useMemo(
    () => dailyBosses.reduce((sum, b) => sum + (b.checked ? getEffectiveCrystalValue(b) : 0), 0),
    [dailyBosses],
  );
  const weeklyTotal = useMemo(
    () => weeklyBosses.reduce((sum, b) => sum + (b.checked ? getEffectiveCrystalValue(b) : 0), 0),
    [weeklyBosses],
  );
  const monthlyTotal = useMemo(
    () => monthlyBosses.reduce((sum, b) => sum + (b.checked ? getEffectiveCrystalValue(b) : 0), 0),
    [monthlyBosses],
  );

  const hasTaskSummary = dailyTasks.length > 0 || weeklyTasks.length > 0;
  const hasBossSummary =
    dailyBosses.length > 0 || weeklyBosses.length > 0 || monthlyBosses.length > 0 || seasonBosses.length > 0;
  const hasBossRevenue = dailyBosses.length > 0 || weeklyBosses.length > 0 || monthlyBosses.length > 0;

  if (!hasTaskSummary && !hasBossSummary) return null;

  return (
    <div
      className={cn(
        'grid gap-4',
        hasTaskSummary && hasBossSummary && 'lg:grid-cols-[2fr_3fr] lg:gap-0 lg:divide-x lg:divide-border',
        className,
      )}
    >
      {hasTaskSummary && (
        <div className={cn('flex flex-col gap-3', hasBossSummary && 'lg:pr-4')}>
          {dailyTasks.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground tabular-nums">
                每日進度 {dailyDoneCount} / {dailyTasks.length}
              </p>
              <Progress
                value={(dailyDoneCount / dailyTasks.length) * 100}
                indicatorClassName="bg-cycle-daily-foreground"
              />
            </div>
          )}

          {weeklyTasks.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground tabular-nums">
                每週進度 {weeklyDoneCount} / {weeklyTasks.length}
              </p>
              <Progress
                value={(weeklyDoneCount / weeklyTasks.length) * 100}
                indicatorClassName="bg-cycle-weekly-foreground"
              />
            </div>
          )}
        </div>
      )}

      {hasBossSummary && (
        <div className={cn('flex flex-col gap-3', hasTaskSummary && 'lg:pl-4')}>
          {hasBossRevenue && (
            <div className="flex flex-col gap-2 min-[440px]:flex-row min-[440px]:items-center">
              {dailyBosses.length > 0 && (
                <div className="flex min-w-0 items-center justify-between gap-2 min-[440px]:flex-1 min-[440px]:flex-col min-[440px]:justify-normal min-[440px]:gap-1">
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:text-sm min-[440px]:w-full min-[440px]:justify-center">
                    <img src="/Intense_Power_Crystal_(Daily).png" alt="" className="size-4 shrink-0" />
                    <span className="truncate">本日討伐收益</span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground min-[440px]:w-full min-[440px]:truncate min-[440px]:text-center">
                    ${formatCrystalValue(dailyTotal)}
                  </p>
                </div>
              )}
              {weeklyBosses.length > 0 && (
                <div className="flex min-w-0 items-center justify-between gap-2 min-[440px]:flex-1 min-[440px]:flex-col min-[440px]:justify-normal min-[440px]:gap-1">
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:text-sm min-[440px]:w-full min-[440px]:justify-center">
                    <img src="/Intense_Power_Crystal_(Weekly).png" alt="" className="size-4 shrink-0" />
                    <span className="truncate">本週討伐收益</span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground min-[440px]:w-full min-[440px]:truncate min-[440px]:text-center">
                    ${formatCrystalValue(weeklyTotal)}
                  </p>
                </div>
              )}
              {monthlyBosses.length > 0 && (
                <div className="flex min-w-0 items-center justify-between gap-2 min-[440px]:flex-1 min-[440px]:flex-col min-[440px]:justify-normal min-[440px]:gap-1">
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground sm:text-sm min-[440px]:w-full min-[440px]:justify-center">
                    <img src="/Intense_Power_Crystal_(Monthly).png" alt="" className="size-4 shrink-0" />
                    <span className="truncate">本月討伐收益</span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground min-[440px]:w-full min-[440px]:truncate min-[440px]:text-center">
                    ${formatCrystalValue(monthlyTotal)}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
            {dailyBosses.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:justify-normal min-[400px]:gap-[3px] min-[400px]:text-center">
                  <span className="flex min-w-0 items-center gap-[5px]">
                    <span className="size-[7px] shrink-0 rounded-full bg-cycle-daily-foreground" />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      <span className="min-[400px]:hidden">每日BOSS</span>
                      <span className="hidden min-[400px]:inline">每日BOSS討伐進度</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground min-[400px]:text-xs">
                    {dailyDoneBossCount} / {dailyBosses.length}
                  </span>
                </div>
                <Progress
                  value={(dailyDoneBossCount / dailyBosses.length) * 100}
                  className="h-[5px]"
                  indicatorClassName="bg-cycle-daily-foreground"
                  aria-label={`每日BOSS討伐進度 ${dailyDoneBossCount}/${dailyBosses.length}`}
                />
              </div>
            )}
            {weeklyBosses.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:justify-normal min-[400px]:gap-[3px] min-[400px]:text-center">
                  <span className="flex min-w-0 items-center gap-[5px]">
                    <span className="size-[7px] shrink-0 rounded-full bg-cycle-weekly-foreground" />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      <span className="min-[400px]:hidden">每週BOSS</span>
                      <span className="hidden min-[400px]:inline">每週BOSS討伐進度</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground min-[400px]:text-xs">
                    {weeklyDoneBossCount} / {weeklyBosses.length}
                  </span>
                </div>
                <Progress
                  value={(weeklyDoneBossCount / weeklyBosses.length) * 100}
                  className="h-[5px]"
                  indicatorClassName="bg-cycle-weekly-foreground"
                  aria-label={`每週BOSS討伐進度 ${weeklyDoneBossCount}/${weeklyBosses.length}`}
                />
              </div>
            )}
            {monthlyBosses.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:justify-normal min-[400px]:gap-[3px] min-[400px]:text-center">
                  <span className="flex min-w-0 items-center gap-[5px]">
                    <span className="size-[7px] shrink-0 rounded-full bg-cycle-monthly-foreground" />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      <span className="min-[400px]:hidden">每月BOSS</span>
                      <span className="hidden min-[400px]:inline">每月BOSS討伐進度</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground min-[400px]:text-xs">
                    {monthlyDoneBossCount} / {monthlyBosses.length}
                  </span>
                </div>
                <Progress
                  value={(monthlyDoneBossCount / monthlyBosses.length) * 100}
                  className="h-[5px]"
                  indicatorClassName="bg-cycle-monthly-foreground"
                  aria-label={`每月BOSS討伐進度 ${monthlyDoneBossCount}/${monthlyBosses.length}`}
                />
              </div>
            )}
            {seasonBosses.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:justify-normal min-[400px]:gap-[3px] min-[400px]:text-center">
                  <span className="flex min-w-0 items-center gap-[5px]">
                    <span className="size-[7px] shrink-0 rounded-full bg-cycle-season-foreground" />
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      <span className="min-[400px]:hidden">賽季BOSS</span>
                      <span className="hidden min-[400px]:inline">賽季BOSS討伐進度</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground min-[400px]:text-xs">
                    {seasonDoneBossCount} / {seasonBosses.length}
                  </span>
                </div>
                <Progress
                  value={(seasonDoneBossCount / seasonBosses.length) * 100}
                  className="h-[5px]"
                  indicatorClassName="bg-cycle-season-foreground"
                  aria-label={`賽季BOSS討伐進度 ${seasonDoneBossCount}/${seasonBosses.length}`}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
