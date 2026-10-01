import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listsWithItems, scrollToCycle } from '@/lib/listJump';

describe('listsWithItems', () => {
  it('任務與 BOSS 都有時任務在前', () => {
    expect(listsWithItems({ taskDone: 0, taskTotal: 2, bossDone: 1, bossTotal: 1 })).toEqual(['task', 'boss']);
  });

  it('只有 BOSS(例如 VIP)', () => {
    expect(listsWithItems({ taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 2 })).toEqual(['boss']);
  });

  it('只有任務', () => {
    expect(listsWithItems({ taskDone: 1, taskTotal: 1, bossDone: 0, bossTotal: 0 })).toEqual(['task']);
  });

  it('都沒有時為空陣列', () => {
    expect(listsWithItems({ taskDone: 0, taskTotal: 0, bossDone: 0, bossTotal: 0 })).toEqual([]);
  });
});

describe('scrollToCycle', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = `
      <div data-jump-list="task">
        <div data-jump-scroller="task">
          <div data-jump-anchor="task-daily"></div>
          <div data-jump-anchor="task-weekly"></div>
        </div>
      </div>`;
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
    vi.unstubAllGlobals();
  });

  function rect(top: number): DOMRect {
    return { top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  }

  it('container 模式:依目標相對捲動容器的位置捲動容器', () => {
    const scroller = root.querySelector<HTMLElement>('[data-jump-scroller="task"]')!;
    const target = root.querySelector<HTMLElement>('[data-jump-anchor="task-weekly"]')!;
    scroller.scrollTo = vi.fn();
    scroller.scrollTop = 40;
    scroller.getBoundingClientRect = () => rect(100);
    target.getBoundingClientRect = () => rect(350);

    scrollToCycle(root, 'task', 'weekly', 'container');

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 290, behavior: 'smooth' });
  });

  it('container 模式:目標不存在時捲到容器頂端', () => {
    const scroller = root.querySelector<HTMLElement>('[data-jump-scroller="task"]')!;
    scroller.scrollTo = vi.fn();

    scrollToCycle(root, 'task', 'season', 'container');

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('page 模式:目標不存在時改捲到清單根元素', () => {
    const list = root.querySelector<HTMLElement>('[data-jump-list="task"]')!;
    list.scrollIntoView = vi.fn();

    scrollToCycle(root, 'task', 'season', 'page');

    expect(list.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('page 模式:捲到目標區塊', () => {
    const target = root.querySelector<HTMLElement>('[data-jump-anchor="task-daily"]')!;
    target.scrollIntoView = vi.fn();

    scrollToCycle(root, 'task', 'daily', 'page');

    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('減少動態效果時立即捲動', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    const target = root.querySelector<HTMLElement>('[data-jump-anchor="task-daily"]')!;
    target.scrollIntoView = vi.fn();

    scrollToCycle(root, 'task', 'daily', 'page');

    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });
});
