import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AstraDaily } from '@/lib/weapon/thisWeek';
import { cn } from '@/lib/utils';
import { COARSE_HIT, UnitText } from './parts';
import { fmt } from './weaponUi';

const LABEL = { full: '做到最高地區', part: '做到較低地區', miss: '沒有做', future: '還沒到' } as const;

/**
 * 阿斯特拉的每日任務 7 格(週四重置日到週三):金色 = 做到可做的最高地區、淺色 = 較低地區、— = 沒做、虛線 = 還沒到,今天加框;
 * 清單沒有追蹤格蘭蒂斯地區每日任務時,改成提示每日碎片沒有納入計算
 * @param daily 每日資料
 * @param onGoTaskList 點「前往任務清單」時呼叫
 */
export function AstraDailyStrip({ daily, onGoTaskList }: { daily: AstraDaily; onGoTaskList: () => void }) {
  if (daily.untracked) {
    return (
      <div className="flex shrink-0 items-start gap-2 rounded-lg bg-muted px-2.5 py-2 text-xs leading-[1.45] text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <b className="block text-sm font-medium text-foreground">每日的艾里溫碎片沒有納入計算</b>
          任務清單中沒有「格蘭蒂斯地區每日任務」。
          <br />
          <Button type="button" variant="outline" size="sm" className={cn('mt-1.5', COARSE_HIT)} onClick={onGoTaskList}>
            前往任務清單
          </Button>
        </span>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col gap-2 rounded-xl bg-surface-raised px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          每日任務
          <small className="block text-xs font-normal text-muted-foreground">
            最高可做{daily.maxRegion} · 每天 {daily.maxShards}
          </small>
        </span>
        <b className="font-semibold whitespace-nowrap text-secondary-foreground tabular-nums">
          +{fmt(daily.total)}
          <UnitText>碎片</UnitText>
        </b>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {daily.cells.map((c, i) => {
          const desc = c.region ? `${c.region} +${c.shards}` : LABEL[c.status];
          return (
            <li key={i} title={desc} className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
              <span className="sr-only">{`週${c.weekday}${c.today ? '（今天）' : ''}：${desc}${c.region ? `，${LABEL[c.status]}` : ''}`}</span>
              <span aria-hidden="true" className={cn(c.today && 'font-semibold text-foreground')}>{c.today ? '今天' : c.weekday}</span>
              <b
                aria-hidden="true"
                className={cn(
                  'grid h-6 w-full place-items-center rounded-md text-xs font-semibold tabular-nums',
                  c.status === 'full' && 'bg-[color-mix(in_oklch,var(--secondary)_55%,var(--card))] text-secondary-foreground',
                  c.status === 'part' && 'bg-[color-mix(in_oklch,var(--secondary)_18%,var(--card))] font-medium text-foreground',
                  c.status === 'miss' && 'bg-muted font-normal text-muted-foreground',
                  c.status === 'future' && 'shadow-[inset_0_0_0_1px_var(--border)]',
                  c.today && 'shadow-[inset_0_0_0_1.5px_var(--secondary-foreground)]',
                )}
              >
                {c.shards > 0 ? c.shards : c.status === 'miss' ? '—' : ''}
              </b>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
