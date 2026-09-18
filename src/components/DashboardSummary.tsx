import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useNow } from '@/hooks/useNow';
import { summarizeCharacterCycles } from '@/lib/characterSummary';
import { findBossCatalogEntry, isBossExpired } from '@/lib/bossCatalog';
import { formatCrystalValue } from '@/lib/formatCrystal';
import { hoursUntilExpiry } from '@/lib/reset';
import type { Character } from '@/types';

/** 賽季卡的急迫感門檻,沿用 TaskItem 既有的 expiringSoon(<24小時)慣例 */
const EXPIRY_IMMINENT_HOURS = 24;

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
        <span className="flex-1 text-[11px] text-muted-foreground">此週期無此類項目</span>
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
    // basis 對應 2 欄(手機)/3 欄(桌面)等寬切法,flex-1 讓卡片數量不足整排時自動長大填滿,不會卡在靠左
    <div className="flex min-w-36 flex-1 basis-[calc(50%-0.3125rem)] flex-col gap-2 rounded-lg border border-border bg-card p-2.5 lg:basis-[calc(33.3333%-0.41667rem)]">
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

  const tasks = useMemo(() => allTasks.filter((t) => t.characterId === character.id), [allTasks, character.id]);
  const bosses = useMemo(() => allBosses.filter((b) => b.characterId === character.id), [allBosses, character.id]);

  const summary = useMemo(() => summarizeCharacterCycles(tasks, bosses, now), [tasks, bosses, now]);
  const { daily, weekly, monthly, season, vip } = summary;

  const dailyHasTask = daily.taskTotal > 0;
  const dailyHasBoss = daily.bossTotal > 0;
  const weeklyHasTask = weekly.taskTotal > 0;
  const weeklyHasBoss = weekly.bossTotal > 0;
  const monthlyHasTask = monthly.taskTotal > 0;
  const monthlyHasBoss = monthly.bossTotal > 0;
  const seasonHasTask = season.taskTotal > 0;
  const seasonHasBoss = season.bossTotal > 0;
  const vipHasBoss = vip.bossTotal > 0;
  // 本月討伐收益行是否顯示:一般月王或VIP每月重置王任一有追蹤即顯示(兩者收益已併計)
  const monthlyHasRevenue = monthly.revenue !== undefined;

  const dailyHasCard = dailyHasTask || dailyHasBoss;
  const weeklyHasCard = weeklyHasTask || weeklyHasBoss;
  const monthlyHasCard = monthlyHasTask || monthlyHasBoss;
  const seasonHasCard = seasonHasTask || seasonHasBoss;
  const vipHasCard = vipHasBoss;

  // 每日一定在當天結束前重置,永遠顯示急迫感標籤沒有意義,不提供;週/月改用「今天是不是重置日」判斷
  // (重置時間固定 00:00,直接比對星期幾/日期即可;賽季改用「距離賽季實際截止日期」判斷,沿用 TaskItem 既有的 expiringSoon 慣例)
  const weeklyAllDone = weekly.taskDone === weekly.taskTotal && weekly.bossDone === weekly.bossTotal;
  const weeklyUrgent = weeklyHasCard && !weeklyAllDone && now.getDay() === settings.weeklyResetDay;

  const monthlyAllDone = monthly.taskDone === monthly.taskTotal && monthly.bossDone === monthly.bossTotal;
  const monthlyUrgent = monthlyHasCard && !monthlyAllDone && now.getDate() === 1;

  // 賽季沒有固定重置時間,改抓角色追蹤中「未下架」的賽季 BOSS 目錄項目裡最早的截止日期;
  // 過期的賽季王不能排除在外,否則取最小日期會拿到過去的日期,讓急迫標籤誤亮
  const seasonExpiresAt = useMemo(() => {
    const activeSeasonBosses = bosses.filter((b) => b.category === 'season' && !isBossExpired(b, now));
    const dates = activeSeasonBosses
      .map((b) => (b.bossCatalogId ? findBossCatalogEntry(b.bossCatalogId)?.expiresAt : undefined))
      .filter((d): d is string => !!d);
    return dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min)) : undefined;
  }, [bosses, now]);
  const seasonAllDone = season.taskDone === season.taskTotal && season.bossDone === season.bossTotal;
  const seasonUrgent =
    seasonHasCard &&
    !seasonAllDone &&
    seasonExpiresAt !== undefined &&
    hoursUntilExpiry(seasonExpiresAt, now) < EXPIRY_IMMINENT_HOURS;

  const hasRevenue = dailyHasBoss || weeklyHasBoss || monthlyHasRevenue;

  if (!dailyHasCard && !weeklyHasCard && !monthlyHasCard && !seasonHasCard && !vipHasCard) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2.5">
        {dailyHasCard && (
          <CycleCard
            label="每日"
            dotClassName="text-cycle-daily-foreground"
            barClassName="bg-cycle-daily-foreground"
            taskDone={daily.taskDone}
            taskTotal={daily.taskTotal}
            bossDone={daily.bossDone}
            bossTotal={daily.bossTotal}
          />
        )}
        {weeklyHasCard && (
          <CycleCard
            label="每週"
            urgentLabel={weeklyUrgent ? '今日刷新' : undefined}
            dotClassName="text-cycle-weekly-foreground"
            badgeClassName="bg-cycle-weekly text-cycle-weekly-foreground"
            barClassName="bg-cycle-weekly-foreground"
            taskDone={weekly.taskDone}
            taskTotal={weekly.taskTotal}
            bossDone={weekly.bossDone}
            bossTotal={weekly.bossTotal}
          />
        )}
        {monthlyHasCard && (
          <CycleCard
            label="每月"
            urgentLabel={monthlyUrgent ? '今日刷新' : undefined}
            dotClassName="text-cycle-monthly-foreground"
            badgeClassName="bg-cycle-monthly text-cycle-monthly-foreground"
            barClassName="bg-cycle-monthly-foreground"
            taskDone={monthly.taskDone}
            taskTotal={monthly.taskTotal}
            bossDone={monthly.bossDone}
            bossTotal={monthly.bossTotal}
          />
        )}
        {seasonHasCard && (
          <CycleCard
            label="賽季"
            urgentLabel={seasonUrgent ? '即將截止' : undefined}
            dotClassName="text-cycle-season-foreground"
            badgeClassName="bg-cycle-season text-cycle-season-foreground"
            barClassName="bg-cycle-season-foreground"
            taskDone={season.taskDone}
            taskTotal={season.taskTotal}
            bossDone={season.bossDone}
            bossTotal={season.bossTotal}
          />
        )}
        {vipHasCard && (
          <CycleCard
            label="VIP重置"
            dotClassName="text-cycle-vip-foreground"
            barClassName="bg-cycle-vip-foreground"
            bossDone={vip.bossDone}
            bossTotal={vip.bossTotal}
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
                ${formatCrystalValue(daily.revenue!)}
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
                ${formatCrystalValue(weekly.revenue!)}
              </span>
            </div>
          )}
          {monthlyHasRevenue && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                <img src="/Intense_Power_Crystal_(Monthly).png" alt="" className="size-3.5 shrink-0" />
                <span className="truncate">本月討伐收益</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                ${formatCrystalValue(monthly.revenue!)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
