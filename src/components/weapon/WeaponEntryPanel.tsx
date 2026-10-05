import { Check, ChevronRight, Lock } from 'lucide-react';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { WEAPON_KINDS } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import { hasProgress, headModel, WEAPON_META, weaponPercent } from './weaponUi';

/**
 * 角色 Header 的武器進度入口:標題「武器進度」加四把武器的進度條,每條左邊是武器名稱、右邊是百分比;
 * 進行中顯示進度條與百分比(待升階時百分比用金色粗體)、完成時填滿並打勾、未解鎖顯示鎖頭、未設定是一條淡虛線加「未設定」。
 * 容器夠寬時排成 2x2,窄時(例如桌面展開排版的左欄)改成單欄四列。點擊開啟武器管理視窗
 * @param progress useWeaponProgress 的結果
 * @param onOpen 點擊時呼叫
 * @param className 額外的 class
 */
export function WeaponEntryPanel({
  progress,
  onOpen,
  className,
}: {
  progress: WeaponProgress;
  onOpen: () => void;
  className?: string;
}) {
  const rows = WEAPON_KINDS.map((kind) => {
    const status = progress.status[kind];
    const pct = hasProgress(status) ? weaponPercent(kind, progress.state) : 0;
    const waiting = status === 'active' && headModel(kind, progress).waiting;
    return { kind, status, pct, waiting };
  });
  const aria = rows
    .map(({ kind, status, pct, waiting }) => {
      const text = status === 'locked' ? '尚未解鎖' : status === 'unset' ? '未設定' : `${pct}%${waiting ? '，待升階' : ''}`;
      return `${WEAPON_META[kind].name} ${text}`;
    })
    .join('，');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`武器進度：${aria}，查看詳情`}
      className={cn(
        '@container relative flex w-full items-center gap-2 rounded-[9.6px] border border-border bg-background py-2.5 pr-2 pl-3 text-left outline-none transition-colors duration-150 ease-[var(--ease-smooth-out)] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">武器進度</span>
        <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-[7px] @[18rem]:grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto]">
          {rows.map(({ kind, status, pct, waiting }, i) => (
            <span key={kind} className="contents">
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  i % 2 === 1 && '@[18rem]:ml-2',
                  (status === 'locked' || status === 'unset') && 'text-muted-foreground',
                )}
              >
                {WEAPON_META[kind].tab}
              </span>
              {status === 'locked' ? (
                <span className="flex items-center text-muted-foreground">
                  <Lock aria-hidden="true" className="size-3" />
                </span>
              ) : status === 'unset' ? (
                <span className="border-t border-dashed border-border" />
              ) : (
                <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-[color-mix(in_oklch,var(--secondary-foreground)_22%,var(--card))]">
                  <i className="absolute inset-y-0 left-0 rounded-[3px] bg-secondary-foreground" style={{ width: `${pct}%` }} />
                </span>
              )}
              <span
                className={cn(
                  'text-right text-xs tabular-nums',
                  waiting ? 'font-semibold text-secondary-foreground' : 'text-muted-foreground',
                  status === 'done' && 'grid place-items-center text-secondary-foreground',
                )}
              >
                {status === 'done' ? (
                  <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                ) : status === 'unset' ? (
                  '未設定'
                ) : status === 'locked' ? null : (
                  `${pct}%`
                )}
              </span>
            </span>
          ))}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
