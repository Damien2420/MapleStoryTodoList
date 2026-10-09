import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CycleJumpTiles } from '@/components/CycleJumpTiles';
import type { CycleSummary } from '@/lib/characterSummary';
import type { JumpList } from '@/lib/listJump';
import { WIDE_LIST_LAYOUT_QUERY } from '@/lib/media';
import type { BossCycleKey } from '@/store/useListFilterStore';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMPTY: CycleSummary = { taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 0 };
const summary: Record<BossCycleKey, CycleSummary> = {
  daily: { taskDone: 2, taskTotal: 5, bossDone: 3, bossTotal: 3 },
  weekly: EMPTY,
  monthly: EMPTY,
  season: EMPTY,
  vip: { taskDone: 0, taskTotal: 0, bossDone: 2, bossTotal: 2 },
};
const urgency = { weekly: false, monthly: false, season: false };

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let onJump: Mock<(cycle: BossCycleKey, lists: JumpList[]) => void>;

function tile(label: string): HTMLButtonElement {
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
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

function render() {
  act(() => root!.render(<CycleJumpTiles summary={summary} urgency={urgency} onJump={onJump} />));
}

describe('CycleJumpTiles', () => {
  it('只顯示有追蹤項目的週期', () => {
    render();
    const labels = Array.from(container!.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^每日/);
    expect(labels[1]).toMatch(/^VIP/);
  });

  it('沒有某一類項目時,該列寫出「無項目」', () => {
    render();
    // VIP 只有 BOSS 沒有任務;每日兩種都有
    expect(tile('VIP').textContent).toContain('無項目');
    expect(tile('每日').textContent).not.toContain('無項目');
  });

  it('只有一種項目的週期直接跳轉', () => {
    render();
    act(() => tile('VIP').click());
    expect(onJump).toHaveBeenCalledWith('vip', ['boss']);
  });

  it('窄螢幕點兩種項目都有的週期時跳出選單,選了再跳轉', () => {
    render();
    act(() => tile('每日').click());
    expect(onJump).not.toHaveBeenCalled();

    const bossButton = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'BOSS')!;
    expect(bossButton).toBeDefined();
    act(() => bossButton.click());
    expect(onJump).toHaveBeenCalledWith('daily', ['boss']);
  });

  it('每條進度條後面寫出該類剩幾項;沒有該類項目的列不寫', () => {
    render();
    // 每日:任務 2/5 剩 3,BOSS 3/3 剩 0;VIP:沒有任務,BOSS 2/2 剩 0
    const remainingOf = (label: string) =>
      Array.from(tile(label).querySelectorAll('[data-remaining]')).map((el) => el.textContent);
    expect(remainingOf('每日')).toEqual(['3', '0']);
    expect(remainingOf('VIP')).toEqual(['0']);
  });

  it('即將重置的週期在磚上寫出文字標籤,剩餘數照常顯示', () => {
    const weekly = { taskDone: 1, taskTotal: 4, bossDone: 0, bossTotal: 0 };
    act(() =>
      root!.render(
        <CycleJumpTiles summary={{ ...summary, weekly }} urgency={{ ...urgency, weekly: true }} onJump={onJump} />,
      ),
    );

    const weeklyTile = tile('每週');
    expect(weeklyTile.textContent).toContain('即將重置');
    expect(weeklyTile.querySelector('[data-remaining]')?.textContent).toBe('3');
    expect(weeklyTile.getAttribute('aria-label')).toContain('即將重置');
    expect(tile('每日').textContent).not.toContain('即將重置');
  });

  it('寬螢幕點兩種項目都有的週期時兩個清單一起跳轉', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === WIDE_LIST_LAYOUT_QUERY }));
    render();
    act(() => tile('每日').click());
    expect(onJump).toHaveBeenCalledWith('daily', ['task', 'boss']);
  });
});
