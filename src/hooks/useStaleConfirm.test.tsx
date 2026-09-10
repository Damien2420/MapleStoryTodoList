import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useStaleConfirm } from '@/hooks/useStaleConfirm';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 30 天以上前的時間,確保會被判定為過時
const STALE_DATE = '2020-01-01T00:00:00.000Z';

type StaleConfirmApi = ReturnType<typeof useStaleConfirm>;

function TestHarness({ apiRef }: { apiRef: { current: StaleConfirmApi | null } }) {
  const api = useStaleConfirm();
  apiRef.current = api;
  return api.staleConfirmDialog;
}

/** 在(尚未渲染的)JSX 元素樹中,遞迴尋找是否存在符合子字串的文字節點 */
function containsText(node: unknown, substring: string): boolean {
  if (typeof node === 'string') return node.includes(substring);
  if (node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((child) => containsText(child, substring));
  const element = node as { props?: { children?: unknown } };
  return containsText(element.props?.children, substring);
}

/** 在(尚未渲染的)JSX 元素樹中,依元素型別遞迴尋找第一個符合的節點 */
function findElement(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  const element = node as { $$typeof?: symbol; type?: unknown; props?: { children?: unknown } };
  // React 19 的 JSX 執行環境使用 react.transitional.element,舊版則是 react.element,兩者都要接受
  const isReactElement =
    element.$$typeof === Symbol.for('react.element') || element.$$typeof === Symbol.for('react.transitional.element');
  if (!isReactElement) return null;
  if (element.type === type) return element as { props: Record<string, unknown> };
  return findElement(element.props?.children, type);
}

describe('useStaleConfirm', () => {
  let container: HTMLDivElement;
  let root: Root;
  const apiRef: { current: StaleConfirmApi | null } = { current: null };

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    apiRef.current = null;
  });

  function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(<TestHarness apiRef={apiRef} />);
    });
  }

  function rerender() {
    act(() => {
      root.render(<TestHarness apiRef={apiRef} />);
    });
  }

  function clickAction() {
    const actionElement = findElement(apiRef.current!.staleConfirmDialog, AlertDialogAction);
    expect(actionElement).not.toBeNull();
    act(() => {
      (actionElement!.props.onClick as () => void)();
    });
  }

  function isDialogOpen() {
    const dialogElement = findElement(apiRef.current!.staleConfirmDialog, AlertDialog);
    return dialogElement!.props.open as boolean;
  }

  it('同時呼叫兩次 confirmIfStale 時,兩個 Promise 都要能個別被 resolve,不能有一個被覆蓋掉而永遠掛住', async () => {
    mount();

    let resolvedFirst: boolean | undefined;
    let resolvedSecond: boolean | undefined;

    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<boolean>;
    act(() => {
      firstPromise = apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
      secondPromise = apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
    });
    firstPromise.then((v) => (resolvedFirst = v));
    secondPromise.then((v) => (resolvedSecond = v));
    rerender();

    expect(isDialogOpen()).toBe(true);

    // 第一次點擊「仍要繼續」後,第二個排隊中的確認請求應該接著跳出來,而不是直接關閉
    clickAction();
    rerender();
    expect(isDialogOpen()).toBe(true);

    clickAction();
    rerender();
    expect(isDialogOpen()).toBe(false);

    expect(await firstPromise).toBe(true);
    expect(await secondPromise).toBe(true);
    expect(resolvedFirst).toBe(true);
    expect(resolvedSecond).toBe(true);
  });

  it('對話框顯示中若元件被卸載,pending 的 Promise 要能結束,不能永遠不 resolve', async () => {
    mount();

    let resolved: boolean | undefined;
    let promise!: Promise<boolean>;
    act(() => {
      promise = apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
    });
    promise.then((v) => (resolved = v));
    rerender();
    expect(isDialogOpen()).toBe(true);

    act(() => {
      root.unmount();
    });

    // 只flush微任務,不使用真實計時器等待:若卸載沒有清理,resolved 會維持 undefined
    await Promise.resolve();
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  it('purpose 為 backup 時,標題顯示備份專用文案', () => {
    mount();

    act(() => {
      apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
    });
    rerender();

    const titleElement = findElement(apiRef.current!.staleConfirmDialog, AlertDialogTitle);
    expect(titleElement!.props.children).toBe('目前要備份的紀錄已經超過一個月以上未更新');
  });

  it('purpose 為 import 時,標題顯示匯入專用文案,讓使用者分得清是備份還是匯入的資料過時', () => {
    mount();

    act(() => {
      apiRef.current!.confirmIfStale(STALE_DATE, 'import');
    });
    rerender();

    const titleElement = findElement(apiRef.current!.staleConfirmDialog, AlertDialogTitle);
    expect(titleElement!.props.children).toBe('匯入的紀錄已超過 1 個月未更新');
  });

  it('purpose 為 backup 時,方框箭頭指向「目前網頁 -> 備份」', () => {
    mount();

    act(() => {
      apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
    });
    rerender();

    expect(findElement(apiRef.current!.staleConfirmDialog, ArrowRight)).not.toBeNull();
    expect(findElement(apiRef.current!.staleConfirmDialog, ArrowLeft)).toBeNull();
  });

  it('purpose 為 import 時,方框箭頭指向「目前網頁 <- 備份」', () => {
    mount();

    act(() => {
      apiRef.current!.confirmIfStale(STALE_DATE, 'import');
    });
    rerender();

    expect(findElement(apiRef.current!.staleConfirmDialog, ArrowLeft)).not.toBeNull();
    expect(findElement(apiRef.current!.staleConfirmDialog, ArrowRight)).toBeNull();
  });

  it('備份方框顯示的時間是傳入的 dateString(過時比對的那個時間點)', () => {
    mount();

    act(() => {
      apiRef.current!.confirmIfStale(STALE_DATE, 'backup');
    });
    rerender();

    expect(containsText(apiRef.current!.staleConfirmDialog, '2020/01/01')).toBe(true);
  });
});

describe('isBackupStale sanity for test fixture', () => {
  it('STALE_DATE 常數確實會被判定為過時', async () => {
    const { isBackupStale } = await import('@/lib/backupStatus');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(isBackupStale(STALE_DATE)).toBe(true);
    vi.useRealTimers();
  });
});
