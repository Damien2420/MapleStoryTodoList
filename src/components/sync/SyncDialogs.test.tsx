import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncDialogs } from '@/components/sync/SyncDialogs';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { deleteAllRecords } from '@/lib/sync/deleteActions';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';
import { createControllerHarness, type ControllerHarness } from '@/lib/sync/syncControllerTestKit';
import { T0, character, cloudDocument, createActionDeps, createDevice, emptySnapshot, ids, seedCloud } from '@/lib/sync/syncTestKit';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const withCharacters = (...names: string[]): DataSnapshot => emptySnapshot({ characters: names.map((n) => character(n)) });

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let h: ControllerHarness | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  h?.dispose();
  root = null;
  container = null;
  h = null;
});

function render(harness: ControllerHarness) {
  h = harness;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <SyncControllerContext value={harness.controller}>
        <SyncDialogs />
      </SyncControllerContext>,
    ),
  );
}

// 對話框透過 portal 掛在 body 底下
const bodyButton = (text: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text);
const radio = (value: string) => document.body.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!;

async function settle(check: () => void) {
  await act(async () => {
    await vi.waitFor(check);
  });
}

async function firstLogin(): Promise<ControllerHarness> {
  const cloud = new FakeCloudStore();
  await seedCloud(cloud, { snapshot: withCharacters('remote-a', 'remote-b'), resetToken: 'R1' });
  const harness = createControllerHarness({ cloud, signedIn: false, data: withCharacters('mine'), state: { boundSub: undefined } });
  await harness.controller.boot();
  render(harness);
  await act(async () => {
    await harness.controller.signIn();
  });
  return harness;
}

describe('SyncDialogs', () => {
  it('首次登入：顯示兩邊的筆數與影響說明，預選合併；改選雲端並按確定後本機換成雲端資料', async () => {
    const harness = await firstLogin();
    expect(document.body.textContent).toContain('這台裝置和雲端都有資料');
    expect(document.body.textContent).toContain('這台裝置會失去「mine」');
    expect(radio('merge').checked).toBe(true);

    await act(async () => radio('cloud').click());
    expect(harness.controller.store.getState().dialog?.kind).toBe('firstLogin');
    await act(async () => bodyButton('確定')!.click());
    await settle(() => expect(harness.controller.store.getState().dialog).toBeUndefined());
    expect(ids(harness.device.repo.read().characters)).toEqual(['remote-a', 'remote-b']);
    expect(document.body.textContent).not.toContain('這台裝置和雲端都有資料');
  });

  it('按確定後處理期間，確定鈕顯示處理中並停用；其他時候 busy 不會讓確定鈕變成處理中', async () => {
    const harness = await firstLogin();
    act(() => harness.controller.store.setState({ busy: true }));
    expect(bodyButton('確定')!.disabled).toBe(true);
    act(() => harness.controller.store.setState({ busy: false }));

    // 讓合併停在進行中，觀察處理期間的畫面
    let finish!: () => void;
    vi.spyOn(harness.controller, 'chooseMerge').mockImplementation(() => {
      harness.controller.store.setState({ busy: true });
      return new Promise<void>((resolve) => (finish = resolve));
    });
    await act(async () => bodyButton('確定')!.click());
    const pending = bodyButton('處理中')!;
    expect(pending.disabled).toBe(true);
    expect(pending.getAttribute('aria-busy')).toBe('true');
    expect(bodyButton('確定')).toBeUndefined();

    // 動作結束但對話框仍在（例如失敗），之後的 busy 不再顯示處理中
    await act(async () => finish());
    expect(bodyButton('確定')!.disabled).toBe(true);
    expect(bodyButton('處理中')).toBeUndefined();
  });

  it('首次登入：直接按確定就是合併兩邊的資料', async () => {
    const harness = await firstLogin();
    await act(async () => bodyButton('確定')!.click());
    await settle(() => expect(ids(cloudDocument(harness.cloud).snapshot.characters)).toEqual(['mine', 'remote-a', 'remote-b']));
  });

  it('重置：顯示說明，按重置此裝置後清空本機', async () => {
    const cloud = new FakeCloudStore();
    const harness = createControllerHarness({ cloud, data: withCharacters('c1') });
    await harness.controller.boot();
    await vi.waitFor(() => expect(harness.controller.store.getState().status).toEqual({ kind: 'synced' }));
    const other = createDevice(cloud, { tokenPrefix: 'other' });
    await other.engine.syncOnce();
    await deleteAllRecords(createActionDeps(other).deps);
    render(harness);
    await act(async () => {
      await harness.controller.syncNow();
    });

    expect(document.body.textContent).toContain('雲端資料已被重置');
    await act(async () => {
      bodyButton('重置此裝置')!.click();
    });
    await settle(() => expect(harness.device.repo.read()).toEqual(emptySnapshot()));
  });

  it('未登入還原：寫出會失去的角色，預選還原，按確定後本機換成還原內容', async () => {
    const harness = createControllerHarness({ signedIn: false, data: withCharacters('c1', 'c2') });
    await harness.controller.boot();
    render(harness);
    await act(async () => {
      await harness.controller.startRestore(withCharacters('c1'), { kind: 'file', savedAt: T0.toISOString() });
    });

    expect(document.body.textContent).toContain('會失去「c2」');
    expect(radio('restore').checked).toBe(true);
    await act(async () => bodyButton('確定')!.click());
    await settle(() => expect(ids(harness.device.repo.read().characters)).toEqual(['c1']));
  });

  it('還原時選維持目前的資料再按確定：關閉視窗，資料不變', async () => {
    const harness = createControllerHarness({ signedIn: false, data: withCharacters('c1', 'c2') });
    await harness.controller.boot();
    render(harness);
    await act(async () => {
      await harness.controller.startRestore(withCharacters('c1'), { kind: 'file', savedAt: T0.toISOString() });
    });

    await act(async () => radio('keep').click());
    await act(async () => bodyButton('確定')!.click());
    await settle(() => expect(harness.controller.store.getState().dialog).toBeUndefined());
    expect(ids(harness.device.repo.read().characters)).toEqual(['c1', 'c2']);
  });
});
