// 斷點與 Tailwind 一樣用 rem:使用者放大瀏覽器預設字級時,CSS 版面會跟著換斷點,JS 的判斷也要一致

/** 預設展開角色頁 Header 的寬度門檻(Tailwind md,預設字級下為 768px) */
export const HEADER_EXPANDED_BY_DEFAULT_QUERY = '(min-width: 48rem)';

/** 任務/BOSS 清單左右並排、各自捲動的寬度門檻(Tailwind lg,預設字級下為 1024px,與 CharacterPage 的 lg:grid-cols-2 一致) */
export const WIDE_LIST_LAYOUT_QUERY = '(min-width: 64rem)';

/**
 * 查詢目前視窗是否符合指定的 media query。
 * 測試環境(jsdom)或不支援 matchMedia 的環境一律回傳 false。
 * @param query CSS media query 字串,例如 '(min-width: 768px)'
 * @returns 是否符合
 */
export function matchesMedia(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/**
 * 使用者是否在系統設定中要求減少動態效果。
 * @returns 要求減少動態效果時為 true
 */
export function prefersReducedMotion(): boolean {
  return matchesMedia('(prefers-reduced-motion: reduce)');
}
