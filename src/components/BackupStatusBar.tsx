import { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CloudUpload, X } from 'lucide-react';
import { useBackupStatus } from '@/hooks/useBackupStatus';
import { cn } from '@/lib/utils';

// 記錄「使用者關閉當下的訊息內容」,存在模組層級而非元件內部 state,
// 這樣切換到匯入/備份頁面導致這個元件 unmount 再 remount 時,關閉狀態不會被重置(整頁重新整理才會reset)
let lastDismissedMessage: string | null = null;

/** 主畫面常駐的備份狀態列:反映有沒有備份過、上次備份時間、備份後本機資料是否又有變動,可手動關閉,狀態改變後會重新顯示 */
export function BackupStatusBar({ onOpenBackupPage }: { onOpenBackupPage: () => void }) {
  const { lastBackupAt, neverBackedUp, hasUnsavedChanges } = useBackupStatus();
  const isWarning = neverBackedUp || hasUnsavedChanges;

  const statusText = neverBackedUp ? '尚未備份角色資料,建議前往備份' : hasUnsavedChanges ? '有異動尚未備份' : '資料已備份';
  const timestampText = lastBackupAt ? `上次備份於 ${format(new Date(lastBackupAt), 'yyyy/MM/dd HH:mm')}` : undefined;
  const message = timestampText ? `${statusText}・${timestampText}` : statusText;

  const [dismissedMessage, setDismissedMessage] = useState(lastDismissedMessage);
  if (dismissedMessage === message) return null;

  function dismiss() {
    lastDismissedMessage = message;
    setDismissedMessage(message);
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors max-[400px]:items-start',
        isWarning
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      <button
        type="button"
        onClick={onOpenBackupPage}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 text-left max-[400px]:items-start',
          isWarning ? 'hover:text-amber-800 dark:hover:text-amber-300' : 'hover:text-foreground',
        )}
      >
        {isWarning ? (
          <AlertTriangle className="size-4 shrink-0 max-[400px]:mt-0.5" />
        ) : (
          <CloudUpload className="size-4 shrink-0 max-[400px]:mt-0.5" />
        )}
        {/* >= 401px:狀態與時間合併成單行,超出寬度時裁切 */}
        <span className="hidden min-w-0 truncate min-[401px]:inline">{message}</span>
        {/* <= 400px:狀態與時間分成兩行,避免時間把狀態文字擠到被裁切掉 */}
        <span className="flex min-w-0 flex-col min-[401px]:hidden">
          <span>{statusText}</span>
          {timestampText && <span className="text-xs opacity-75">{timestampText}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉備份提示"
        className={cn(
          'shrink-0 rounded p-0.5 transition-colors',
          isWarning ? 'hover:bg-amber-500/20' : 'hover:bg-muted',
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
