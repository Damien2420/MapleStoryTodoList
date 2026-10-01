import type { CSSProperties } from 'react';
import { Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { CycleJumpTrigger } from '@/components/CycleJumpTrigger';
import { CycleUrgencyBadge } from '@/components/CycleUrgencyBadge';
import { cn } from '@/lib/utils';
import { useCharacterCycles } from '@/hooks/useCharacterCycles';
import { URGENCY_LABELS } from '@/lib/cycleUrgency';
import { formatCrystalValue } from '@/lib/formatCrystal';
import { listsWithItems, type JumpList } from '@/lib/listJump';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { Character } from '@/types';

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
    <span className="flex min-w-0 items-center gap-2">
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
    </span>
  );
}

/** 單一週期(日/週/月/賽季)的進度小卡:任務+BOSS 兩列固定並存,四張卡結構對稱、高度一致;點擊跳轉到該週期有項目的清單 */
function CycleCard({
  cycle,
  lists,
  onJump,
  label,
  urgentLabel,
  color,
  dotClassName,
  barClassName,
  taskDone,
  taskTotal,
  bossDone,
  bossTotal,
}: {
  cycle: BossCycleKey;
  lists: JumpList[];
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
  label: string;
  urgentLabel?: string;
  /** 週期色,例如 'var(--cycle-weekly-foreground)';用於急迫標籤與 hover/按下的染色 */
  color: string;
  dotClassName: string;
  barClassName: string;
  taskDone?: number;
  taskTotal?: number;
  bossDone?: number;
  bossTotal?: number;
}) {
  const progressText = [
    taskTotal ? `任務 ${taskDone}/${taskTotal}` : '',
    bossTotal ? `BOSS ${bossDone}/${bossTotal}` : '',
  ]
    .filter(Boolean)
    .join(',');

  return (
    // basis 對應 2 欄(手機)/3 欄(桌面)等寬切法,flex-1 讓卡片數量不足整排時自動長大填滿,不會卡在靠左
    <CycleJumpTrigger
      cycle={cycle}
      lists={lists}
      onJump={onJump}
      aria-label={`${label}:${progressText}${urgentLabel ? `,${urgentLabel}` : ''},前往清單`}
      style={{ '--cf': color } as CSSProperties}
      className="flex min-w-36 flex-1 basis-[calc(50%-0.3125rem)] flex-col gap-2 rounded-lg border p-2.5 text-left outline-none [--cycle-jump-base:var(--card)] focus-visible:ring-3 focus-visible:ring-ring/50 lg:basis-[calc(33.3333%-0.41667rem)]"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn('text-xs font-bold', dotClassName)}>{label}</span>
        {urgentLabel && <CycleUrgencyBadge label={urgentLabel} color={color} />}
      </span>
      <CycleRow kind="任務" done={taskDone} total={taskTotal} barClassName={barClassName} />
      <CycleRow kind="BOSS" done={bossDone} total={bossTotal} barClassName={barClassName} />
    </CycleJumpTrigger>
  );
}

/**
 * 角色總覽摘要:依日/週/月/賽季分區顯示任務與 BOSS 討伐進度,下方接續已討伐 BOSS 的結晶收益(只計已勾選),
 * 不帶卡片外框,由 CharacterHeader 併入同一橫帶顯示。點擊週期卡可跳轉到該週期的清單。
 * @param character 目前的角色
 * @param onJump 點擊週期卡要跳轉時呼叫,lists 為要捲動的清單
 * @param className 外層額外的 class
 */
export function DashboardSummary({
  character,
  onJump,
  className,
}: {
  character: Character;
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
  className?: string;
}) {
  const { summary, urgency } = useCharacterCycles(character);
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

  const weeklyUrgent = urgency.weekly;
  const monthlyUrgent = urgency.monthly;
  const seasonUrgent = urgency.season;

  const hasRevenue = dailyHasBoss || weeklyHasBoss || monthlyHasRevenue;

  if (!dailyHasCard && !weeklyHasCard && !monthlyHasCard && !seasonHasCard && !vipHasCard) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
        <Info className="size-3 shrink-0" aria-hidden="true" />
        可點擊下方週期區塊快速跳轉至該週期項目
      </p>
      <div className="flex flex-wrap gap-2.5">
        {dailyHasCard && (
          <CycleCard
            cycle="daily"
            lists={listsWithItems(daily)}
            onJump={onJump}
            label="每日"
            color="var(--cycle-daily-foreground)"
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
            cycle="weekly"
            lists={listsWithItems(weekly)}
            onJump={onJump}
            label="每週"
            urgentLabel={weeklyUrgent ? URGENCY_LABELS.weekly : undefined}
            color="var(--cycle-weekly-foreground)"
            dotClassName="text-cycle-weekly-foreground"
            barClassName="bg-cycle-weekly-foreground"
            taskDone={weekly.taskDone}
            taskTotal={weekly.taskTotal}
            bossDone={weekly.bossDone}
            bossTotal={weekly.bossTotal}
          />
        )}
        {monthlyHasCard && (
          <CycleCard
            cycle="monthly"
            lists={listsWithItems(monthly)}
            onJump={onJump}
            label="每月"
            urgentLabel={monthlyUrgent ? URGENCY_LABELS.monthly : undefined}
            color="var(--cycle-monthly-foreground)"
            dotClassName="text-cycle-monthly-foreground"
            barClassName="bg-cycle-monthly-foreground"
            taskDone={monthly.taskDone}
            taskTotal={monthly.taskTotal}
            bossDone={monthly.bossDone}
            bossTotal={monthly.bossTotal}
          />
        )}
        {seasonHasCard && (
          <CycleCard
            cycle="season"
            lists={listsWithItems(season)}
            onJump={onJump}
            label="賽季"
            urgentLabel={seasonUrgent ? URGENCY_LABELS.season : undefined}
            color="var(--cycle-season-foreground)"
            dotClassName="text-cycle-season-foreground"
            barClassName="bg-cycle-season-foreground"
            taskDone={season.taskDone}
            taskTotal={season.taskTotal}
            bossDone={season.bossDone}
            bossTotal={season.bossTotal}
          />
        )}
        {vipHasCard && (
          <CycleCard
            cycle="vip"
            lists={listsWithItems(vip)}
            onJump={onJump}
            label="VIP重置"
            color="var(--cycle-vip-foreground)"
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
