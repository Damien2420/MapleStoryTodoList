import { useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PickerCategoryList, PickerCategorySection, PickerCategoryStatus } from '@/components/PickerCategorySection';
import { findBossCatalogEntry, findDifficultyOption, isCatalogEntryExpired } from '@/lib/bossCatalog';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import {
  buildVipSelectionKey,
  countVipSelectionsForLevel,
  getVipAllocation,
  VIP_BOSS_MAPPING,
  VIP_TICKET_LEVEL_LABELS,
  VIP_TICKET_LEVELS,
} from '@/lib/vipBossCatalog';
import type { BossDifficulty, VipTicketLevel, VipTier } from '@/types';

interface VipBossCatalogPickerProps {
  /** 所屬帳號的VIP等級(VIP 屬於帳號,不是角色) */
  vipTier: VipTier | undefined;
  /** 目前已選取的VIP選取鍵集合(buildVipSelectionKey 格式) */
  selections: Set<string>;
  onToggle: (level: VipTicketLevel, bossCatalogId: string, difficulty: BossDifficulty) => void;
  /** 該角色已追蹤中的VIP群組鍵,對應項目鎖住 */
  trackedGroupKeys: Set<string>;
  /** 整個帳號(所有角色合計)已追蹤中的VIP BOSS,依券等級分組計數;配額是帳號共用的 */
  trackedCountsByLevel: Record<VipTicketLevel, number>;
  /** 使用者點了「配額已用完」的項目時呼叫;不直接停用按鈕,而是讓呼叫端解釋為什麼加不進去 */
  onQuotaBlocked: (level: VipTicketLevel) => void;
}

/** VIP重置券BOSS勾選清單:只在所屬帳號設定過VIP等級時渲染,依券等級分組,只顯示分配張數 > 0 的等級 */
export function VipBossCatalogPicker({
  vipTier,
  selections,
  onToggle,
  trackedGroupKeys,
  trackedCountsByLevel,
  onQuotaBlocked,
}: VipBossCatalogPickerProps) {
  // 只在掛載時決定一次:已追蹤數(不含對話框內的勾選)還沒達到配額的券等級預設展開,
  // 不看勾選數,否則使用者勾到滿額時該區會在眼前自己收起來
  const [openLevels, setOpenLevels] = useState<Set<VipTicketLevel>>(() => {
    if (!vipTier) return new Set();
    const allocation = getVipAllocation(vipTier);
    return new Set(
      VIP_TICKET_LEVELS.filter((level) => allocation[level] > 0 && trackedCountsByLevel[level] < allocation[level]),
    );
  });

  if (!vipTier) return null;

  const allocation = getVipAllocation(vipTier);
  const levels = VIP_TICKET_LEVELS.filter((level) => allocation[level] > 0);
  if (levels.length === 0) return null;

  const allOpen = levels.every((level) => openLevels.has(level));

  function toggleLevel(level: VipTicketLevel) {
    setOpenLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function handleToggleAllLevels() {
    setOpenLevels(allOpen ? new Set() : new Set(levels));
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* 與 PresetTaskPicker、BossCatalogPicker 的工具列同一個位置與樣式 */}
      <Button type="button" variant="outline" size="sm" className="gap-1.5 self-start" onClick={handleToggleAllLevels}>
        {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
        {allOpen ? '全部收合' : '全部展開'}
      </Button>

      <PickerCategoryList>
        {levels.map((level) => {
          const cap = allocation[level];
          const used = trackedCountsByLevel[level] + countVipSelectionsForLevel(selections, level);
          const full = used >= cap;
          return (
            <PickerCategorySection
              key={level}
              label={VIP_TICKET_LEVEL_LABELS[level]}
              status={
                // 已追蹤就佔滿(不含勾選)與 BOSS 的「已全部追蹤」同一個語意;其餘顯示已用/配額
                trackedCountsByLevel[level] >= cap ? (
                  <PickerCategoryStatus tone="muted">已額滿</PickerCategoryStatus>
                ) : (
                  <PickerCategoryStatus tone="active">
                    {used}/{cap}
                  </PickerCategoryStatus>
                )
              }
              open={openLevels.has(level)}
              onToggle={() => toggleLevel(level)}
            >
              <div className="flex flex-col gap-1.5">
                {VIP_BOSS_MAPPING[level].map(({ bossCatalogId, difficulties }) => {
                  const entry = findBossCatalogEntry(bossCatalogId);
                  if (!entry || isCatalogEntryExpired(entry)) return null;
                  const validDifficulties = difficulties.filter((difficulty) =>
                    findDifficultyOption(entry, difficulty),
                  );
                  if (validDifficulties.length === 0) return null;
                  const hasSelection = validDifficulties.some((difficulty) =>
                    selections.has(buildVipSelectionKey(level, bossCatalogId, difficulty)),
                  );
                  return (
                    <div
                      key={bossCatalogId}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2',
                        hasSelection ? 'border-primary bg-primary/5' : 'border-border bg-popover',
                      )}
                    >
                      <span className="shrink-0 text-sm font-medium">{entry.name}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {validDifficulties.map((difficulty) => {
                          const key = buildVipSelectionKey(level, bossCatalogId, difficulty);
                          const active = selections.has(key);
                          const trackedLocked = trackedGroupKeys.has(key);
                          // 已追蹤中的項目直接鎖住;配額用完只是「視覺上停用」但仍可點擊,
                          // 點下去由呼叫端解釋原因(配額是帳號共用的,使用者需要知道是誰佔用了)
                          const quotaBlocked = !active && full;
                          const disabled = trackedLocked || quotaBlocked;
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={trackedLocked}
                              aria-disabled={quotaBlocked || undefined}
                              title={trackedLocked ? '此券等級已在追蹤中' : undefined}
                              onClick={() =>
                                quotaBlocked ? onQuotaBlocked(level) : onToggle(level, bossCatalogId, difficulty)
                              }
                              className={cn(
                                'rounded-md border px-2.5 py-2 text-xs font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                                !disabled && 'hover:scale-105 active:scale-95',
                                active
                                  ? cn('border-transparent', DIFFICULTY_BADGE_CLASSES[difficulty])
                                  : disabled
                                    ? 'cursor-not-allowed border-input text-muted-foreground opacity-50'
                                    : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-muted/60',
                              )}
                            >
                              {difficulty}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PickerCategorySection>
          );
        })}
      </PickerCategoryList>
    </div>
  );
}
