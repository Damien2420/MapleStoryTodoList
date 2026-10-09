import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGN_IN_HINT_DISMISSED_KEY, SyncNotice } from '@/components/sync/SyncNotice';
import { AuthError } from '@/lib/auth/authClient';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';
import { createControllerHarness, type ControllerHarness } from '@/lib/sync/syncControllerTestKit';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let h: ControllerHarness | null = null;

function unmount() {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
}

afterEach(() => {
  unmount();
  h?.dispose();
  h = null;
  localStorage.clear();
});

function render(harness: ControllerHarness) {
  h = harness;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <SyncControllerContext value={harness.controller}>
        <SyncNotice />
      </SyncControllerContext>,
    ),
  );
}

const button = (text: string) => Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

async function signedOutHarness(): Promise<ControllerHarness> {
  const harness = createControllerHarness({ signedIn: false });
  await harness.controller.boot();
  return harness;
}

describe('SyncNotice', () => {
  it('已登入且同步正常時不顯示', async () => {
    const harness = createControllerHarness();
    await harness.controller.boot();
    await vi.waitFor(() => expect(harness.controller.store.getState().status).toEqual({ kind: 'synced' }));
    render(harness);
    expect(container!.textContent).toBe('');
  });

  it('需要重新連線時顯示重新連線按鈕，不能關閉', async () => {
    const harness = createControllerHarness();
    harness.auth.getUser.mockRejectedValueOnce(new AuthError('reconnectRequired', 'x'));
    await harness.controller.boot();
    render(harness);
    expect(container!.textContent).toContain('Google 授權已失效，修改暫存在這台裝置');
    expect(button('重新連線')).toBeDefined();
    expect(button('關閉')).toBeUndefined();
  });

  it('按不再提醒：記在 localStorage，重新掛載後也不再顯示', async () => {
    const harness = await signedOutHarness();
    render(harness);
    expect(container!.textContent).toContain('資料只存在這台裝置，登入 Google 可自動同步');
    act(() => button('不再提醒')!.click());
    expect(container!.textContent).toBe('');
    expect(localStorage.getItem(SIGN_IN_HINT_DISMISSED_KEY)).toBe('1');

    unmount();
    render(harness);
    expect(container!.textContent).toBe('');
  });

  // 關閉狀態存在模組層級，這個測試必須放在最後
  it('按關閉：這次不再顯示，但沒有寫進 localStorage', async () => {
    const harness = await signedOutHarness();
    render(harness);
    act(() => button('關閉')!.click());
    expect(container!.textContent).toBe('');
    expect(localStorage.getItem(SIGN_IN_HINT_DISMISSED_KEY)).toBeNull();

    unmount();
    render(harness);
    expect(container!.textContent).toBe('');
  });
});
