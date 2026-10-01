import type { CSSProperties } from 'react';
import { Check, ClipboardList, Swords, type LucideIcon } from 'lucide-react';
import { CycleJumpTrigger } from '@/components/CycleJumpTrigger';
import { CycleUrgencyBadge } from '@/components/CycleUrgencyBadge';
import type { CycleSummary } from '@/lib/characterSummary';
import { URGENCY_LABELS, type CycleUrgency } from '@/lib/cycleUrgency';
import { listsWithItems, type JumpList } from '@/lib/listJump';
import { cn } from '@/lib/utils';
import type { BossCycleKey } from '@/store/useListFilterStore';

/** 跳轉磚的顯示順序、名稱、週期色,以及對應的急迫欄位 */
const TILE_CYCLES: {
  cycle: BossCycleKey;
  label: string;
  color: string;
  urgencyKey?: keyof CycleUrgency;
}[] = [
  { cycle: 'daily', label: '每日', color: 'var(--cycle-daily-foreground)' },
  { cycle: 'weekly', label: '每週', color: 'var(--cycle-weekly-foreground)', urgencyKey: 'weekly' },
  { cycle: 'monthly', label: '每月', color: 'var(--cycle-monthly-foreground)', urgencyKey: 'monthly' },
  { cycle: 'season', label: '賽季', color: 'var(--cycle-season-foreground)', urgencyKey: 'season' },
  { cycle: 'vip', label: 'VIP', color: 'var(--cycle-vip-foreground)' },
];

/**
 * 磚內的一條進度條,前方以圖示標示是任務(ClipboardList)還是 BOSS(Swords),沿用專案其他地方的圖示慣例;
 * 後方寫出這一類還剩幾項,做完時以灰色 0 表示。
 * 該週期沒有這類項目時寫「無項目」佔位、圖示一起變淡,讓上條任務、下條 BOSS 的位置固定;
 * 不用虛線佔位,虛線容易被看成載入失敗。
 * 磚內寬不足 48px(極窄螢幕排 4~5 顆)時進度條只剩一小段,看起來像圓點:改成隱藏進度條但保留它的空間,
 * 讓剩餘數維持靠右;「無項目」縮成「無」並放到剩餘數的位置。斷點以磚自身寬度判斷(container query)。
 * @param icon 進度條前方的圖示
 * @param done 已完成數
 * @param total 總數
 */
function ProgressTrack({ icon: Icon, done, total }: { icon: LucideIcon; done: number; total: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3px]">
      <Icon className={cn('size-2.5 shrink-0 text-muted-foreground', total === 0 && 'opacity-40')} strokeWidth={2.5} />
      {total === 0 ? (
        <span className="flex-1 text-[10px] leading-none whitespace-nowrap text-muted-foreground @max-[48px]:text-right">
          <span className="@max-[48px]:hidden">無項目</span>
          <span className="hidden @max-[48px]:inline">無</span>
        </span>
      ) : (
        <>
          <span className="relative h-[7px] flex-1 overflow-hidden rounded-full @max-[48px]:invisible bg-[color-mix(in_oklch,var(--cf)_25%,var(--card))]">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-(--cf)"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </span>
          <span
            data-remaining
            className={cn(
              'min-w-2.5 shrink-0 text-right text-[11px] leading-none tabular-nums',
              done === total ? 'font-semibold text-muted-foreground' : 'font-bold text-(--cf)',
            )}
          >
            {total - done}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * 角色頁 Header 收合版的週期跳轉磚:每個有追蹤項目的週期一顆,顯示週期名稱與任務、BOSS 兩條進度(各附剩餘數)。
 * 即將重置/截止的週期在磚頂邊中央壓上文字標籤;剩餘數寫在各條進度條後方,不跟標籤搶位置。
 * 點擊行為由 CycleJumpTrigger 處理(寬螢幕兩個清單一起跳轉;窄螢幕兩種都有時先跳選單)。
 * @param summary 各週期進度摘要
 * @param urgency 每週/每月/賽季是否急迫
 * @param onJump 要跳轉時呼叫,lists 為要捲動的清單
 */
export function CycleJumpTiles({
  summary,
  urgency,
  onJump,
}: {
  summary: Record<BossCycleKey, CycleSummary>;
  urgency: CycleUrgency;
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
}) {
  const tiles = TILE_CYCLES.filter(({ cycle }) => listsWithItems(summary[cycle]).length > 0);

  return (
    <div
      // 上方留白容納突出磚外的急迫標籤(含 2px 外框)
      className="grid grid-cols-[repeat(var(--tiles),minmax(0,1fr))] gap-1.5 pt-[11px] lg:flex lg:gap-2"
      style={{ '--tiles': tiles.length } as CSSProperties}
    >
      {tiles.map(({ cycle, label, color, urgencyKey }) => {
        const s = summary[cycle];
        const lists = listsWithItems(s);
        const done = s.taskDone === s.taskTotal && s.bossDone === s.bossTotal;
        const urgentText = urgencyKey && urgency[urgencyKey] ? URGENCY_LABELS[urgencyKey] : undefined;
        const progressText = [
          s.taskTotal > 0 ? `任務 ${s.taskDone}/${s.taskTotal}` : '',
          s.bossTotal > 0 ? `BOSS ${s.bossDone}/${s.bossTotal}` : '',
        ]
          .filter(Boolean)
          .join(',');

        return (
          <CycleJumpTrigger
            key={cycle}
            cycle={cycle}
            lists={lists}
            onJump={onJump}
            style={{ '--cf': color } as CSSProperties}
            aria-label={`${label}:${progressText}${urgentText ? `,${urgentText}` : ''},前往清單`}
            className="@container relative flex min-w-0 flex-col gap-2.5 rounded-md border border-border bg-background px-[7px] pt-[9px] pb-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 lg:max-w-[120px] lg:min-w-[88px] lg:flex-1 lg:basis-0"
          >
            {urgentText && (
              <CycleUrgencyBadge
                label={urgentText}
                color={color}
                className="absolute -top-[9px] left-1/2 -translate-x-1/2 shadow-[0_0_0_2px_var(--card)]"
              />
            )}
            <span
              className={cn(
                'flex items-center justify-center gap-0.5 text-[13px] leading-tight font-bold whitespace-nowrap text-(--cf)',
                done && 'opacity-45',
              )}
            >
              {label}
              {done && <Check aria-hidden="true" className="size-3" strokeWidth={3} />}
            </span>
            <span className={cn('flex flex-col gap-0.5', done && 'opacity-45')}>
              <ProgressTrack icon={ClipboardList} done={s.taskDone} total={s.taskTotal} />
              <ProgressTrack icon={Swords} done={s.bossDone} total={s.bossTotal} />
            </span>
          </CycleJumpTrigger>
        );
      })}
    </div>
  );
}
