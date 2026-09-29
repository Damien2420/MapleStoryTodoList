import { Outlet, useNavigate } from 'react-router-dom';
import { FirstCharacterOnboarding } from '@/components/FirstCharacterOnboarding';
import { useCharacterStore } from '@/store/useCharacterStore';
import { ROUTES } from '@/lib/routes';

/**
 * 需要至少一隻角色才有意義的頁面共用的守衛(Layout Route):沒有角色就在原地顯示首次使用引導,不轉址。
 * /backup 刻意放在守衛外,沒有角色時也要能進去匯入備份。
 */
export function CharacterGuard() {
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);
  const navigate = useNavigate();

  if (!hasCharacters) return <FirstCharacterOnboarding onImport={() => navigate(ROUTES.backup)} />;
  return <Outlet />;
}
