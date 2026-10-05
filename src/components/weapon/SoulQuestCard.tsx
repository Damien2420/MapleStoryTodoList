import { ArrowUp, History } from 'lucide-react';
import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import { SOUL_QUESTS } from '@/data/weaponRates.data';
import { soulAtGate, soulStageOf } from '@/lib/weapon/rules';
import { soloKey, type SoulState } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import { DifficultyTag } from './parts';
import { bossName } from './weaponUi';

/**
 * 靈魂武器的升階任務卡:只列下一次升階的任務(任一即可),標出已單人擊破的那隻;停在升階等級時可以按升階
 * @param soul 靈魂狀態
 * @param onUpgrade 按下升階時呼叫
 * @param className 額外的 class
 */
export function SoulQuestCard({ soul, onUpgrade, className }: { soul: SoulState; onUpgrade: () => void; className?: string }) {
  const stage = soulStageOf(soul.level, soul.gatePassed);
  const options = SOUL_QUESTS[stage];
  const ready = soulAtGate(soul);
  if (!options) {
    return (
      <div className={cn('rounded-[9.6px] border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground', className)}>
        已經是最高階，沒有需要完成的升階任務。
      </div>
    );
  }
  const at = `Lv.${stage * 10}`;
  const done = options.some((o) => soul.soloCleared.includes(soloKey(o.bossCatalogId, o.difficulty)));
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[9.6px] border border-border px-3 py-2.5',
        ready && 'border-secondary-foreground bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))]',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">BOSS 任務</span>
        <span className="text-xs text-muted-foreground">
          {at} 升 {stage + 1} 階 · 單人擊破任一隻
        </span>
      </div>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border/70">
        {options.map((o) => {
          const hit = soul.soloCleared.includes(soloKey(o.bossCatalogId, o.difficulty));
          const name = bossName(o.bossCatalogId);
          return (
            <li key={soloKey(o.bossCatalogId, o.difficulty)} className="flex items-center gap-2 py-[5px] text-sm">
              <BossAvatar bossCatalogId={o.bossCatalogId} name={name} />
              <span className={cn('leading-[1.2] font-medium whitespace-nowrap', !hit && 'text-muted-foreground')}>{name}</span>
              <DifficultyTag difficulty={o.difficulty} />
              {hit ? (
                <span className="ml-auto inline-flex items-center gap-[3px] text-xs font-semibold whitespace-nowrap text-secondary-foreground">
                  <History aria-hidden="true" className="size-3" />
                  已攻略
                </span>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">未攻略</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <span className="text-xs text-muted-foreground">
          {ready ? (done ? '任務已滿足，可以升階' : `已到 ${at}，完成任務後升階`) : `${done ? '任務已滿足，' : ''}到 ${at} 時就能升階`}
        </span>
        <Button type="button" size="sm" disabled={!ready} onClick={onUpgrade} className="pointer-coarse:h-11">
          <ArrowUp aria-hidden="true" />
          升階
        </Button>
      </div>
    </div>
  );
}
