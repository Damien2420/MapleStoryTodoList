import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import { cn } from '@/lib/utils';
import type { BossDifficulty } from '@/types';

/** 觸控裝置上把 32px 高的小按鈕可點範圍往上下延伸到 44px,外觀不變 */
export const COARSE_HIT =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']";

/** 難度標籤:配色沿用清單 */
export function DifficultyTag({ difficulty, className }: { difficulty: BossDifficulty; className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-px text-[10.5px] leading-[1.3] font-bold whitespace-nowrap',
        DIFFICULTY_BADGE_CLASSES[difficulty],
        className,
      )}
    >
      {difficulty}
    </span>
  );
}

/** 月王標籤 */
export function MonthlyTag() {
  return (
    <span className="shrink-0 rounded-full bg-cycle-monthly px-1.5 py-px text-[10.5px] leading-[1.3] font-semibold text-cycle-monthly-foreground">
      月王
    </span>
  );
}

/** VIP 標籤:配色沿用 VIP 週期 */
export function VipTag() {
  return (
    <span className="shrink-0 rounded-full bg-cycle-vip px-1.5 py-px text-[10.5px] leading-[1.3] font-semibold text-cycle-vip-foreground">
      VIP
    </span>
  );
}

/**
 * 說明小圖示(桌面):hover、鍵盤 focus 或點擊時顯示說明;用 Tooltip(portal),不會撐出視窗捲軸
 * @param text 說明文字
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          className="relative inline-grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 before:absolute before:-inset-3 before:content-['']"
        >
          <Info aria-hidden="true" className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-60 leading-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** 說明文字(手機):沒有 hover,直接放在畫面中 */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-1.5 text-xs leading-normal text-muted-foreground', className)}>
      <Info aria-hidden="true" className="mt-[3px] size-3 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** 素材數字後面的小單位 */
export function UnitText({ children }: { children: ReactNode }) {
  return <small className="ml-0.5 text-xs font-medium text-muted-foreground">{children}</small>;
}
