import { useMemo } from 'react';
import { ChevronDown, Swords } from 'lucide-react';
import { BossItem } from '@/components/BossItem';
import { AddBossDialog } from '@/components/AddBossDialog';
import { VipBossSection } from '@/components/VipBossSection';
import { WeeklyRevenueCapHint } from '@/components/WeeklyRevenueCapHint';
import { StatusFilterControl } from '@/components/StatusFilterControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBossStore } from '@/store/useBossStore';
import { useListFilterStore, type BossCycleKey } from '@/store/useListFilterStore';
import { filterItemsByStatus } from '@/lib/listFilter';
import {
  getWeeklyRevenueCountedIds,
  isBossExpired,
  isWeeklyRevenueExcluded,
  sortTrackedBossesByCatalogOrder,
  WEEKLY_BOSS_LIMIT,
} from '@/lib/bossCatalog';
import { CYCLE_BADGE_CLASSES } from '@/lib/cycleBadge';
import { cn } from '@/lib/utils';
import type { Character, CharacterBossTrackList } from '@/types';

interface BossSectionProps {
  cycleKey: BossCycleKey;
  label: '每日' | '每週' | '每月' | '賽季';
  /** 套用完成狀態篩選後、實際要渲染的 BOSS */
  bosses: CharacterBossTrackList[];
  /** 該週期區塊未套用篩選的完整 BOSS 清單,全部完成按鈕的顯示/切換以此為準 */
  allBosses: CharacterBossTrackList[];
  /** 計入本週收益上限的 BOSS id 集合(含一般週王+VIP週重置王合併排名後的前 WEEKLY_BOSS_LIMIT 名),非每週區塊傳入也不影響顯示 */
  weeklyRevenueCountedIds: Set<string>;
  collapsed: boolean;
  onToggle: (cycle: BossCycleKey) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

/** 單一週期(每日/每週/每月/賽季)的 BOSS 區塊,標題可收合;BOSS 數 >= 2 時提供全部完成按鈕 */
function BossSection({
  cycleKey,
  label,
  bosses,
  allBosses,
  weeklyRevenueCountedIds,
  collapsed,
  onToggle,
  onToggleAll,
}: BossSectionProps) {
  const allDone = allBosses.length > 0 && allBosses.every((b) => b.checked);

  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `展開${label}區塊` : `收合${label}區塊`}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => onToggle(cycleKey)}
          >
            <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />
          </button>
          <Badge variant="secondary" className={cn('shrink-0', CYCLE_BADGE_CLASSES[label])}>
            {label}
          </Badge>
          {/* 用緊湊的計數徽章取代整句提示,才不會在窄容器跟標題、按鈕搶版面而被迫換行 */}
          {cycleKey === 'weekly' && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              週王上限 {weeklyRevenueCountedIds.size}/{WEEKLY_BOSS_LIMIT}
            </span>
          )}
        </h3>
        {allBosses.length >= 2 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => onToggleAll(allBosses.map((b) => b.id), !allDone)}
          >
            {allDone ? '取消全部' : '全部完成'}
          </Button>
        )}
      </div>
      
      {!collapsed && (
        <>
          {cycleKey === 'weekly' && <WeeklyRevenueCapHint />}
          <div className="flex flex-col divide-y divide-border">
            {bosses.map((boss) => (
              <BossItem
                key={boss.id}
                boss={boss}
                hideRevenue={isWeeklyRevenueExcluded(boss, weeklyRevenueCountedIds)}
              />
            ))}
          </div>
        </>
        
      )}
    </section>
  );
}

