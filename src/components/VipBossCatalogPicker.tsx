import { useState } from 'react';
import { ChevronDown, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
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
  const [collapsedLevels, setCollapsedLevels] = useState<Set<VipTicketLevel>>(new Set());

  if (!vipTier) return null;

  const allocation = getVipAllocation(vipTier);
  const levels = VIP_TICKET_LEVELS.filter((level) => allocation[level] > 0);
  if (levels.length === 0) return null;

  function toggleLevel(level: VipTicketLevel) {
    setCollapsedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Marker variant="separator">
        <MarkerIcon>
          <Gem />
        </MarkerIcon>
        <MarkerContent>VIP重置</MarkerContent>
      </Marker>
      <div className="flex flex-col gap-3">
        {levels.map((level) => {
          const cap = allocation[level];
          const used = trackedCountsByLevel[level] + countVipSelectionsForLevel(selections, level);
          const full = used >= cap;
          const collapsed = collapsedLevels.has(level);
          return (
            <div key={level} className="flex flex-col gap-1.5">
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapsed ? `展開${VIP_TICKET_LEVEL_LABELS[level]}` : `收合${VIP_TICKET_LEVEL_LABELS[level]}`}
                onClick={() => toggleLevel(level)}
                className="flex w-full items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[level]}</span>
                  <Badge variant={full ? 'default' : 'outline'} className="tabular-nums">
                    ({used}/{cap})
                  </Badge>
                </span>
              </button>
              {!collapsed && (
                <div className="flex flex-col gap-1.5">
                  {VIP_BOSS_MAPPING[level].map(({ bossCatalogId, difficulties }) => {
                    const entry = findBossCatalogEntry(bossCatalogId);
                    if (!entry || isCatalogEntryExpired(entry)) return null;
                    const validDifficulties = difficulties.filter((difficulty) => findDifficultyOption(entry, difficulty));
                    if (validDifficulties.length === 0) return null;
                    const hasSelection = validDifficulties.some((difficulty) =>
                      selections.has(buildVipSelectionKey(level, bossCatalogId, difficulty)),
                    );
                    return (
                      <div
                        key={bossCatalogId}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2',
                          hasSelection ? 'border-primary bg-primary/5' : 'border-border',
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
