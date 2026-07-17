import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  BOSS_CATALOG,
  countWeeklyBossSelections,
  isCatalogEntryExpired,
  WEEKLY_BOSS_LIMIT,
  type BossCatalogEntry,
  type BossDifficultyOption,
} from '@/lib/bossCatalog';
import type { BossDifficulty } from '@/types';

interface BossCatalogPickerProps {
  /** 目前已選取的 BOSS id -> 已選難度集合 對應表 */
  selections: Map<string, Set<BossDifficulty>>;
  onToggleDifficulty: (bossId: string, difficulty: BossDifficulty) => void;
  /** 該角色已追蹤中的互斥群組鍵(`bossCatalogId|resetCycle`),對應群組的難度按鈕整群鎖住 */
  trackedGroupKeys: Set<string>;
  /** 該角色已追蹤且計入每週上限的筆數,與對話框內勾選數相加後判斷上限;新增角色流程沒有既有紀錄,省略即為 0 */
  trackedWeeklyCount?: number;
}

/** 每週 BOSS 上限提示:固定顯示於描述文字下方,不隨清單捲動;顯示「已追蹤 + 已勾選」的合計,達上限時切換為主色提示已滿 */
export function WeeklyBossLimitHint({
  selections,
  trackedWeeklyCount = 0,
}: {
  selections: Map<string, Set<BossDifficulty>>;
  trackedWeeklyCount?: number;
}) {
  const weeklyCount = trackedWeeklyCount + countWeeklyBossSelections(selections);
  const weeklyFull = weeklyCount >= WEEKLY_BOSS_LIMIT;
  return (
    <Badge variant={weeklyFull ? 'default' : 'outline'} className="tabular-nums">
      每週 BOSS 上限 {weeklyCount}/{WEEKLY_BOSS_LIMIT}
    </Badge>
  );
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

/** BOSS 名單勾選清單:依每日/每週/每月/賽季分類顯示,難度按鈕本身即勾選開關;每週區塊(不含賽季)以「已追蹤 + 已勾選」合計不超過 12 筆為上限,上限提示由 WeeklyBossLimitHint 獨立顯示 */
export function BossCatalogPicker({
  selections,
  onToggleDifficulty,
  trackedGroupKeys,
  trackedWeeklyCount = 0,
}: BossCatalogPickerProps) {
  const weeklyCount = trackedWeeklyCount + countWeeklyBossSelections(selections);
  const weeklyFull = weeklyCount >= WEEKLY_BOSS_LIMIT;

  return (
    <div className="flex min-h-0 max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
      {GROUPED_BOSS_CATALOG.map(([label, rows]) => (
        <div key={label} className="flex flex-col gap-2">
          <Marker variant="separator">
            <MarkerContent>{label}</MarkerContent>
          </Marker>
          <div className="flex flex-col gap-1.5">
            {rows.map(({ entry, options }) => {
              const selectedDifficulties = selections.get(entry.id);
              const hasSelection = options.some((option) => selectedDifficulties?.has(option.difficulty) ?? false);
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2',
                    hasSelection ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="shrink-0 text-sm font-medium">{entry.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                      const active = selectedDifficulties?.has(option.difficulty) ?? false;
                      // 已追蹤鎖定:該角色此王在此週期已有追蹤紀錄,整群(含相同難度)鎖住
                      const trackedLocked = trackedGroupKeys.has(`${entry.id}|${option.resetCycle}`);
                      // 對話框內互斥:同王同週期已勾了別的難度,鎖住這顆未勾的,需先取消才能改選
                      const cycleLocked =
                        !active &&
                        options.some(
                          (o) =>
                            o.difficulty !== option.difficulty &&
                            o.resetCycle === option.resetCycle &&
                            (selectedDifficulties?.has(o.difficulty) ?? false),
                        );
                      // 每週區塊達上限時,只鎖住尚未勾選的按鈕,已勾選的仍可點擊取消
                      const weeklyLocked = !active && label === '每週' && weeklyFull;
                      const disabled = trackedLocked || cycleLocked || weeklyLocked;
                      return (
                        <button
                          key={option.difficulty}
                          type="button"
                          disabled={disabled}
                          title={trackedLocked ? '此週期已在追蹤中' : undefined}
                          onClick={() => onToggleDifficulty(entry.id, option.difficulty)}
                          className={cn(
                            'rounded-md border px-2.5 py-2 text-xs font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                            !disabled && 'hover:scale-105 active:scale-95',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : disabled
                                ? 'cursor-not-allowed border-input text-muted-foreground opacity-50'
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
