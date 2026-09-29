import { PencilLine, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SelectedAccountSummaryProps {
  /** 要顯示的帳號名稱;未歸類時為「未歸類」 */
  accountName: string;
  /** 是否選的是未歸類(不加入任何帳號) */
  unassigned: boolean;
  /** 點「變更」時呼叫,通常是回到選擇帳號步驟 */
  onChange: () => void;
}

/**
 * 新增角色確認頁的「歸屬帳號」摘要列,新增角色 Dialog 與首次引導畫面共用。
 * 外觀與下方任務/BOSS 分區(ConfirmListSection)的標題列一致:類別圖示、標籤疊名稱、右邊「變更」回到對應步驟。
 * 選未歸類時名稱轉灰並提示無法使用 VIP,在建立前最後提醒一次。
 * @param props.accountName 要顯示的帳號名稱
 * @param props.unassigned 是否為未歸類
 * @param props.onChange 點「變更」時呼叫
 */
export function SelectedAccountSummary({ accountName, unassigned, onChange }: SelectedAccountSummaryProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
      {/* 圖示樣式與下方任務/BOSS 分區標題一致,三個區塊讀起來是並列的類別 */}
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <UsersRound className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">歸屬帳號</span>
        <span className={cn('truncate text-[15px]', unassigned ? 'font-medium text-muted-foreground' : 'font-bold text-foreground')}>
          {accountName}
          {unassigned && <span className="ml-1.5 text-xs font-normal">無法使用 VIP</span>}
        </span>
      </div>
      {/* 樣式與任務/BOSS 分區的「變更」一致,理由見 ConfirmListSection */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mr-1 shrink-0 gap-1 text-primary hover:bg-background hover:text-primary dark:hover:bg-background"
        aria-label="變更歸屬帳號"
        onClick={onChange}
      >
        <PencilLine className="size-3.5" aria-hidden="true" />
        變更
      </Button>
    </div>
  );
}
