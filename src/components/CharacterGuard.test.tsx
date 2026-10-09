import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CharacterGuard } from '@/components/CharacterGuard';
import { SyncControllerContext } from '@/lib/sync/syncControllerContext';
import { createControllerHarness, TEST_USER, type ControllerHarness } from '@/lib/sync/syncControllerTestKit';
import { character } from '@/lib/sync/syncTestKit';
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

async function render() {
  h = createControllerHarness({ signedIn: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter>
        <SyncControllerContext value={h!.controller}>
          <Routes>
            <Route element={<CharacterGuard />}>
              <Route path="/" element={<p>角色頁內容</p>} />
            </Route>
          </Routes>
        </SyncControllerContext>
      </MemoryRouter>,
    );
  });
  return h;
}

const text = () => container!.textContent ?? '';

describe('CharacterGuard', () => {
  it('已登入、沒有角色且第一輪同步還沒結束時顯示載入畫面；結束後回到建立第一個角色', async () => {
    const harness = await render();
    expect(text()).toContain('建立第一個角色');

    act(() => harness.controller.store.setState({ auth: { kind: 'signedIn', user: TEST_USER }, initialSyncPending: true }));
    expect(text()).toContain('正在從 Google 雲端載入資料');
    expect(text()).not.toContain('建立第一個角色');

    act(() => harness.controller.store.setState({ initialSyncPending: false }));
    expect(text()).toContain('建立第一個角色');
  });

  it('同步帶進角色後直接顯示頁面內容', async () => {
    const harness = await render();
    act(() => harness.controller.store.setState({ auth: { kind: 'signedIn', user: TEST_USER }, initialSyncPending: true }));
    act(() => useCharacterStore.setState({ characters: [character('c1')] }));
    expect(text()).toContain('角色頁內容');
  });
});
