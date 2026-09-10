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
