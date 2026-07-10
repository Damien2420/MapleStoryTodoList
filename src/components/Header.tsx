import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeIcon } from '@/components/ui/home';
import { SettingsIcon } from '@/components/ui/settings';
import { useTheme } from '@/components/theme-provider';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={isDark ? '切換為淺色主題' : '切換為深色主題'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

interface HeaderProps {
  onGoHome: () => void;
  onOpenDataManagement: () => void;
}

/** 全站頂部導覽列:標題、首頁/資料管理按鈕、主題切換 */
export function Header({ onGoHome, onOpenDataManagement }: HeaderProps) {
  return (
    <header className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight text-foreground">楓之谷角色任務追蹤管理</h1>
        <div className="sm:hidden">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 sm:justify-self-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label="回到記錄首頁"
          onClick={onGoHome}
        >
          <HomeIcon size={16} />
          首頁
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onOpenDataManagement}>
          <SettingsIcon size={16} />
          資料管理
        </Button>
      </div>

      <div className="hidden sm:block sm:justify-self-end">
        <ThemeToggle />
      </div>
    </header>
  );
}
