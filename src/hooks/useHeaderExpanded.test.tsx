import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEADER_EXPANDED_STORAGE_KEY, readInitialHeaderExpanded, useHeaderExpanded } from '@/hooks/useHeaderExpanded';
import { HEADER_EXPANDED_BY_DEFAULT_QUERY } from '@/lib/media';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubWidth(isMdOrWider: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === HEADER_EXPANDED_BY_DEFAULT_QUERY && isMdOrWider }));
}

describe('readInitialHeaderExpanded', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('沒有存值時,寬度 >= 768 預設展開', () => {
    stubWidth(true);
    expect(readInitialHeaderExpanded()).toBe(true);
  });

  it('沒有存值時,寬度 < 768 預設收合', () => {
    stubWidth(false);
    expect(readInitialHeaderExpanded()).toBe(false);
  });

  it('有存值時以存值為準,不看寬度', () => {
    stubWidth(true);
    localStorage.setItem(HEADER_EXPANDED_STORAGE_KEY, 'false');
    expect(readInitialHeaderExpanded()).toBe(false);
  });

  it('localStorage 拋錯時退回寬度預設值', () => {
    stubWidth(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readInitialHeaderExpanded()).toBe(true);
  });
});

describe('useHeaderExpanded', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const api: { current: ReturnType<typeof useHeaderExpanded> | null } = { current: null };

  function Harness() {
    const value = useHeaderExpanded();
    useEffect(() => {
      api.current = value;
    });
    return null;
  }

  beforeEach(() => {
    localStorage.clear();
    stubWidth(false);
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Harness />));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('掛載時不寫入存值', () => {
    expect(api.current![0]).toBe(false);
    expect(localStorage.getItem(HEADER_EXPANDED_STORAGE_KEY)).toBeNull();
  });

  it('切換後寫入存值', () => {
    act(() => api.current![1]());
    expect(api.current![0]).toBe(true);
    expect(localStorage.getItem(HEADER_EXPANDED_STORAGE_KEY)).toBe('true');
  });

  it('localStorage 寫入拋錯時仍可切換', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => api.current![1]());
    expect(api.current![0]).toBe(true);
  });
});
