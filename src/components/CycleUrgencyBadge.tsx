import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * 週期急迫標籤(即將重置/即將截止):週期色實心底、卡片底色字的小方角標籤。
 * 展開版週期卡與收合版跳轉磚共用同一個外觀,位置由呼叫端用 className 決定。
 * @param label 標籤文字,通常取自 URGENCY_LABELS
 * @param color 週期色,例如 'var(--cycle-weekly-foreground)'
 * @param className 額外的 class,通常用來定位
 */
export function CycleUrgencyBadge({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span
      style={{ '--cf': color } as CSSProperties}
      className={cn(
        'h-[15px] shrink-0 rounded-[4px] bg-(--cf) px-[5px] text-[10px] leading-[15px] font-bold whitespace-nowrap text-card',
        className,
      )}
    >
      {label}
    </span>
  );
}
