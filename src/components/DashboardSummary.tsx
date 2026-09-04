import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useNow } from '@/hooks/useNow';
import { isPresetExpired } from '@/lib/presetTasks';
import { findBossCatalogEntry, getEffectiveCrystalValue, isCatalogEntryExpired } from '@/lib/bossCatalog';
import { formatCrystalValue } from '@/lib/formatCrystal';
import { hoursUntilExpiry } from '@/lib/reset';
import type { Character, CharacterTask } from '@/types';

/** 賽季卡的急迫感門檻,沿用 TaskItem 既有的 expiringSoon(<24小時)慣例 */
const EXPIRY_IMMINENT_HOURS = 24;

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

/** 週期卡片內的單一列(任務或BOSS進度);該週期不適用該類型時(如賽季沒有任務)顯示「—」佔位,維持卡片列數一致 */
function CycleRow({
  kind,
  done,
  total,
  barClassName,
}: {
  kind: string;
  done?: number;
  total?: number;
  barClassName: string;
}) {
  const applicable = total !== undefined && total > 0;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-9 shrink-0 text-[11px] font-semibold text-muted-foreground">{kind}</span>
      {applicable ? (
        <>
          <Progress
            value={(done! / total!) * 100}
            className="h-1.5"
            indicatorClassName={barClassName}
            aria-label={`${kind} ${done}/${total}`}
          />
          <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-foreground">
            {done}/{total}
          </span>
        </>
      ) : (
        <span className="flex-1 text-[11px] text-muted-foreground/50">此週期無此類項目</span>
      )}
    </div>
  );
}

/** 單一週期(日/週/月/賽季)的進度小卡:任務+BOSS 兩列固定並存,四張卡結構對稱、高度一致 */
function CycleCard({
  label,
  urgentLabel,
  dotClassName,
  badgeClassName,
  barClassName,
  taskDone,
  taskTotal,
  bossDone,
  bossTotal,
}: {
  label: string;
  urgentLabel?: string;
  dotClassName: string;
  badgeClassName?: string;
  barClassName: string;
  taskDone?: number;
  taskTotal?: number;
  bossDone?: number;
  bossTotal?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-xs font-bold', dotClassName)}>{label}</span>
        {urgentLabel && (
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', badgeClassName)}>
            {urgentLabel}
          </span>
        )}
      </div>
      <CycleRow kind="任務" done={taskDone} total={taskTotal} barClassName={barClassName} />
      <CycleRow kind="BOSS" done={bossDone} total={bossTotal} barClassName={barClassName} />
    </div>
  );
}

