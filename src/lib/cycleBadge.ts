/**
 * 週期標籤對應的語意色 Badge class(楓葉森林配色)。
 *
 * 每日=楓橘、每週=森綠、每月=金黃、賽季=中性,顏色定義在 index.css 的 --cycle-* token,
 * 深淺主題各自調校。TaskList 與 BossList 的區塊標題 Badge 共用這份對照表。
 */
export const CYCLE_BADGE_CLASSES: Record<'每日' | '每週' | '每月' | '賽季', string> = {
  每日: 'border-transparent bg-cycle-daily text-cycle-daily-foreground',
  每週: 'border-transparent bg-cycle-weekly text-cycle-weekly-foreground',
  每月: 'border-transparent bg-cycle-monthly text-cycle-monthly-foreground',
  賽季: 'border-transparent bg-cycle-season text-cycle-season-foreground',
};
