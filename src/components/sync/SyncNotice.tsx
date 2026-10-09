import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSyncController, useSyncView } from '@/hooks/useSyncController';

/** 「不再提醒」寫在 localStorage 的 key；清除網站資料或換瀏覽器後才會再顯示 */
export const SIGN_IN_HINT_DISMISSED_KEY = 'maplestory-todolist-sign-in-hint-dismissed';

// 「關閉」存在模組層級而非元件 state：換頁導致元件重新掛載時不會再出現，重新整理頁面才會重新顯示
let closedThisSession = false;

/** 讀取「不再提醒」；無痕模式或封鎖網站資料時 localStorage 可能無法存取，視為沒有設定 */
function readDismissedForever(): boolean {
  try {
    return localStorage.getItem(SIGN_IN_HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissedForever(): void {
  try {
    localStorage.setItem(SIGN_IN_HINT_DISMISSED_KEY, '1');
  } catch {
    // 寫不進去時只在這次隱藏，下次開啟網站會再提醒
  }
}

// 提示列裡的次要按鈕：透明底，文字與邊框跟提示列同色
const LINE_BUTTON = 'border-current/45 bg-transparent text-inherit hover:bg-current/10 hover:text-inherit dark:bg-transparent';

/**
 * 看板頁與角色頁的提示列：
 * 未登入時提醒資料只在這台裝置，提供登入、不再提醒（永久隱藏）與關閉（這次隱藏）；
 * 授權失效時提示重新連線，不能關閉。
 */
export function SyncNotice() {
  const controller = useSyncController();
  const authKind = useSyncView((s) => s.auth.kind);
  const reconnectRequired = useSyncView((s) => s.status?.kind === 'reconnectRequired');
  const busy = useSyncView((s) => s.busy);
  const [hidden, setHidden] = useState(() => closedThisSession || readDismissedForever());

  if (authKind === 'signedIn' && reconnectRequired) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-2 text-sm text-destructive">
        <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">Google 授權已失效，修改暫存在這台裝置</span>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void controller.signIn()}>
          重新連線
        </Button>
      </div>
    );
  }

  if (authKind !== 'signedOut' || hidden) return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400">
      <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">資料只存在這台裝置，登入 Google 可自動同步</span>
      <Button size="sm" disabled={busy} onClick={() => void controller.signIn()}>
        登入 Google
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`ml-auto sm:ml-0 ${LINE_BUTTON}`}
        onClick={() => {
          writeDismissedForever();
          setHidden(true);
        }}
      >
        不再提醒
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={LINE_BUTTON}
        onClick={() => {
          closedThisSession = true;
          setHidden(true);
        }}
      >
        關閉
      </Button>
    </div>
  );
}
