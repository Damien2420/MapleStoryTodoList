import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncAcrossTabs } from '@/lib/crossTabSync';

/** 建一個假的 persist store,只提供 syncAcrossTabs 用得到的 persist.rehydrate */
function makeFakeStore() {
  return { persist: { rehydrate: vi.fn() } } as unknown as Parameters<typeof syncAcrossTabs>[0];
}

describe('syncAcrossTabs', () => {
  it('key 相符且 storageArea 是 localStorage 時呼叫 rehydrate', () => {
    const store = makeFakeStore();
    syncAcrossTabs(store, 'maplestory-todolist-characters');

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: localStorage }),
    );

    expect(store.persist.rehydrate).toHaveBeenCalledTimes(1);
  });

  it('key 不相符時不呼叫 rehydrate', () => {
    const store = makeFakeStore();
    syncAcrossTabs(store, 'maplestory-todolist-characters');

    window.dispatchEvent(new StorageEvent('storage', { key: 'maplestory-todolist-tasks', storageArea: localStorage }));

    expect(store.persist.rehydrate).not.toHaveBeenCalled();
  });

  it('storageArea 不是 localStorage 時不呼叫 rehydrate', () => {
    const store = makeFakeStore();
    syncAcrossTabs(store, 'maplestory-todolist-characters');

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: sessionStorage }),
    );

    expect(store.persist.rehydrate).not.toHaveBeenCalled();
  });

  it('分頁各自訂閱在自己獨立的 target 上時,其他分頁的事件不會互相觸發', () => {
    // 每個 EventTarget 代表一個分頁自己的 window,彼此獨立,對應真實瀏覽器「每個分頁有自己的 window」的行為
    const windowA = new EventTarget();
    const windowB = new EventTarget();
    const storeA = makeFakeStore();
    const storeB = makeFakeStore();

    syncAcrossTabs(storeA, 'maplestory-todolist-characters', windowA);
    syncAcrossTabs(storeB, 'maplestory-todolist-characters', windowB);

    // 只對分頁 A 自己的 window dispatch,模擬分頁 A 自己寫入 localStorage 不會觸發自己的 storage 事件、
    // 也不會影響到分頁 B(因為分頁 B 的 listener 掛在完全不同的 windowB 上)
    windowA.dispatchEvent(
      new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: localStorage }),
    );

    expect(storeA.persist.rehydrate).toHaveBeenCalledTimes(1);
    expect(storeB.persist.rehydrate).not.toHaveBeenCalled();
  });

  it('呼叫回傳的取消訂閱函式後,再次觸發事件不會呼叫 rehydrate', () => {
    const store = makeFakeStore();
    const unsubscribe = syncAcrossTabs(store, 'maplestory-todolist-characters');

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: localStorage }),
    );

    expect(store.persist.rehydrate).not.toHaveBeenCalled();
  });
});

/**
 * 用 vi.resetModules() + 動態 import() 各自拿到 useCharacterStore 的獨立模組實例,
 * 模擬兩個分頁各自有自己記憶體裡的 store,但共用同一份 jsdom localStorage(跟真的瀏覽器分頁一樣)。
 * dispatchEvent 是手動模擬瀏覽器在「其他分頁」寫入 localStorage 時,真的會對這個分頁的 window 觸發的 storage 事件
 * (同一個 window 內用程式直接呼叫 localStorage.setItem 不會自動觸發 storage 事件,這是瀏覽器規範本身的行為)。
 */
describe('跨分頁整合:兩個獨立的 useCharacterStore 模組實例模擬兩個分頁', () => {
  // useCharacterStore 內部呼叫 syncAcrossTabs 時沒有帶入自訂的 target,一律掛在共用的 window 上,
  // 所以每個測試動態 import 出來的 store 都會各自留一個 storage listener 在 window 上。
  // vi.resetModules() 只清模組快取,不會移除這些 listener,這裡手動記錄下來,測試結束後清掉,避免跨測試累積。
  const storageHandlers: EventListenerOrEventListenerObject[] = [];
  const originalAddEventListener = window.addEventListener.bind(window);

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
      if (type === 'storage') storageHandlers.push(handler);
      originalAddEventListener(type, handler, options);
    });
  });

  afterEach(() => {
    storageHandlers.forEach((handler) => window.removeEventListener('storage', handler));
    storageHandlers.length = 0;
    vi.restoreAllMocks();
  });

  it('分頁 A 刪除角色後,對分頁 B 觸發 storage 事件,分頁 B 的記憶體會同步移除該角色', async () => {
    const { useCharacterStore: tabA } = await import('@/store/useCharacterStore');
    const idA = tabA.getState().addCharacter({ name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', source: 'manual' });
    const idB = tabA.getState().addCharacter({ name: 'B', server: '艾麗亞', level: 1, job: 'Warrior', source: 'manual' });

    // 模擬分頁 B 是在兩隻角色都存在時才打開的,所以一開始也看得到 A 跟 B
    vi.resetModules();
    const { useCharacterStore: tabB } = await import('@/store/useCharacterStore');
    expect(tabB.getState().characters.map((c) => c.id)).toEqual([idA, idB]);

    // 分頁 A 刪除角色 B,寫回 localStorage
    tabA.getState().removeCharacter(idB);

    // 尚未收到跨分頁事件前,分頁 B 的記憶體理應還是舊的(證明問題本來就存在,不是測試設錯)
    expect(tabB.getState().characters.map((c) => c.id)).toEqual([idA, idB]);

    // 模擬瀏覽器對分頁 B 觸發的 storage 事件
    window.dispatchEvent(new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: localStorage }));
    await tabB.persist.rehydrate();

    expect(tabB.getState().characters.map((c) => c.id)).toEqual([idA]);

    // 這才是真正要防的事:分頁 B 同步後,再對「另一隻角色」做操作寫回 localStorage,
    // 不會把已經被分頁 A 刪掉的角色 B 復原回來
    tabB.getState().updateCharacter(idA, { level: 99 });
    const persisted = JSON.parse(localStorage.getItem('maplestory-todolist-characters')!);
    expect(persisted.state.characters.map((c: { id: string }) => c.id)).toEqual([idA]);
  });

  it('分頁 A 把角色搬到別的帳號後,對分頁 B 觸發 storage 事件,分頁 B 的記憶體會同步 accountId', async () => {
    const { useCharacterStore: tabA } = await import('@/store/useCharacterStore');
    const idA = tabA.getState().addCharacter({ name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', source: 'manual' });

    vi.resetModules();
    const { useCharacterStore: tabB } = await import('@/store/useCharacterStore');
    expect(tabB.getState().characters[0].accountId).toBeNull();

    tabA.getState().updateCharacter(idA, { accountId: 'acc-1' });

    window.dispatchEvent(new StorageEvent('storage', { key: 'maplestory-todolist-characters', storageArea: localStorage }));
    await tabB.persist.rehydrate();

    expect(tabB.getState().characters[0].accountId).toBe('acc-1');
  });
});
