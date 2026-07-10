import { cn } from '@/lib/utils';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { BOSS_CATALOG, isCatalogEntryExpired, type BossCatalogEntry, type BossDifficultyOption } from '@/lib/bossCatalog';
import type { BossDifficulty } from '@/types';

interface BossCatalogPickerProps {
  /** 目前已選取的 BOSS id -> 已選難度集合 對應表 */
  selections: Map<string, Set<BossDifficulty>>;
  onToggleDifficulty: (bossId: string, difficulty: BossDifficulty) => void;
}

/** 分類顯示順序與標籤:每日 -> 每週 -> 每月 -> 賽季 */
const CATEGORY_LABELS = ['每日', '每週', '每月', '賽季'] as const;

interface GroupedBossRow {
  entry: BossCatalogEntry;
  /** 只包含屬於這個分類區塊的難度 */
  options: BossDifficultyOption[];
}

function sectionLabel(entry: BossCatalogEntry, option: BossDifficultyOption): (typeof CATEGORY_LABELS)[number] {
  if (entry.category === 'season') return '賽季';
  return option.resetCycle === 'daily' ? '每日' : option.resetCycle === 'weekly' ? '每週' : '每月';
}

/** 依「難度所屬週期」分組:同一隻王若難度橫跨多個週期,會在涵蓋到的每個區塊各出現一次,只列出該區塊的難度 */
function buildGroupedBossCatalog(): [string, GroupedBossRow[]][] {
  const map = new Map<string, GroupedBossRow[]>();
  for (const label of CATEGORY_LABELS) map.set(label, []);
  for (const entry of BOSS_CATALOG) {
    if (isCatalogEntryExpired(entry)) continue;
    const bySection = new Map<string, BossDifficultyOption[]>();
    for (const option of entry.difficulties) {
      const label = sectionLabel(entry, option);
      const options = bySection.get(label) ?? [];
      options.push(option);
      bySection.set(label, options);
    }
    for (const [label, options] of bySection) {
      map.get(label)!.push({ entry, options });
    }
  }
  return Array.from(map.entries()).filter(([, rows]) => rows.length > 0);
}

const GROUPED_BOSS_CATALOG = buildGroupedBossCatalog();

/** BOSS 名單勾選清單:依每日/每週/每月/賽季分類顯示,難度按鈕本身即勾選開關,可跨難度多選 */
export function BossCatalogPicker({ selections, onToggleDifficulty }: BossCatalogPickerProps) {
  return (
    <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
      {GROUPED_BOSS_CATALOG.map(([label, rows]) => (
        <div key={label} className="flex flex-col gap-2">
          <Marker variant="separator">
            <MarkerContent>{label}</MarkerContent>
          </Marker>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows.map(({ entry, options }) => {
              const selectedDifficulties = selections.get(entry.id);
              const hasSelection = (selectedDifficulties?.size ?? 0) > 0;
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
                    hasSelection ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="shrink-0 text-sm font-medium">{entry.name}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {options.map((option) => {
                      const active = selectedDifficulties?.has(option.difficulty) ?? false;
                      return (
                        <button
                          key={option.difficulty}
                          type="button"
                          onClick={() => onToggleDifficulty(entry.id, option.difficulty)}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 active:scale-95',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-muted/60',
                          )}
                        >
                          {option.difficulty}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
