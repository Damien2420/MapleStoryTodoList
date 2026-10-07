import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { StageSegment } from './weaponUi';

/**
 * 分段進度條:一條連續軌道,一段 = 一階、寬度依需求量,段與段之間用 1px 細刻線切開;
 * 目前這一段的右邊界畫「本階終點」刻線,尾端是百分比
 * @param segments 各段的寬度比例與填色
 * @param current 目前所在的段(0 起算)
 * @param percent 百分比(整數)
 * @param percentLabel 讀屏念出的百分比說明(整體進度 / 本階段進度)
 * @param color 進度條與百分比的顏色(各武器不同,見 weaponColor)
 */
export function StageProgressBar({
  segments,
  current,
  percent,
  percentLabel,
  color,
}: {
  segments: StageSegment[];
  current: number;
  percent: number;
  percentLabel: string;
  color: string;
}) {
  const total = segments.reduce((s, x) => s + x.weight, 0);
  const goal = (segments.slice(0, current + 1).reduce((s, x) => s + x.weight, 0) / total) * 100;
  return (
    <div className="flex items-center gap-2.5" style={{ '--bar': color } as CSSProperties}>
      <div aria-hidden="true" className="relative flex h-2 min-w-0 flex-1">
        {segments.map((seg, i) => (
          <span
            key={i}
            className={cn(
              'relative overflow-hidden bg-[color-mix(in_oklab,var(--bar)_22%,var(--card))]',
              i === 0 && 'rounded-l',
              i === segments.length - 1 && 'rounded-r',
              i > 0 && 'before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-px before:bg-popover',
            )}
            style={{ flex: `${seg.weight} 1 0` }}
          >
            <i className="absolute inset-y-0 left-0 bg-(--bar)" style={{ width: `${seg.fill * 100}%` }} />
          </span>
        ))}
        <b
          className={cn(
            'absolute -top-[3px] -bottom-[3px] z-[2] w-0.5 rounded-[1px] bg-foreground shadow-[0_0_0_1.5px_var(--popover)]',
            goal >= 100 ? '-ml-0.5' : '-ml-px',
          )}
          style={{ left: `${goal}%` }}
        />
      </div>
      <span className="min-w-[3.2em] text-right text-lg leading-[1.1] font-bold whitespace-nowrap text-(--bar) tabular-nums">
        <span className="sr-only">{percentLabel} </span>
        {percent}
        <small className="ml-px text-sm font-semibold">%</small>
      </span>
    </div>
  );
}
