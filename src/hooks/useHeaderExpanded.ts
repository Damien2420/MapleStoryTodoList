import { useCallback, useState } from 'react';
import { HEADER_EXPANDED_BY_DEFAULT_QUERY, matchesMedia } from '@/lib/media';

/** 展開/收合狀態的 localStorage key;所有角色共用,只存在這台裝置,不參與雲端備份 */
export const HEADER_EXPANDED_STORAGE_KEY = 'maplestory-todolist:character-header-expanded';

/**
 * 讀取 Header 初始的展開狀態:有存值(使用者手動切換過)就用存值,否則依視窗寬度決定(>= 768px 展開)。
 * localStorage 無法使用時退回寬度預設值。
 * @returns 是否展開
 */
export function readInitialHeaderExpanded(): boolean {
  try {
    const stored = localStorage.getItem(HEADER_EXPANDED_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // 隱私模式或被封鎖時讀不到,改用寬度預設值
  }
  return matchesMedia(HEADER_EXPANDED_BY_DEFAULT_QUERY);
}

/**
 * 角色頁 Header 的展開/收合狀態。只在掛載時決定一次初始值,視窗縮放不會自動切換;
 * 使用者手動切換後才寫入 localStorage,之後以存值為準。
 * @returns [是否展開, 切換函式]
 */
export function useHeaderExpanded(): [boolean, () => void] {
  const [expanded, setExpanded] = useState(readInitialHeaderExpanded);

  const toggle = useCallback(() => {
    const next = !expanded;
    try {
      localStorage.setItem(HEADER_EXPANDED_STORAGE_KEY, String(next));
    } catch {
      // 寫不進去就只在這次瀏覽期間生效
    }
    setExpanded(next);
  }, [expanded]);

  return [expanded, toggle];
}