/** BOSS 清單:顯示目前角色綁定的 BOSS 討伐項目,並提供每日/每週預估收益總覽 */
export function BossList({ character }: { character: Character }) {
  const allBosses = useBossStore((s) => s.bosses);
  const toggleBossesByIds = useBossStore((s) => s.toggleBossesByIds);
  const bossStatusFilter = useListFilterStore((s) => s.bossStatusFilter);
  const collapsedBossSections = useListFilterStore((s) => s.collapsedBossSections);
  const setBossStatusFilter = useListFilterStore((s) => s.setBossStatusFilter);
  const toggleBossSection = useListFilterStore((s) => s.toggleBossSection);

  const bosses = useMemo(
    () => sortTrackedBossesByCatalogOrder(allBosses.filter((b) => b.characterId === character.id && !isBossExpired(b))),
    [allBosses, character.id],
  );

  // 完成狀態篩選只影響顯示;週期歸類與「全部完成」按鈕永遠以未篩選的完整清單為準
  const visibleBosses = useMemo(() => filterItemsByStatus(bosses, bossStatusFilter), [bosses, bossStatusFilter]);

  const dailyBossesAll = useMemo(() => bosses.filter((b) => b.resetCycle === 'daily'), [bosses]);
  const weeklyBossesAll = useMemo(
    () => bosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season' && b.category !== 'vip'),
    [bosses],
  );
  const monthlyBossesAll = useMemo(
    () => bosses.filter((b) => b.resetCycle === 'monthly' && b.category !== 'vip'),
    [bosses],
  );
  const seasonBossesAll = useMemo(() => bosses.filter((b) => b.category === 'season'), [bosses]);
  const vipBossesAll = useMemo(() => bosses.filter((b) => b.category === 'vip'), [bosses]);
  // 每週收益上限一律以未套用完成狀態篩選的完整清單計算,不受目前「未完成/已完成」篩選顯示影響
  const vipWeeklyBossesAll = useMemo(() => vipBossesAll.filter((b) => b.resetCycle === 'weekly'), [vipBossesAll]);
  const weeklyRevenueCountedIds = useMemo(
    () => getWeeklyRevenueCountedIds([...weeklyBossesAll, ...vipWeeklyBossesAll]),
    [weeklyBossesAll, vipWeeklyBossesAll],
  );

  const dailyBosses = useMemo(() => visibleBosses.filter((b) => b.resetCycle === 'daily'), [visibleBosses]);
  const weeklyBosses = useMemo(
    () => visibleBosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season' && b.category !== 'vip'),
    [visibleBosses],
  );
  const monthlyBosses = useMemo(
    () => visibleBosses.filter((b) => b.resetCycle === 'monthly' && b.category !== 'vip'),
    [visibleBosses],
  );
  const seasonBosses = useMemo(() => visibleBosses.filter((b) => b.category === 'season'), [visibleBosses]);
  const vipBosses = useMemo(() => visibleBosses.filter((b) => b.category === 'vip'), [visibleBosses]);

  const sections: Omit<BossSectionProps, 'collapsed' | 'onToggle' | 'onToggleAll'>[] = [
    { cycleKey: 'daily', label: '每日', bosses: dailyBosses, allBosses: dailyBossesAll, weeklyRevenueCountedIds },
    { cycleKey: 'weekly', label: '每週', bosses: weeklyBosses, allBosses: weeklyBossesAll, weeklyRevenueCountedIds },
    { cycleKey: 'monthly', label: '每月', bosses: monthlyBosses, allBosses: monthlyBossesAll, weeklyRevenueCountedIds },
    { cycleKey: 'season', label: '賽季', bosses: seasonBosses, allBosses: seasonBossesAll, weeklyRevenueCountedIds },
  ];
  const visibleSections = sections.filter((s) => s.bosses.length > 0);

  return (
    <div className="@container flex flex-col gap-6">
      {bosses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Swords className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{character.name} 還沒有追蹤中的 BOSS</p>
            <p className="text-sm text-muted-foreground">加入 BOSS 至列表中，開始追蹤你的討伐進度</p>
          </div>
          <AddBossDialog characterId={character.id} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:max-h-[calc(100vh-200px)]">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-background pt-[10px] pb-1">
            <p className="text-sm font-semibold text-foreground">BOSS 清單</p>
            <StatusFilterControl value={bossStatusFilter} onChange={setBossStatusFilter} />
            <AddBossDialog characterId={character.id} />
          </div>

          <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {vipBosses.length > 0 && (
              <VipBossSection
                character={character}
                vipBosses={vipBosses}
                vipBossesAll={vipBossesAll}
                weeklyRevenueCountedIds={weeklyRevenueCountedIds}
                collapsed={collapsedBossSections.has('vip')}
                onToggle={toggleBossSection}
                onToggleAll={toggleBossesByIds}
              />
            )}

            {visibleSections.map((section) => (
              <BossSection
                key={section.cycleKey}
                {...section}
                collapsed={collapsedBossSections.has(section.cycleKey)}
                onToggle={toggleBossSection}
                onToggleAll={toggleBossesByIds}
              />
            ))}

            {visibleSections.length === 0 && vipBosses.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">沒有符合篩選條件的 BOSS</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
