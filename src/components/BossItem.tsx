import { Hourglass, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { findBossCatalogEntry } from '@/lib/bossCatalog';
import { formatExpiryDate, formatTimeUntilExpiry, hoursUntilExpiry } from '@/lib/reset';
import { useNow } from '@/hooks/useNow';
import type { CharacterBossTrackList } from '@/types';
import { useBossStore } from '@/store/useBossStore';

function formatCrystalValue(value: number): string {
  return value.toLocaleString('zh-TW');
}

/** 單一 BOSS 討伐列:勾選框 + 王名稱 + 難度標籤 + 唯讀的收益數字 + 刪除鈕 */
export function BossItem({ boss }: { boss: CharacterBossTrackList }) {
  const toggleBoss = useBossStore((s) => s.toggleBoss);
  const removeBoss = useBossStore((s) => s.removeBoss);
  const restoreBoss = useBossStore((s) => s.restoreBoss);
  const now = useNow();
  const expiresAt = boss.bossCatalogId ? findBossCatalogEntry(boss.bossCatalogId)?.expiresAt : undefined;
  const expiringSoon = expiresAt !== undefined && hoursUntilExpiry(expiresAt, now) < 24;

  function handleDelete() {
    removeBoss(boss.id);
    toast(`已刪除「${boss.bossName}」`, {
      action: {
        label: '還原',
        onClick: () => restoreBoss(boss),
      },
    });
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 min-[350px]:flex-row min-[350px]:items-center min-[350px]:gap-3',
        boss.checked && 'opacity-60',
      )}
      onClick={() => toggleBoss(boss.id)}
    >
      <div className="flex items-center gap-3 min-[350px]:min-w-0 min-[350px]:flex-1">
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
      </div>

      <div
        className="flex items-center gap-2 pl-8 min-[350px]:pl-0 min-[350px]:shrink-0"
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
            <span className="text-xs tabular-nums text-muted-foreground">{formatCrystalValue(boss.crystalValue)}</span>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7 shrink-0 text-muted-foreground opacity-40 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
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
      </div>
    </div>
  );
}
