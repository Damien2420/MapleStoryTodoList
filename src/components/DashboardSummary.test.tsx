import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DashboardSummary } from '@/components/DashboardSummary';
import type { CycleSummary } from '@/lib/characterSummary';
import type { JumpList } from '@/lib/listJump';
import { WIDE_LIST_LAYOUT_QUERY } from '@/lib/media';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { Character } from '@/types';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMPTY: CycleSummary = { taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 0 };

// 週期摘要直接給固定值,不經過 store
vi.mock('@/hooks/useCharacterCycles', () => ({
  useCharacterCycles: () => ({
    summary: {
      daily: { taskDone: 2, taskTotal: 5, bossDone: 3, bossTotal: 3 },
      weekly: EMPTY,
      monthly: EMPTY,
      season: EMPTY,
      vip: { taskDone: 0, taskTotal: 0, bossDone: 2, bossTotal: 2 },
    },
    urgency: { weekly: false, monthly: false, season: false },
  }),
}));

const character = { id: 'c1', name: '角色' } as Character;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let onJump: Mock<(cycle: BossCycleKey, lists: JumpList[]) => void>;

function card(label: string): HTMLButtonElement {
  return Array.from(container!.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.getAttribute('aria-label')?.startsWith(label),
  )!;
}

beforeEach(() => {
  // Radix Popover 的定位需要 ResizeObserver,jsdom 沒有
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  onJump = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<DashboardSummary character={character} onJump={onJump} />));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('DashboardSummary 週期卡跳轉', () => {
  it('只有一種項目的週期直接跳轉到該清單', () => {
    act(() => card('VIP重置').click());
    expect(onJump).toHaveBeenCalledWith('vip', ['boss']);
  });

  it('窄螢幕點兩種項目都有的週期時跳出選單,選了再跳轉', () => {
    act(() => card('每日').click());
    expect(onJump).not.toHaveBeenCalled();
    // 選單開著時,開啟它的那張卡標示 data-open
    expect(card('每日').hasAttribute('data-open')).toBe(true);

    const taskButton = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === '任務')!;
    act(() => taskButton.click());
    expect(onJump).toHaveBeenCalledWith('daily', ['task']);
    expect(card('每日').hasAttribute('data-open')).toBe(false);
  });

  it('寬螢幕點兩種項目都有的週期時兩個清單一起跳轉', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === WIDE_LIST_LAYOUT_QUERY }));
    act(() => card('每日').click());
    expect(onJump).toHaveBeenCalledWith('daily', ['task', 'boss']);
  });
});
