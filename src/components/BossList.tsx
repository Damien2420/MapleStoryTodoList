import { useMemo } from 'react';
import { ChevronDown, Swords } from 'lucide-react';
import { BossItem } from '@/components/BossItem';
import { AddBossDialog } from '@/components/AddBossDialog';
import { StatusFilterControl } from '@/components/StatusFilterControl';
import { Badge } from '@/components/ui/badge';
import { useBossStore } from '@/store/useBossStore';
import { useListFilterStore, type BossCycleKey } from '@/store/useListFilterStore';
import { filterItemsByStatus } from '@/lib/listFilter';
import { findBossCatalogEntry, isCatalogEntryExpired } from '@/lib/bossCatalog';
import { CYCLE_BADGE_CLASSES } from '@/lib/cycleBadge';
import { cn } from '@/lib/utils';
import type { Character, CharacterBossTrackList } from '@/types';

/** BOSS 討伐記錄對應的目錄項目是否已下架(沒有 bossCatalogId 視為未下架) */
function isBossExpired(boss: { bossCatalogId?: string }): boolean {
  if (!boss.bossCatalogId) return false;
  const entry = findBossCatalogEntry(boss.bossCatalogId);
  return entry ? isCatalogEntryExpired(entry) : false;
}

interface BossSectionProps {
  cycleKey: BossCycleKey;
  label: '每日' | '每週' | '每月' | '賽季';
  bosses: CharacterBossTrackList[];
  collapsed: boolean;
  onToggle: (cycle: BossCycleKey) => void;
}

/** 單一週期(每日/每週/每月/賽季)的 BOSS 區塊,標題可收合 */
function BossSection({ cycleKey, label, bosses, collapsed, onToggle }: BossSectionProps) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `展開${label}區塊` : `收合${label}區塊`}
          className="flex size-5 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onToggle(cycleKey)}
        >
          <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />
        </button>
        <Badge variant="secondary" className={CYCLE_BADGE_CLASSES[label]}>
          {label}
        </Badge>
      </h3>
      {!collapsed && (
        <div className="flex flex-col divide-y divide-border">
          {bosses.map((boss) => (
            <BossItem key={boss.id} boss={boss} />
          ))}
        </div>
      )}
    </section>
  );
}

/** BOSS 清單:顯示目前角色綁定的 BOSS 討伐項目,並提供每日/每週預估收益總覽 */
export function BossList({ character }: { character: Character }) {
  const allBosses = useBossStore((s) => s.bosses);
  const bossStatusFilter = useListFilterStore((s) => s.bossStatusFilter);
  const collapsedBossSections = useListFilterStore((s) => s.collapsedBossSections);
  const setBossStatusFilter = useListFilterStore((s) => s.setBossStatusFilter);
  const toggleBossSection = useListFilterStore((s) => s.toggleBossSection);

  const bosses = useMemo(
    () =>
      allBosses
        .filter((b) => b.characterId === character.id && !isBossExpired(b))
        .sort((a, b) => a.order - b.order),
    [allBosses, character.id],
  );

  // 完成狀態篩選只影響顯示;週期歸類維持既有邏輯(每週排除賽季、賽季獨立分組)
  const visibleBosses = useMemo(() => filterItemsByStatus(bosses, bossStatusFilter), [bosses, bossStatusFilter]);
  const dailyBosses = useMemo(() => visibleBosses.filter((b) => b.resetCycle === 'daily'), [visibleBosses]);
  const weeklyBosses = useMemo(
    () => visibleBosses.filter((b) => b.resetCycle === 'weekly' && b.category !== 'season'),
    [visibleBosses],
  );
  const monthlyBosses = useMemo(() => visibleBosses.filter((b) => b.resetCycle === 'monthly'), [visibleBosses]);
  const seasonBosses = useMemo(() => visibleBosses.filter((b) => b.category === 'season'), [visibleBosses]);

  const sections: Omit<BossSectionProps, 'collapsed' | 'onToggle'>[] = [
    { cycleKey: 'daily', label: '每日', bosses: dailyBosses },
    { cycleKey: 'weekly', label: '每週', bosses: weeklyBosses },
    { cycleKey: 'monthly', label: '每月', bosses: monthlyBosses },
    { cycleKey: 'season', label: '賽季', bosses: seasonBosses },
  ];
  const visibleSections = sections.filter((s) => s.bosses.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {bosses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Swords className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{character.name} 還沒有追蹤中的 BOSS</p>
            <p className="text-sm text-muted-foreground">套用常見週/日 BOSS,開始追蹤討伐進度</p>
          </div>
          <AddBossDialog characterId={character.id} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">BOSS 清單</p>
            <StatusFilterControl value={bossStatusFilter} onChange={setBossStatusFilter} />
            <AddBossDialog characterId={character.id} />
          </div>

          {visibleSections.map((section) => (
            <BossSection
              key={section.cycleKey}
              {...section}
              collapsed={collapsedBossSections.has(section.cycleKey)}
              onToggle={toggleBossSection}
            />
          ))}

          {visibleSections.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">沒有符合篩選條件的 BOSS</p>
          )}
        </div>
      )}
    </div>
  );
}
