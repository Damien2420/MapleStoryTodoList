import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountButton } from '@/components/sync/AccountButton';
import { SyncStatusIndicator } from '@/components/sync/SyncStatusIndicator';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthError } from '@/lib/auth/authClient';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';
import { createControllerHarness, TEST_USER, type ControllerHarness } from '@/lib/sync/syncControllerTestKit';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let h: ControllerHarness | null = null;

// ThemeProvider 會讀系統主題；jsdom 沒有 matchMedia
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => root?.unmount());
  container?.remove();
  h?.dispose();
  root = null;
  container = null;
  h = null;
});

function render(harness: ControllerHarness, ui: ReactNode) {
  h = harness;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ThemeProvider>
          <TooltipProvider>
            <SyncControllerContext value={harness.controller}>{ui}</SyncControllerContext>
          </TooltipProvider>
        </ThemeProvider>
      </MemoryRouter>,
    ),
  );
}

const button = (text: string) =>
  Array.from(container!.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes(text) || b.getAttribute('aria-label')?.includes(text));

describe('AccountButton', () => {
  it('未登入時顯示登入按鈕，點擊後登入並改顯示帳號', async () => {
    const harness = createControllerHarness({ signedIn: false });
    await harness.controller.boot();
    render(harness, <AccountButton />);
    expect(button('登入 Google')).toBeDefined();

    await act(async () => {
      button('登入 Google')!.click();
      await vi.waitFor(() => expect(harness.controller.store.getState().auth.kind).toBe('signedIn'));
    });
    expect(button(TEST_USER.email)).toBeDefined();
  });

  it('沒有大頭照時顯示 email 首字母', async () => {
    const harness = createControllerHarness();
    await harness.controller.boot();
    render(harness, <AccountButton />);
    expect(button(TEST_USER.email)?.textContent).toBe('P');
  });
});

describe('SyncStatusIndicator', () => {
  it('未登入時不顯示', async () => {
    const harness = createControllerHarness({ signedIn: false });
    await harness.controller.boot();
    render(harness, <SyncStatusIndicator />);
    expect(container!.textContent).toBe('');
  });

  it('已登入同步完成時顯示已同步', async () => {
    const harness = createControllerHarness();
    await harness.controller.boot();
    await vi.waitFor(() => expect(harness.controller.store.getState().status).toEqual({ kind: 'synced' }));
    render(harness, <SyncStatusIndicator />);
    expect(button('同步狀態：已同步')).toBeDefined();
  });

  it('需要重新連線時，狀態旁邊有重新連線按鈕', async () => {
    const harness = createControllerHarness();
    harness.auth.getUser.mockRejectedValueOnce(new AuthError('reconnectRequired', 'x'));
    await harness.controller.boot();
    render(harness, <SyncStatusIndicator />);
    expect(button('同步狀態：需要重新連線')).toBeDefined();
    expect(button('重新連線')).toBeDefined();
  });
});
