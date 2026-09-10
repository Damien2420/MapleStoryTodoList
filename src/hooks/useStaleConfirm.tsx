import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isBackupStale } from '@/lib/backupStatus';

/** confirmIfStale 呼叫端要表明的用途:決定對話框標題文案,以及「目前網頁」跟「備份」方框之間箭頭的方向 */
export type StaleConfirmPurpose = 'backup' | 'import';

const TITLES: Record<StaleConfirmPurpose, string> = {
  backup: '目前要備份的紀錄已經超過一個月以上未更新',
  import: '匯入的紀錄已超過 1 個月未更新',
};

const DATE_FORMAT = 'yyyy/MM/dd HH:mm';

interface PendingConfirm {
  resolve: (proceed: boolean) => void;
  purpose: StaleConfirmPurpose;
  /** 過時比對的時間(備份方框顯示的時間):立即備份是 lastBackupAt,匯入是備份檔的 createdAt */
  compareDate: string;
}

/**
 * 備份/還原三個入口(立即備份、從 Drive 匯入、從檔案匯入)共用的過時檢查站。
 * 呼叫 confirmIfStale(dateString, purpose) 時,若該時間距今超過門檻天數就跳出確認對話框並回傳一個 Promise<boolean>:
 * 使用者按「仍要繼續」resolve true,取消或關閉對話框則 resolve false;沒有過時則直接 resolve true。
 * purpose 決定對話框標題文案(見 TITLES),以及「目前網頁」「備份」兩個方框間箭頭的方向(備份是網頁→備份,匯入是網頁←備份),
 * 讓使用者能直覺看出資料流向,不用光靠文字判斷究竟是備份還是匯入的資料過時,文案統一維護在這個 hook 裡,呼叫端不用各自重複打中文字串。
 * 若在對話框顯示中又呼叫一次,新的確認請求會排隊,等目前這個處理完才接著顯示,不會覆蓋掉前一個呼叫。
 */
export function useStaleConfirm() {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState<StaleConfirmPurpose>('backup');
  const [compareDate, setCompareDate] = useState('');
  const [nowDate, setNowDate] = useState('');
  const currentRef = useRef<PendingConfirm | null>(null);
  const queueRef = useRef<PendingConfirm[]>([]);

  useEffect(() => {
    return () => {
      // 元件卸載時,把目前顯示中與排隊中的確認請求都視為取消,避免 Promise 永遠不會 resolve
      currentRef.current?.resolve(false);
      currentRef.current = null;
      queueRef.current.forEach((pending) => pending.resolve(false));
      queueRef.current = [];
    };
  }, []);

  const openNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      currentRef.current = next;
      setPurpose(next.purpose);
      setCompareDate(next.compareDate);
      setNowDate(new Date().toISOString());
      setOpen(true);
    } else {
      currentRef.current = null;
    }
  }, []);

  const confirmIfStale = useCallback((dateString: string | undefined, purpose: StaleConfirmPurpose) => {
    if (dateString === undefined || !isBackupStale(dateString)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const pending: PendingConfirm = { resolve, purpose, compareDate: dateString };
      if (currentRef.current) {
        queueRef.current.push(pending);
      } else {
        currentRef.current = pending;
        setPurpose(purpose);
        setCompareDate(dateString);
        setNowDate(new Date().toISOString());
        setOpen(true);
      }
    });
  }, []);

  function resolveAndClose(proceed: boolean) {
    setOpen(false);
    currentRef.current?.resolve(proceed);
    openNext();
  }

  const staleConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(next) => !next && resolveAndClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLES[purpose]}</AlertDialogTitle>
          <AlertDialogDescription>
            可能含有過時的紀錄。確定要繼續嗎？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/50 p-3 text-xs">
          <div className="flex flex-1 flex-col items-center gap-1 rounded-md border border-border bg-background px-2 py-2">
            <span className="text-muted-foreground">目前網頁</span>
            <span className="font-medium text-foreground">{nowDate && format(new Date(nowDate), DATE_FORMAT)}</span>
          </div>
          {purpose === 'backup' ? (
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-1 flex-col items-center gap-1 rounded-md border border-border bg-background px-2 py-2">
            <span className="text-muted-foreground">備份</span>
            <span className="font-medium text-foreground">{compareDate && format(new Date(compareDate), DATE_FORMAT)}</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={() => resolveAndClose(true)}>仍要繼續</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmIfStale, staleConfirmDialog };
}
