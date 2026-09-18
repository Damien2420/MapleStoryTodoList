import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/store/useCharacterStore';

describe('useCharacterStore removeCharacter', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
  });

  it('刪除角色時寫入對應的墓碑', () => {
    const id = useCharacterStore.getState().addCharacter({
      name: '測試角色',
      server: '艾麗亞',
      level: 1,
      job: 'Warrior',
      source: 'manual',
    });
    useCharacterStore.getState().removeCharacter(id);

    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(useCharacterStore.getState().deletedIds.map((t) => t.id)).toEqual([id]);
  });
});

describe('useCharacterStore migration v1 -> v2', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('舊版(v1)persisted state 沒有 deletedIds,migrate 後補上空陣列', async () => {
    localStorage.setItem(
      'maplestory-todolist-characters',
      JSON.stringify({
        state: {
          characters: [
            { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' },
          ],
          activeCharacterId: 'c1',
        },
        version: 1,
      }),
    );
    const { useCharacterStore: freshStore } = await import('@/store/useCharacterStore');
    expect(freshStore.getState().deletedIds).toEqual([]);
    expect(freshStore.getState().characters).toHaveLength(1);
  });
});

describe('useCharacterStore migration v2 -> v3', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('舊版(v2)persisted state 沒有 accountId,migrate 後補上 null(視為未歸類)', async () => {
    localStorage.setItem(
      'maplestory-todolist-characters',
      JSON.stringify({
        state: {
          characters: [
            { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' },
          ],
          activeCharacterId: 'c1',
          deletedIds: [],
        },
        version: 2,
      }),
    );
    const { useCharacterStore: freshStore } = await import('@/store/useCharacterStore');
    expect(freshStore.getState().characters[0].accountId).toBeNull();
  });
});

describe('useCharacterStore accountId', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
  });

  it('新建角色預設為未歸類(accountId: null)', () => {
    const id = useCharacterStore.getState().addCharacter({
      name: '測試角色',
      server: '艾麗亞',
      level: 1,
      job: 'Warrior',
      source: 'manual',
    });
    expect(useCharacterStore.getState().characters.find((c) => c.id === id)?.accountId).toBeNull();
  });

  it('updateCharacter 可以指派或清除 accountId', () => {
    const id = useCharacterStore.getState().addCharacter({
      name: '測試角色',
      server: '艾麗亞',
      level: 1,
      job: 'Warrior',
      source: 'manual',
    });
    useCharacterStore.getState().updateCharacter(id, { accountId: 'acc-1' });
    expect(useCharacterStore.getState().characters.find((c) => c.id === id)?.accountId).toBe('acc-1');

    useCharacterStore.getState().updateCharacter(id, { accountId: null });
    expect(useCharacterStore.getState().characters.find((c) => c.id === id)?.accountId).toBeNull();
  });
});
