import { Check, History } from 'lucide-react';
import { BossAvatar } from '@/components/BossAvatar';
import { soloKey } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import type { BossDifficulty } from '@/types';
import { DifficultyTag } from './parts';
import { bossName } from './weaponUi';

/**
 * BOSS 圖示按鈕組:圖示 + 名稱 + 難度標籤,選取後外框與底色改用主色(和 BOSS 選擇器的選取狀態一致)
 * @param options 可選的 BOSS 與難度
 * @param selected 已選取的 key(`${bossCatalogId}|${difficulty}`)
 * @param history 已單人擊破過的 key,名稱下方標示「歷史紀錄」
 * @param onToggle 點擊某一顆時呼叫
 */
export function BossTilePicker({
  options,
  selected,
  history = [],
  onToggle,
}: {
  options: { bossCatalogId: string; difficulty: BossDifficulty }[];
  selected: string[];
  history?: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
      {options.map((o) => {
        const key = soloKey(o.bossCatalogId, o.difficulty);
        const on = selected.includes(key);
        const hit = history.includes(key);
        const name = bossName(o.bossCatalogId);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            aria-label={`${name} ${o.difficulty}${hit ? '，歷史紀錄' : ''}`}
            onClick={() => onToggle(key)}
            className={cn(
              'relative flex min-h-12 items-center gap-2 rounded-[9.6px] border border-border bg-background py-2 pr-[26px] pl-2.5 text-left outline-none transition-colors duration-150 ease-[var(--ease-smooth-out)] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
              on && 'border-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--background))]',
            )}
          >
            <BossAvatar bossCatalogId={o.bossCatalogId} name={name} className="size-7" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm leading-[1.2] font-medium">{name}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <DifficultyTag difficulty={o.difficulty} />
                {hit && (
                  <span className="inline-flex items-center gap-[3px] text-xs font-semibold whitespace-nowrap text-secondary-foreground">
                    <History aria-hidden="true" className="size-3" />
                    歷史紀錄
                  </span>
                )}
              </span>
            </span>
            <span className={cn('absolute top-1.5 right-1.5 flex text-primary transition-opacity duration-75', on ? 'opacity-100' : 'opacity-0')}>
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
