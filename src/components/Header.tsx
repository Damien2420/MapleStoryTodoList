import { Button } from '@/components/ui/button';
import { HomeIcon } from '@/components/ui/home';
import { SettingsIcon } from '@/components/ui/settings';
import { GithubIcon } from '@/components/ui/github';
import { SunIcon } from '@/components/ui/sun';
import { MoonIcon } from '@/components/ui/moon';
import { useTheme } from '@/components/theme-provider';

const GITHUB_REPO_URL = 'https://github.com/Damien2420/MapleStoryTodoList';

// 頂欄是深森綠底,ghost 按鈕預設的 hover:bg-muted 會出錯,統一改走 sidebar token
const HEADER_BUTTON_CLASSES =
  'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-full ${HEADER_BUTTON_CLASSES}`}
      aria-label={isDark ? '切換為淺色主題' : '切換為深色主題'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </Button>
  );
}

function GithubLink() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-full ${HEADER_BUTTON_CLASSES}`}
      aria-label="前往 GitHub 專案頁面"
      asChild
    >
      <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
        <GithubIcon size={16} />
      </a>
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
    <header className="flex flex-col gap-2 border-b border-sidebar-border bg-sidebar text-sidebar-foreground px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">楓之谷角色任務追蹤管理</h1>
        <div className="flex items-center gap-1 sm:hidden">
          <GithubLink />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 sm:justify-self-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${HEADER_BUTTON_CLASSES}`}
          aria-label="回到記錄首頁"
          onClick={onGoHome}
        >
          <HomeIcon size={16} />
          首頁
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${HEADER_BUTTON_CLASSES}`}
          onClick={onOpenDataManagement}
        >
          <SettingsIcon size={16} />
          資料管理
        </Button>
      </div>

      <div className="hidden items-center gap-1 sm:flex sm:justify-self-end">
        <GithubLink />
        <ThemeToggle />
      </div>
    </header>
  );
}
