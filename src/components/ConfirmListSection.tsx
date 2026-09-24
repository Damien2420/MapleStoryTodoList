import type { ReactNode } from 'react';
import { PencilLine, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmListSectionProps {
  /** 分區圖示,與歸屬帳號摘要列的圖示同一套樣式,讓三個區塊讀起來是並列的類別 */
  icon: LucideIcon;
  /** 分區標籤,例如「任務」「BOSS」 */
  label: string;
  /** 清單內的項目數 */
  count: number;
  /** 數量單位,例如「項」「隻」 */
  unit: string;
  /** 點「變更」時呼叫,通常是回到該清單的選擇步驟 */
  onChange: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * 新增角色確認頁的清單分區(任務、BOSS 各一個),新增角色 Dialog 與首次引導畫面共用。
 * 標題列與歸屬帳號摘要列同一套結構與底色:左邊類別圖示,中間小灰字標籤疊粗體數量,右邊「變更」回到對應步驟,
 * 三個區塊讀起來是並列的類別,確認頁因此不需要另外的返回按鈕。
 * 裡面的清單項目請呼叫端改成無框線、與外層表面同色的列,否則底色上再疊框線會顯得擁擠。
 * @param props.icon 分區圖示
 * @param props.label 分區標籤
 * @param props.count 項目數
 * @param props.unit 數量單位
 * @param props.onChange 點「變更」時呼叫
 * @param props.children 清單內容
 */
export function ConfirmListSection({
  icon: Icon,
  label,
  count,
  unit,
  onChange,
  className,
  children,
}: ConfirmListSectionProps) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-lg bg-muted p-3', className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
        >
          <Icon className="size-4" />
        </span>
        <h3 className="flex flex-1 flex-col">
          <span className="text-xs font-normal text-muted-foreground">{label}</span>
          <span className="text-[15px] font-bold text-foreground tabular-nums">
            {count}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
          </span>
      </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // 手機沒有 hover,平常就要看得出能點:用 DESIGN.md 的互動色楓橘加鉛筆圖示,但不填底色,不跟主按鈕搶;
          // ghost 預設 hover 底色是 bg-muted,跟分區底色相同會看不出來,改用圖示框的 bg-background
          className="-mr-1 shrink-0 gap-1 text-primary hover:bg-background hover:text-primary dark:hover:bg-background"
          aria-label={`變更${label}`}
          onClick={onChange}
        >
          <PencilLine className="size-3.5" aria-hidden="true" />
          變更
        </Button>
      </div>
      {children}
    </section>
  );
}
