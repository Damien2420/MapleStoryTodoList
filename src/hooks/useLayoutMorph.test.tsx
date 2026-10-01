import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { collectFadeTargets, useLayoutMorph } from '@/hooks/useLayoutMorph';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('collectFadeTargets', () => {
  it('跳過形變元素,包含形變元素的容器往內找,其餘整塊淡入', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div id="identity">
        <span data-morph="avatar"></span>
        <div id="text"><h1 data-morph="name"></h1><p id="meta"></p></div>
      </div>
      <div id="summary"><span></span></div>`;
    const ids = collectFadeTargets(root).map((el) => el.id);
    expect(ids).toEqual(['meta', 'summary']);
  });
});

/** 模擬 CharacterHeader:外框 + 依狀態換掉整棵排版子樹 + 切換按鈕 */
function Harness() {
  const [expanded, setExpanded] = useState(false);
  const { shellRef, capture } = useLayoutMorph(expanded);
  return (
    <div ref={shellRef} id="shell">
      <div data-morph-layer key={String(expanded)}>
        <span data-morph="name">角色</span>
        <span id="state">{expanded ? 'expanded' : 'collapsed'}</span>
      </div>
      <button
        id="toggle"
        onClick={() => {
          if (capture(expanded ? 'collapse' : 'expand')) setExpanded(!expanded);
        }}
      />
    </div>
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Harness />));
}

function clickToggle() {
  act(() => container!.querySelector<HTMLButtonElement>('#toggle')!.click());
}

function stateText() {
  return container!.querySelector('#state')!.textContent;
}

/** 動畫期間疊在上方的舊排版複本 */
function overlayClone() {
  return container!.querySelector('#shell > [aria-hidden="true"]');
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useLayoutMorph(環境不支援 Web Animations)', () => {
  it('直接切換,不留下舊排版複本與高度樣式', () => {
    mount();
    clickToggle();

    const shell = container!.querySelector<HTMLElement>('#shell')!;
    expect(stateText()).toBe('expanded');
    expect(shell.querySelectorAll('[data-morph-layer]').length).toBe(1);
    expect(shell.style.height).toBe('');
  });

  it('連續快速切換不會卡住', () => {
    mount();
    clickToggle();
    clickToggle();

    expect(stateText()).toBe('collapsed');
  });
});

describe('useLayoutMorph(Web Animations 路徑)', () => {
  /** 每次 animate() 呼叫對應的完成控制;resolveAll 讓所有動畫一起播完 */
  let finishers: Array<() => void>;
  let cancel: Mock<() => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    finishers = [];
    cancel = vi.fn();
    Element.prototype.animate = vi.fn(() => {
      let resolve!: () => void;
      let reject!: (e: unknown) => void;
      const finished = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      finishers.push(resolve);
      return {
        finished,
        cancel: () => {
          cancel();
          reject(new DOMException('canceled', 'AbortError'));
        },
      } as unknown as Animation;
    });
  });

  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
    vi.useRealTimers();
  });

  async function resolveAll() {
    await act(async () => {
      finishers.forEach((finish) => finish());
      await Promise.resolve();
    });
  }

  it('動畫期間疊上舊排版複本,播完後移除', async () => {
    mount();
    clickToggle();

    expect(stateText()).toBe('expanded');
    expect(overlayClone()).not.toBeNull();
    expect(overlayClone()!.hasAttribute('inert')).toBe(true);

    await resolveAll();
    expect(overlayClone()).toBeNull();
  });

  it('動畫進行中再點切換會被忽略,播完後可以再切換', async () => {
    mount();
    clickToggle();
    clickToggle();
    expect(stateText()).toBe('expanded');

    await resolveAll();
    clickToggle();
    expect(stateText()).toBe('collapsed');
  });

  it('動畫時間軸停住(分頁在背景)時由計時器收尾,不會卡在動畫中', () => {
    mount();
    clickToggle();
    expect(overlayClone()).not.toBeNull();

    // 展開 280ms,保底計時器為 280 * 1.6 + 100
    act(() => vi.advanceTimersByTime(280 * 1.6 + 100));
    expect(overlayClone()).toBeNull();

    clickToggle();
    expect(stateText()).toBe('collapsed');
  });

  it('動畫中卸載時取消動畫,不留下計時器', () => {
    mount();
    clickToggle();

    act(() => root!.unmount());
    root = null;

    expect(cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
