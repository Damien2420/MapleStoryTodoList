import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PickerCategorySectionProps {
  /** 分類名稱(可帶 NEW 等標籤) */
  label: ReactNode;
  /** 標題右側的狀態標記,例如「已選 2」「3/12」「已全部加入」;沒有就不顯示 */
  status?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * 任務/BOSS 選擇清單的捲動面板:用 bg-muted 底色把「可以挑選的區域」跟 Dialog 的標題、按鈕分開,
 * 跟確認頁的歸屬帳號/任務/BOSS 分區同一個視覺語言。裡面放 PickerCategorySection。
 * 面板底色與 PickerCategorySection 的固定標題列底色必須相同,所以兩者放在同一個檔案維護。
 * @param props.children 各分類區塊
 */
export function PickerCategoryList({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 max-h-[50vh] flex-col overflow-y-auto rounded-lg bg-muted px-2">{children}</div>;
}

/**
 * 分類標題列上的狀態標記。
 * @param props.tone active 為楓橘淡底(已選數量、每週上限),muted 為灰字(已全部加入/已追蹤)
 * @param props.children 標記文字
 */
export function PickerCategoryStatus({ tone, children }: { tone: 'active' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 text-[11px] leading-5 font-semibold tabular-nums',
        // 標題列底色是面板的 bg-muted,灰色標記改用 bg-background 才看得出底
        tone === 'active' ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/**
 * 任務/BOSS 選擇清單中可收合的分類區塊,放在 PickerCategoryList 裡,PresetTaskPicker 與 BossCatalogPicker 共用。
 * 標題列是按鈕:箭頭、分類名稱、狀態標記;捲動時黏在清單頂端,捲到一半也能直接收合目前這一區。
 * @param props.label 分類名稱
 * @param props.status 狀態標記
 * @param props.open 是否展開
 * @param props.onToggle 點標題列時呼叫
 * @param props.children 分類內的項目
 */
export function PickerCategorySection({ label, status, open, onToggle, children }: PickerCategorySectionProps) {
  const contentId = useId();

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        // 底色與 PickerCategoryList 相同,固定在頂端時才不會透出底下的項目
        className="group/category sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border bg-muted py-2 pr-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
        <span className="flex items-center gap-1.5 text-sm font-semibold group-hover/category:text-primary">
          {label}
        </span>
        {status}
      </button>
      <div id={contentId} hidden={!open} className="pt-2 pb-3">
        {children}
      </div>
    </div>
  );
}
