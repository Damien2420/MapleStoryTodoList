import { BOSS_CATALOG, type BossSelection } from '@/lib/bossCatalog';
import { cn } from '@/lib/utils';

interface BossSelectionPreviewProps {
  selections: BossSelection[];
  className?: string;
  itemClassName?: string;
}

/** 顯示即將套用的 BOSS + 難度清單,用於建立角色流程的最終確認畫面 */
export function BossSelectionPreview({ selections, className, itemClassName }: BossSelectionPreviewProps) {
  if (selections.length === 0) {
    return <p className="text-sm text-muted-foreground">沒有選擇要套用的 BOSS。</p>;
  }

  return (
    <ul className={cn('flex max-h-72 flex-col gap-1 overflow-y-auto pr-1', className)}>
      {selections.map(({ bossId, difficulty }) => {
        const entry = BOSS_CATALOG.find((b) => b.id === bossId);
        if (!entry) return null;
        return (
          <li
            key={`${bossId}-${difficulty}`}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm',
              itemClassName,
            )}
          >
            <span>{entry.name}</span>
            <span className="text-xs text-muted-foreground">{difficulty}</span>
          </li>
        );
      })}
    </ul>
  );
}
