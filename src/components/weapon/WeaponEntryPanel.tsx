import { ChevronRight } from 'lucide-react';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { cn } from '@/lib/utils';
import { describeWeaponRows, weaponListRows } from './weaponUi';
import { WeaponProgressList } from './WeaponProgressList';

/**
 * 角色 Header 的武器進度入口:標題「武器進度」加四把武器的進度條,每條左邊是武器名稱、右邊是目前階段(和進度看板一致);
 * 進行中用各武器的顏色,待升階時階段加粗並加箭頭、完成打勾、未解鎖顯示鎖頭、未設定是一條淡虛線加「未設定」。
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
  const rows = weaponListRows(progress);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`武器進度：${describeWeaponRows(rows)}，查看詳情`}
      className={cn(
        '@container relative flex w-full items-center gap-2 rounded-[9.6px] border border-border bg-background py-2.5 pr-2 pl-3 text-left outline-none transition-colors duration-150 ease-[var(--ease-smooth-out)] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">武器進度</span>
        <WeaponProgressList
          rows={rows}
          state={progress.state}
          className="grid-cols-[auto_minmax(0,1fr)_auto] text-xs @[18rem]:grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto]"
          pairClassName="@[18rem]:ml-2"
        />
      </span>
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
