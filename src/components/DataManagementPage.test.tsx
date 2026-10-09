import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataManagementPage } from '@/components/DataManagementPage';
import { RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import { serializeBackup } from '@/lib/sync/restorePoints';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';
import { createControllerHarness, TEST_USER, type ControllerHarness } from '@/lib/sync/syncControllerTestKit';
import { T0, character, emptySnapshot } from '@/lib/sync/syncTestKit';
import { useCharacterStore } from '@/store/useCharacterStore';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  useCharacterStore.setState({ characters: [], activeCharacterId: null });
});

async function render(harness: ControllerHarness) {
  h = harness;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter>
        <SyncControllerContext value={harness.controller}>
          <DataManagementPage />
        </SyncControllerContext>
      </MemoryRouter>,
    );
  });
}

const buttonTexts = () => Array.from(container!.querySelectorAll('button')).map((b) => b.textContent?.trim());
const pageButton = (text: string) => Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
// 確認對話框透過 portal 掛在 body 底下
const dialogButton = (text: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find((b) => b.textContent?.trim() === text);

/** 模擬使用者在受控 input 輸入文字 */
function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DataManagementPage', () => {
  it('未登入：有登入按鈕與本機還原點，清除紀錄只有刪除本機紀錄', async () => {
    const harness = createControllerHarness({ signedIn: false });
    harness.localRestorePoint.save(emptySnapshot({ characters: [character('c1')] }), T0);
    await harness.controller.boot();
    await render(harness);
    await act(async () => {
      await vi.waitFor(() => expect(container!.textContent).toContain('自動建立'));
    });
    expect(container!.textContent).toContain('本機還原點');

    expect(buttonTexts()).toContain('登入 Google');
    expect(buttonTexts()).toContain('刪除本機紀錄');
    expect(buttonTexts()).not.toContain('刪除所有紀錄');
  });

  it('已登入：顯示帳號與同步狀態、雲端還原點，兩個刪除按鈕都在', async () => {
    const harness = createControllerHarness();
    await harness.cloud.create(RESTORE_POINT_FILE, serializeBackup(emptySnapshot({ characters: [character('c1')] }), T0));
    await harness.controller.boot();
    await vi.waitFor(() => expect(harness.controller.store.getState().status).toEqual({ kind: 'synced' }));
    await render(harness);
    await act(async () => {
      await vi.waitFor(() => expect(container!.textContent).toContain('自動建立'));
    });
    expect(container!.textContent).toContain('雲端還原點');

    expect(container!.textContent).toContain(TEST_USER.email);
    expect(container!.textContent).toContain('已同步');
    expect(buttonTexts()).toEqual(expect.arrayContaining(['立即同步', '登出', '刪除本機紀錄', '刪除所有紀錄']));
  });

  it('刪除確認要輸入與按鈕同名的文字才能按', async () => {
    useCharacterStore.setState({ characters: [character('c1')] });
    const harness = createControllerHarness({ signedIn: false });
    await harness.controller.boot();
    await render(harness);

    await act(async () => pageButton('刪除本機紀錄')!.click());
    const input = document.body.querySelector<HTMLInputElement>('[role="alertdialog"] input')!;
    expect(document.body.textContent).toContain('輸入「刪除本機紀錄」以確認');
    expect(dialogButton('刪除本機紀錄')!.disabled).toBe(true);

    act(() => typeInto(input, '刪除'));
    expect(dialogButton('刪除本機紀錄')!.disabled).toBe(true);
    act(() => typeInto(input, '刪除本機紀錄'));
    expect(dialogButton('刪除本機紀錄')!.disabled).toBe(false);
  });
});
