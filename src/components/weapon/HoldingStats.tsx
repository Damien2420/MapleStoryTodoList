import { cn } from '@/lib/utils';
import type { HoldingStat } from './weaponUi';

/** 數值顏色:已足夠用綠色、已達上限用黃色(--stock-enough / --stock-cap);文字「已足夠」「已達上限」同時說明,不只靠顏色 */
const TONE_CLASS = {
  enough: 'text-stock-enough',
  cap: 'text-stock-cap',
} as const;

/** 進度條填色:還不夠用金色,已足夠綠色、已達上限黃色 */
const METER_CLASS = {
  enough: 'bg-stock-enough',
  cap: 'bg-stock-cap',
} as const;

/**
 * 持有量兩格:左邊持有量、右邊本階需求(阿斯特拉為兩種素材各一格,改用進度條版面)
 * @param stats 兩格的標籤、數值與補充說明
 */
export function HoldingStats({ stats }: { stats: HoldingStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) =>
        s.fill !== undefined ? (
          <MeterStat key={s.label} stat={s} />
        ) : (
          <div key={s.label} className="flex min-w-0 flex-col gap-0.5 rounded-[9.6px] border border-border px-2.5 py-2">
            <span className="truncate text-xs text-muted-foreground">{s.label}</span>
            <span className={cn('text-sm font-semibold tabular-nums', s.tone && TONE_CLASS[s.tone])}>
              {s.value} <small className={cn('text-xs font-medium', s.tone ? 'text-current' : 'text-muted-foreground')}>{s.sub}</small>
            </span>
          </div>
        ),
      )}
    </div>
  );
}

/**
 * 進度條版面的一格:上排素材名稱與狀態,中間「持有 / 需求」,下方進度條
 * @param stat 有 fill 與 status 的持有量資料
 */
function MeterStat({ stat: s }: { stat: HoldingStat }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[9.6px] border border-border px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="truncate text-xs text-muted-foreground">{s.label}</span>
        <span className={cn('shrink-0 text-xs font-semibold whitespace-nowrap', s.tone ? TONE_CLASS[s.tone] : 'text-muted-foreground')}>
          {s.status}
        </span>
      </div>
      <span className="text-lg leading-tight font-bold tabular-nums">
        <span className={cn(s.tone && TONE_CLASS[s.tone])}>{s.value}</span>{' '}
        <small className="text-xs font-medium text-muted-foreground">{s.sub}</small>
      </span>
      <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-[color-mix(in_oklch,var(--secondary-foreground)_22%,var(--card))]">
        <div
          className={cn('h-full rounded-[3px]', s.tone ? METER_CLASS[s.tone] : 'bg-secondary-foreground')}
          style={{ width: `${(s.fill ?? 0) * 100}%` }}
        />
      </div>
    </div>
  );
}
