import { Cloud, History, Laptop, type LucideIcon } from 'lucide-react';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { summarizeSnapshot, type SnapshotSummary } from '@/lib/sync/snapshotSummary';
import { cn } from '@/lib/utils';

/** 比較區一邊的資料來源 */
export interface TallySide {
  /** 欄名，例如「這台裝置」「雲端」「10/05 08:00 的每日快照」；要和下方選項卡用同一個名稱 */
  name: string;
  /** 欄名下方的一行說明，例如「10/08 09:12 修改」 */
  caption: string;
  icon: 'device' | 'cloud' | 'history';
  snapshot: DataSnapshot;
}

const ICONS: Record<TallySide['icon'], { Icon: LucideIcon; className: string }> = {
  device: { Icon: Laptop, className: 'bg-done text-done-foreground' },
  cloud: { Icon: Cloud, className: 'bg-cycle-once text-cycle-once-foreground' },
  history: { Icon: History, className: 'bg-accent text-accent-foreground' },
};

const KINDS: Array<{ key: keyof Omit<SnapshotSummary, 'lastModifiedAt'>; label: string }> = [
  { key: 'accounts', label: '帳號' },
  { key: 'characters', label: '角色' },
  { key: 'tasks', label: '任務' },
  { key: 'bosses', label: 'BOSS' },
];

function Side({ side, summary, other }: { side: TallySide; summary: SnapshotSummary; other: SnapshotSummary }) {
  const { Icon, className } = ICONS[side.icon];
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('flex size-8.5 shrink-0 items-center justify-center rounded-full', className)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm leading-tight font-semibold text-foreground">{side.name}</p>
          <p className="text-xs text-muted-foreground">{side.caption}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {KINDS.map(({ key, label }) => {
          const diff = summary[key] - other[key];
          return (
            <div key={key} className="flex min-w-0 flex-col">
              <span className={cn('text-xl leading-tight font-bold tabular-nums', diff > 0 ? 'text-primary' : 'text-foreground')}>
                {summary[key]}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {/* 沒有差額的格子也保留同樣高度，左右兩邊才會逐格對齊 */}
              <span className="h-4.5 text-xs font-bold text-accent-foreground">{diff > 0 ? `+${diff}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 比較畫面上方的兩邊資料對齊比較：每邊固定四格（帳號、角色、任務、BOSS）不換行，
 * 比對方多的格子數字用主色並在下方寫出差額。容器小於 520px 時兩邊上下堆疊。
 * @param left 左邊的資料來源（要和下方第一張選項卡對應）
 * @param right 右邊的資料來源
 */
export function CompareTally({ left, right }: { left: TallySide; right: TallySide }) {
  const leftSummary = summarizeSnapshot(left.snapshot);
  const rightSummary = summarizeSnapshot(right.snapshot);
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @[520px]:grid-cols-2 @[520px]:gap-0">
        <div className="@[520px]:pr-5">
          <Side side={left} summary={leftSummary} other={rightSummary} />
        </div>
        <div className="border-t pt-4 @[520px]:border-t-0 @[520px]:border-l @[520px]:pt-0 @[520px]:pl-5">
          <Side side={right} summary={rightSummary} other={leftSummary} />
        </div>
      </div>
    </div>
  );
}
