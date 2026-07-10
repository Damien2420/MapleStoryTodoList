import { BOSS_CATALOG, type BossSelection } from '@/lib/bossCatalog';

interface BossSelectionPreviewProps {
  selections: BossSelection[];
}

/** 顯示即將套用的 BOSS + 難度清單,用於建立角色流程的最終確認畫面 */
export function BossSelectionPreview({ selections }: BossSelectionPreviewProps) {
  if (selections.length === 0) {
    return <p className="text-sm text-muted-foreground">沒有選擇要套用的 BOSS。</p>;
  }

  return (
    <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
      {selections.map(({ bossId, difficulty }) => {
        const entry = BOSS_CATALOG.find((b) => b.id === bossId);
        if (!entry) return null;
        return (
          <li
            key={`${bossId}-${difficulty}`}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>{entry.name}</span>
            <span className="text-xs text-muted-foreground">{difficulty}</span>
          </li>
        );
      })}
    </ul>
  );
}
