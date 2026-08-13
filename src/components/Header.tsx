import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { HomeIcon } from '@/components/ui/home';
import { SettingsIcon } from '@/components/ui/settings';
import { SunIcon } from '@/components/ui/sun';
import { MoonIcon } from '@/components/ui/moon';
import { useTheme } from '@/components/theme-provider';

// 頂欄是深森綠底,ghost 按鈕預設的 hover:bg-muted 會出錯,統一改走 sidebar token
const HEADER_BUTTON_CLASSES =
  'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent';

/** HomeIcon/SettingsIcon 共用的動畫控制 handle 形狀,用來在 hover 到外層 Button 時手動觸發圖示動畫 */
interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeIconRef = useRef<AnimatedIconHandle>(null);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-full ${HEADER_BUTTON_CLASSES}`}
      aria-label={isDark ? '切換為淺色主題' : '切換為深色主題'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      onMouseEnter={() => themeIconRef.current?.startAnimation()}
      onMouseLeave={() => themeIconRef.current?.stopAnimation()}
    >
      {isDark ? <SunIcon ref={themeIconRef} size={16} /> : <MoonIcon ref={themeIconRef} size={16} />}
    </Button>
  );
}

interface HeaderProps {
  onGoHome: () => void;
  onOpenDataManagement: () => void;
}

/** 全站頂部導覽列:標題、首頁/資料管理按鈕、主題切換 */
export function Header({ onGoHome, onOpenDataManagement }: HeaderProps) {
  const homeIconRef = useRef<AnimatedIconHandle>(null);
  const settingsIconRef = useRef<AnimatedIconHandle>(null);

  return (
    <header className="flex flex-col gap-2 border-b border-sidebar-border bg-sidebar text-sidebar-foreground px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">楓之谷角色任務追蹤管理</h1>
        <div className="flex items-center gap-1 sm:hidden">
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
          onMouseEnter={() => homeIconRef.current?.startAnimation()}
          onMouseLeave={() => homeIconRef.current?.stopAnimation()}
        >
          <HomeIcon ref={homeIconRef} size={16} />
          首頁
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${HEADER_BUTTON_CLASSES}`}
          onClick={onOpenDataManagement}
          onMouseEnter={() => settingsIconRef.current?.startAnimation()}
          onMouseLeave={() => settingsIconRef.current?.stopAnimation()}
        >
          <SettingsIcon ref={settingsIconRef} size={16} />
          資料管理
        </Button>
      </div>

      <div className="hidden items-center gap-1 sm:flex sm:justify-self-end">
        <ThemeToggle />
      </div>
    </header>
  );
}