/** 角色總覽摘要:依日/週/月/賽季分區顯示任務與 BOSS 討伐進度,下方接續已討伐 BOSS 的結晶收益(只計已勾選),不帶卡片外框,由 CharacterHeader 併入同一橫帶顯示 */
export function DashboardSummary({ character, className }: { character: Character; className?: string }) {
  const allTasks = useTaskStore((s) => s.tasks);
  const allBosses = useBossStore((s) => s.bosses);
  const settings = useSettingsStore((s) => s.settings);
  const now = useNow();

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
  const monthlyTasks = useMemo(() => tasks.filter((t) => t.resetCycle === 'monthly'), [tasks]);
  const dailyDoneCount = useMemo(() => dailyTasks.filter((t) => t.checked).length, [dailyTasks]);
  const weeklyDoneCount = useMemo(() => weeklyTasks.filter((t) => t.checked).length, [weeklyTasks]);
  const monthlyDoneCount = useMemo(() => monthlyTasks.filter((t) => t.checked).length, [monthlyTasks]);

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

  const dailyHasTask = dailyTasks.length > 0;
  const dailyHasBoss = dailyBosses.length > 0;
  const weeklyHasTask = weeklyTasks.length > 0;
  const weeklyHasBoss = weeklyBosses.length > 0;
  const monthlyHasTask = monthlyTasks.length > 0;
  const monthlyHasBoss = monthlyBosses.length > 0;
  const seasonHasBoss = seasonBosses.length > 0;

  const dailyHasCard = dailyHasTask || dailyHasBoss;
  const weeklyHasCard = weeklyHasTask || weeklyHasBoss;
  const monthlyHasCard = monthlyHasTask || monthlyHasBoss;
  const seasonHasCard = seasonHasBoss;

  // 每日一定在當天結束前重置,永遠顯示急迫感標籤沒有意義,不提供;週/月改用「今天是不是重置日」判斷
  // (重置時間固定 00:00,直接比對星期幾/日期即可;賽季改用「距離賽季實際截止日期」判斷,沿用 TaskItem 既有的 expiringSoon 慣例)
  const weeklyAllDone =
    (!weeklyHasTask || weeklyDoneCount === weeklyTasks.length) &&
    (!weeklyHasBoss || weeklyDoneBossCount === weeklyBosses.length);
  const weeklyUrgent = weeklyHasCard && !weeklyAllDone && now.getDay() === settings.weeklyResetDay;

  const monthlyAllDone =
    (!monthlyHasTask || monthlyDoneCount === monthlyTasks.length) &&
    (!monthlyHasBoss || monthlyDoneBossCount === monthlyBosses.length);
  const monthlyUrgent = monthlyHasCard && !monthlyAllDone && now.getDate() === 1;

  // 賽季沒有固定重置時間,改抓角色追蹤中的賽季 BOSS 目錄項目裡最早的截止日期
  const seasonExpiresAt = useMemo(() => {
    const dates = seasonBosses
      .map((b) => (b.bossCatalogId ? findBossCatalogEntry(b.bossCatalogId)?.expiresAt : undefined))
      .filter((d): d is string => !!d);
    return dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min)) : undefined;
  }, [seasonBosses]);
  const seasonAllDone = seasonDoneBossCount === seasonBosses.length;
  const seasonUrgent =
    seasonHasCard &&
    !seasonAllDone &&
    seasonExpiresAt !== undefined &&
    hoursUntilExpiry(seasonExpiresAt, now) < EXPIRY_IMMINENT_HOURS;

  const hasRevenue = dailyHasBoss || weeklyHasBoss || monthlyHasBoss;

  if (!dailyHasCard && !weeklyHasCard && !monthlyHasCard && !seasonHasCard) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {dailyHasCard && (
          <CycleCard
            label="每日"
            dotClassName="text-cycle-daily-foreground"
            barClassName="bg-cycle-daily-foreground"
            taskDone={dailyHasTask ? dailyDoneCount : undefined}
            taskTotal={dailyHasTask ? dailyTasks.length : undefined}
            bossDone={dailyHasBoss ? dailyDoneBossCount : undefined}
            bossTotal={dailyHasBoss ? dailyBosses.length : undefined}
          />
        )}
        {weeklyHasCard && (
          <CycleCard
            label="每週"
            urgentLabel={weeklyUrgent ? '今日刷新' : undefined}
            dotClassName="text-cycle-weekly-foreground"
            badgeClassName="bg-cycle-weekly text-cycle-weekly-foreground"
            barClassName="bg-cycle-weekly-foreground"
            taskDone={weeklyHasTask ? weeklyDoneCount : undefined}
            taskTotal={weeklyHasTask ? weeklyTasks.length : undefined}
            bossDone={weeklyHasBoss ? weeklyDoneBossCount : undefined}
            bossTotal={weeklyHasBoss ? weeklyBosses.length : undefined}
          />
        )}
        {monthlyHasCard && (
          <CycleCard
            label="每月"
            urgentLabel={monthlyUrgent ? '今日刷新' : undefined}
            dotClassName="text-cycle-monthly-foreground"
            badgeClassName="bg-cycle-monthly text-cycle-monthly-foreground"
            barClassName="bg-cycle-monthly-foreground"
            taskDone={monthlyHasTask ? monthlyDoneCount : undefined}
            taskTotal={monthlyHasTask ? monthlyTasks.length : undefined}
            bossDone={monthlyHasBoss ? monthlyDoneBossCount : undefined}
            bossTotal={monthlyHasBoss ? monthlyBosses.length : undefined}
          />
        )}
        {seasonHasCard && (
          <CycleCard
            label="賽季"
            urgentLabel={seasonUrgent ? '即將截止' : undefined}
            dotClassName="text-cycle-season-foreground"
            badgeClassName="bg-cycle-season text-cycle-season-foreground"
            barClassName="bg-cycle-season-foreground"
            bossDone={seasonDoneBossCount}
            bossTotal={seasonBosses.length}
          />
        )}
      </div>

      {hasRevenue && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          {dailyHasBoss && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                <img src="/Intense_Power_Crystal_(Daily).png" alt="" className="size-3.5 shrink-0" />
                <span className="truncate">本日討伐收益</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                ${formatCrystalValue(dailyTotal)}
              </span>
            </div>
          )}
          {weeklyHasBoss && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                <img src="/Intense_Power_Crystal_(Weekly).png" alt="" className="size-3.5 shrink-0" />
                <span className="truncate">本週討伐收益</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                ${formatCrystalValue(weeklyTotal)}
              </span>
            </div>
          )}
          {monthlyHasBoss && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                <img src="/Intense_Power_Crystal_(Monthly).png" alt="" className="size-3.5 shrink-0" />
                <span className="truncate">本月討伐收益</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                ${formatCrystalValue(monthlyTotal)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
