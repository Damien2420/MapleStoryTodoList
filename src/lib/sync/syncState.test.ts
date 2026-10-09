import { beforeEach, describe, expect, it } from 'vitest';
import {
  SYNC_STATE_KEY,
  createLocalStorageSyncState,
  createMemorySyncState,
  isPending,
} from '@/lib/sync/syncState';

describe('isPending', () => {
  it('修改計數器與已同步計數器不同時代表有修改待同步', () => {
    expect(isPending({ changeCounter: 3, syncedCounter: 3 })).toBe(false);
    expect(isPending({ changeCounter: 4, syncedCounter: 3 })).toBe(true);
  });
});

describe('createMemorySyncState', () => {
  it('預設兩個計數器為 0，可以用物件或函式更新，clear 回到預設值', () => {
    const state = createMemorySyncState({ boundSub: 'sub-1' });
    expect(state.read()).toEqual({ boundSub: 'sub-1', changeCounter: 0, syncedCounter: 0 });
    state.update({ lastVersion: '7' });
    state.update((current) => ({ changeCounter: current.changeCounter + 1 }));
    expect(state.read()).toMatchObject({ boundSub: 'sub-1', lastVersion: '7', changeCounter: 1 });
    state.clear();
    expect(state.read()).toEqual({ changeCounter: 0, syncedCounter: 0 });
  });
});

describe('createLocalStorageSyncState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('存在指定的 localStorage key，同一個 key 的其他實例（其他分頁）讀得到最新值', () => {
    const tabA = createLocalStorageSyncState();
    const tabB = createLocalStorageSyncState();
    tabA.update({ boundSub: 'sub-1', changeCounter: 2 });
    expect(tabB.read()).toMatchObject({ boundSub: 'sub-1', changeCounter: 2, syncedCounter: 0 });
    expect(JSON.parse(localStorage.getItem(SYNC_STATE_KEY) ?? '{}')).toMatchObject({ boundSub: 'sub-1' });
  });

  it('更新成 undefined 的欄位會被移除', () => {
    const state = createLocalStorageSyncState();
    state.update({ lastVersion: '7', lastRevisionId: 'r1' });
    state.update({ lastVersion: undefined });
    expect(state.read()).toEqual({ lastRevisionId: 'r1', changeCounter: 0, syncedCounter: 0 });
  });

  it('內容不是合法 JSON 時回傳預設值；clear 移除 key', () => {
    localStorage.setItem(SYNC_STATE_KEY, '{broken');
    const state = createLocalStorageSyncState();
    expect(state.read()).toEqual({ changeCounter: 0, syncedCounter: 0 });
    state.update({ boundSub: 'sub-1' });
    state.clear();
    expect(localStorage.getItem(SYNC_STATE_KEY)).toBeNull();
  });
});
