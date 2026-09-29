import { ChevronDown } from 'lucide-react';
import { BossItem } from '@/components/BossItem';
import { WeeklyRevenueCapHint } from '@/components/WeeklyRevenueCapHint';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BossCycleKey } from '@/store/useListFilterStore';
import { CYCLE_BADGE_CLASSES } from '@/lib/cycleBadge';
import { isWeeklyRevenueExcluded, WEEKLY_BOSS_LIMIT } from '@/lib/bossCatalog';
import { VIP_TICKET_LEVEL_LABELS, VIP_TICKET_LEVELS } from '@/lib/vipBossCatalog';
import { cn } from '@/lib/utils';
import type { CharacterBossTrackList, VipTicketLevel } from '@/types';

interface VipBossSectionProps {
  /** 所屬帳號各券等級的配額(VIP 屬於帳號,配額由帳號內所有角色共用) */
  allocation: Record<VipTicketLevel, number>;
  /** 整個帳號(所有角色合計)各券等級已使用的張數 */
  usedByLevel: Record<VipTicketLevel, number>;
  /** 套用完成狀態篩選後、實際要渲染的VIP BOSS */
  vipBosses: CharacterBossTrackList[];
  /** 未套用篩選的完整VIP BOSS清單,全部完成按鈕與各券等級計數以此為準 */
  vipBossesAll: CharacterBossTrackList[];
  /** 計入本週收益上限的 BOSS id 集合(一般週王+VIP週重置王合併排名),VIP每月券的王不受此影響 */
  weeklyRevenueCountedIds: Set<string>;
  collapsed: boolean;
  onToggle: (cycle: BossCycleKey) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

/** VIP重置BOSS區塊:結構比照 BossSection(可收合、全部完成按鈕),但依券等級分組,永遠顯示在清單最上方 */
export function VipBossSection({
  allocation,
  usedByLevel,
  vipBosses,
  vipBossesAll,
  weeklyRevenueCountedIds,
  collapsed,
  onToggle,
  onToggleAll,
}: VipBossSectionProps) {
  const allDone = vipBossesAll.length > 0 && vipBossesAll.every((b) => b.checked);

  const groups = VIP_TICKET_LEVELS.map((level) => ({
    level,
    cap: allocation[level],
    all: vipBossesAll.filter((b) => b.vipTicketLevel === level),
    visible: vipBosses.filter((b) => b.vipTicketLevel === level),
  })).filter((group) => group.all.length > 0);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? '展開VIP重置區塊' : '收合VIP重置區塊'}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => onToggle('vip')}
          >
            <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />
          </button>
          <Badge variant="secondary" className={cn('shrink-0', CYCLE_BADGE_CLASSES['VIP重置'])}>
            VIP重置
          </Badge>
          {/* 用緊湊的計數徽章取代整句提示,才不會在窄容器跟標題、按鈕搶版面而被迫換行 */}
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            週王上限 {weeklyRevenueCountedIds.size}/{WEEKLY_BOSS_LIMIT}
          </span>
        </h3>
        {vipBossesAll.length >= 2 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => onToggleAll(vipBossesAll.map((b) => b.id), !allDone)}
          >
            {allDone ? '取消全部' : '全部完成'}
          </Button>
        )}
      </div>
      {!collapsed && (
        <>
          <WeeklyRevenueCapHint />
          <div className="flex flex-col gap-3">
            {groups.map(({ level, cap, visible }) => (
              <div key={level} className="flex flex-col gap-1">
                <p className="px-1 text-xs font-semibold text-vip-accent-text">
                  {VIP_TICKET_LEVEL_LABELS[level]} (帳號共用 {usedByLevel[level]}/{cap})
                </p>
                <div className="flex flex-col divide-y divide-border">
                  {visible.map((boss) => (
                    <BossItem
                      key={boss.id}
                      boss={boss}
                      hideRevenue={isWeeklyRevenueExcluded(boss, weeklyRevenueCountedIds)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
