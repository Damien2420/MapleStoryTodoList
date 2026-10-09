import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEADER_EXPANDED_BY_DEFAULT_QUERY,
  matchesMedia,
  prefersReducedMotion,
  WIDE_LIST_LAYOUT_QUERY,
} from '@/lib/media';

describe('斷點查詢', () => {
  it('與 Tailwind md/lg 一樣用 rem,使用者放大瀏覽器預設字級時 JS 與 CSS 的版面判斷一致', () => {
    expect(HEADER_EXPANDED_BY_DEFAULT_QUERY).toBe('(min-width: 48rem)');
    expect(WIDE_LIST_LAYOUT_QUERY).toBe('(min-width: 64rem)');
  });
});

describe('matchesMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('環境沒有 matchMedia 時回傳 false', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(matchesMedia('(min-width: 768px)')).toBe(false);
  });

  it('依 matchMedia 的結果回傳', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 768px)' }));
    expect(matchesMedia('(min-width: 768px)')).toBe(true);
    expect(matchesMedia('(min-width: 1024px)')).toBe(false);
  });

  it('prefersReducedMotion 查詢 prefers-reduced-motion: reduce', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(prefersReducedMotion()).toBe(true);
  });
});
