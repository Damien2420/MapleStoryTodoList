import { useRef, useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogInIcon, type LogInIconHandle } from '@/components/ui/login';
import { useNow } from '@/hooks/useNow';
import { useSyncController, useSyncView } from '@/hooks/useSyncController';
import type { AuthUser } from '@/lib/auth/authClient';
import { describeSyncStatus } from '@/lib/sync/syncText';
import { cn } from '@/lib/utils';

/** Google 大頭照；沒有照片或載入失敗時顯示 email 首字母 */
function AccountAvatar({ user }: { user?: AuthUser }) {
  const [failed, setFailed] = useState(false);
  if (user?.picture && !failed) {
    // Google 大頭照網址會檢查 Referer，不帶 Referer 才穩定載入
    return <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" onError={() => setFailed(true)} />;
  }
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {(user?.email.charAt(0) ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Header 右側的帳號按鈕：未登入時是「登入 Google」（手機只顯示圖示），
 * 已登入時是大頭照與帳號選單（email 與同步狀態、切換主題、登出）；立即同步由 Header 的同步狀態圖示提供。
 * @param className 頂欄按鈕的配色 class（由 Header 傳入）
 */
export function AccountButton({ className }: { className?: string }) {
  const controller = useSyncController();
  const auth = useSyncView((s) => s.auth);
  const busy = useSyncView((s) => s.busy);
  const status = useSyncView((s) => s.status);
  const lastSyncedAt = useSyncView((s) => s.lastSyncedAt);
  const now = useNow(60_000);
  const { theme, setTheme } = useTheme();
  const loginIconRef = useRef<LogInIconHandle>(null);

  if (auth.kind === 'checking') return null;

  if (auth.kind === 'signedOut') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn('gap-1.5 border border-sidebar-foreground/35', className)}
        disabled={busy}
        aria-label="登入 Google"
        onClick={() => void controller.signIn()}
        onMouseEnter={() => loginIconRef.current?.startAnimation()}
        onMouseLeave={() => loginIconRef.current?.stopAnimation()}
      >
        <LogInIcon ref={loginIconRef} size={16} />
        <span className="hidden sm:inline">登入 Google</span>
      </Button>
    );
  }

  const { user } = auth;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('rounded-full', className)} aria-label={user ? `Google 帳號：${user.email}` : 'Google 帳號'}>
          <AccountAvatar user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">{user?.email ?? 'Google 帳號'}</span>
          <span className="text-xs font-normal text-muted-foreground">{describeSyncStatus(status, lastSyncedAt, now).label}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun /> : <Moon />}
          {isDark ? '切換為淺色主題' : '切換為深色主題'}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => void controller.signOut()}>
          <LogOut />
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
