import { Hourglass, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { findBossCatalogEntry, getEffectiveCrystalValue, getMaxPartySize } from '@/lib/bossCatalog';
import { formatCrystalValue } from '@/lib/formatCrystal';
import { formatExpiryDate, formatTimeUntilExpiry, formatTimeUntilReset, hoursUntilExpiry, minutesUntilReset } from '@/lib/reset';
import { useNow } from '@/hooks/useNow';
import type { CharacterBossTrackList } from '@/types';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/** 單一 BOSS 討伐列:勾選框 + 王名稱 + 難度標籤 + 攻略人數控制 + 唯讀的收益數字 + 刪除鈕 */
export function BossItem({ boss }: { boss: CharacterBossTrackList }) {
  const toggleBoss = useBossStore((s) => s.toggleBoss);
  const removeBoss = useBossStore((s) => s.removeBoss);
  const restoreBoss = useBossStore((s) => s.restoreBoss);
  const setBossPartySize = useBossStore((s) => s.setBossPartySize);
  const settings = useSettingsStore((s) => s.settings);
  const now = useNow();
  const expiresAt = boss.bossCatalogId ? findBossCatalogEntry(boss.bossCatalogId)?.expiresAt : undefined;
  const expiringSoon = expiresAt !== undefined && hoursUntilExpiry(expiresAt, now) < 24;
  const cycleLabel = formatTimeUntilReset(boss.resetCycle, settings, now, boss.weeklyResetDay);
  const resetImminent = minutesUntilReset(boss.resetCycle, settings, now, boss.weeklyResetDay) < 60;
  const maxPartySize = getMaxPartySize(boss);

  function handleDelete() {
    removeBoss(boss.id);
    toast(`已刪除「${boss.bossName}」`, {
      action: {
        label: '還原',
        onClick: () => restoreBoss(boss),
      },
    });
  }

  const showStepper = boss.category !== 'season' && maxPartySize > 1;

  const stepperControl = (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-5 shrink-0 text-muted-foreground disabled:opacity-30"
        aria-label={`減少攻略人數:${boss.bossName}(最多 ${maxPartySize} 人)`}
        disabled={boss.partySize <= 1}
        onClick={() => setBossPartySize(boss.id, boss.partySize - 1)}
      >
        <Minus className="size-3" />
      </Button>
      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{boss.partySize}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 shrink-0 text-muted-foreground disabled:opacity-30"
        aria-label={`增加攻略人數:${boss.bossName}(最多 ${maxPartySize} 人)`}
        disabled={boss.partySize >= maxPartySize}
        onClick={() => setBossPartySize(boss.id, boss.partySize + 1)}
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );

  const deleteButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-40 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`刪除BOSS:${boss.bossName}`}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>刪除BOSS</TooltipContent>
    </Tooltip>
  );

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-3',
        boss.checked && 'opacity-60',
      )}
      onClick={() => toggleBoss(boss.id)}
    >
      {/* 標題列:勾選框 + 王名稱 + 難度標籤,400-640px 這段額外容納攻略人數與刪除鈕 */}
      <div className="flex items-center gap-2 pr-8 min-[400px]:pr-0 sm:min-w-0 sm:flex-1">
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={boss.checked}
            onCheckedChange={() => toggleBoss(boss.id)}
            aria-label={`勾選BOSS:${boss.bossName}`}
            className="size-5 rounded-md"
          />
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-snug font-medium">
          <span className={cn('min-w-0 truncate', boss.checked && 'line-through decoration-muted-foreground')}>
            {boss.bossName}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {boss.difficulty}
          </span>
        </div>

        {showStepper && <div className="hidden min-[400px]:flex sm:hidden" onClick={(e) => e.stopPropagation()}>{stepperControl}</div>}

        <div
          className="absolute top-1.5 right-1.5 min-[400px]:static min-[400px]:top-auto min-[400px]:right-auto sm:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {deleteButton}
        </div>
      </div>

      {/* 數值/狀態列:<400px 拆成兩行(攻略人數+收益 / 倒數),400-640px 合併一行(收益+倒數),≥640px 併回單一列 */}
      <div
        className="flex flex-col gap-1 pl-7 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-3 min-[400px]:shrink-0 sm:pl-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2">
          {expiresAt !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs tabular-nums',
                    expiringSoon ? 'font-semibold text-destructive' : 'text-muted-foreground',
                  )}
                >
                  <Hourglass className="size-3" />
                  {formatTimeUntilExpiry(expiresAt, now)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{formatExpiryDate(expiresAt)}</TooltipContent>
            </Tooltip>
          )}

          {boss.category !== 'season' && (
            <>
              {showStepper && <div className="min-[400px]:hidden sm:flex">{stepperControl}</div>}

              <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground sm:min-w-[9.5em] sm:justify-end">
                <img src="/coin.png" alt="" className="size-4 shrink-0" />
                {formatCrystalValue(getEffectiveCrystalValue(boss))}
              </span>
            </>
          )}
        </div>

        <span
          className={cn(
            'flex items-center gap-1 text-xs',
            resetImminent ? 'font-semibold text-destructive' : 'text-muted-foreground',
          )}
        >
          <RefreshCw className="size-3" />
          {cycleLabel}
        </span>
      </div>

      <div className="hidden sm:ml-auto sm:block">{deleteButton}</div>
    </div>
  );
}
