import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCharacterStore } from '@/store/useCharacterStore';
import { ROUTES } from '@/lib/routes';

const APP_TITLE = '好楓寶進度追蹤器';

/**
 * 依目前路由設定 document.title(格式「頁名 | 站名」),讓螢幕閱讀器與瀏覽器歷史能分辨換了哪一頁。
 * 只放在共用 layout 呼叫一次;不在各頁自己設,lazy 載入的頁面在載入完成前會殘留上一頁的標題。
 * 不放角色名稱:角色切換不算換頁。
 */
export function useDocumentTitle() {
  const { pathname } = useLocation();
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);

  useEffect(() => {
    let page = '建立第一個角色';
    if (pathname === ROUTES.backup) page = '備份與還原';
    else if (hasCharacters) page = pathname === ROUTES.root ? '進度看板' : '角色進度';
    document.title = `${page} | ${APP_TITLE}`;
  }, [pathname, hasCharacters]);
}
