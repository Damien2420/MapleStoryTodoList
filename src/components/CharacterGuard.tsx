import { Outlet, useNavigate } from 'react-router-dom';
import { Cloud } from 'lucide-react';
import { FirstCharacterOnboarding } from '@/components/FirstCharacterOnboarding';
import { Spinner } from '@/components/ui/spinner';
import { useSyncView } from '@/hooks/useSyncController';
import { useCharacterStore } from '@/store/useCharacterStore';
import { ROUTES } from '@/lib/routes';

/**
 * 需要至少一隻角色才有意義的頁面共用的守衛(Layout Route):沒有角色就在原地顯示首次使用引導,不轉址。
 * 登入後第一輪同步還在進行時,雲端可能有角色,先顯示載入畫面,避免使用者以為登入沒反應而開始建立角色。
 * /backup 刻意放在守衛外,沒有角色時也要能進去匯入備份。
 */
export function CharacterGuard() {
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);
  const loadingCloud = useSyncView((s) => s.auth.kind === 'signedIn' && s.initialSyncPending);
  const navigate = useNavigate();

  if (hasCharacters) return <Outlet />;
  if (loadingCloud) return <CloudLoading />;
  return <FirstCharacterOnboarding onImport={() => navigate(ROUTES.backup)} />;
}

/** 登入後等待第一輪同步完成的畫面,版面與首次使用引導一致 */
function CloudLoading() {
  return (
    <div role="status" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Cloud className="size-6" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <h2 className="flex items-center justify-center gap-2 text-lg font-semibold text-foreground">
          {/* Spinner 自帶英文的 aria-label,標題文字已負責朗讀 */}
          <Spinner aria-hidden="true" />
          正在從 Google 雲端載入資料…
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">完成後會自動顯示你的角色。</p>
      </div>
    </div>
  );
}
