import { useSyncExternalStore } from 'react';

/** 武器管理視窗切換成桌面兩欄的寬度(Tailwind md) */
export const WEAPON_WIDE_QUERY = '(min-width: 48rem)';

/**
 * 訂閱 media query,視窗大小改變時重新渲染;不支援 matchMedia 的環境(測試)一律為 false
 * @param query CSS media query
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}
