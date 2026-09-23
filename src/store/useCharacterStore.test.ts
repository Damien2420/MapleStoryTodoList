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

describe('useCharacterStore assignCharactersToAccount', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
  });

  function addCharacter(name: string): string {
    return useCharacterStore.getState().addCharacter({ name, server: '艾麗亞', level: 1, job: 'Warrior', source: 'manual' });
  }

  it('一次把多隻角色歸到同一個帳號,沒被選的角色不受影響', () => {
    const [a, b, c] = [addCharacter('A'), addCharacter('B'), addCharacter('C')];
    useCharacterStore.getState().assignCharactersToAccount([a, c], 'acc-1');

    const byId = Object.fromEntries(useCharacterStore.getState().characters.map((ch) => [ch.id, ch.accountId]));
    expect(byId).toEqual({ [a]: 'acc-1', [b]: null, [c]: 'acc-1' });
  });

  it('只觸發一次 store 更新,不論傳入幾隻角色', () => {
    const ids = [addCharacter('A'), addCharacter('B'), addCharacter('C')];
    let updateCount = 0;
    const unsubscribe = useCharacterStore.subscribe(() => {
      updateCount += 1;
    });
    useCharacterStore.getState().assignCharactersToAccount(ids, 'acc-1');
    unsubscribe();
    expect(updateCount).toBe(1);
  });

  it('accountId 傳 null 可以把角色移出帳號', () => {
    const id = addCharacter('A');
    useCharacterStore.getState().assignCharactersToAccount([id], 'acc-1');
    useCharacterStore.getState().assignCharactersToAccount([id], null);
    expect(useCharacterStore.getState().characters[0].accountId).toBeNull();
  });

  it('傳入不存在的 id 不會爆,也不會新增資料', () => {
    const id = addCharacter('A');
    useCharacterStore.getState().assignCharactersToAccount(['ghost'], 'acc-1');
    expect(useCharacterStore.getState().characters).toHaveLength(1);
    expect(useCharacterStore.getState().characters[0].accountId).toBeNull();
    expect(useCharacterStore.getState().characters[0].id).toBe(id);
  });
});

describe('useCharacterStore applyCharacterLayout', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
  });

  function addCharacter(name: string): string {
    return useCharacterStore.getState().addCharacter({ name, server: '艾麗亞', level: 1, job: 'Warrior', source: 'manual' });
  }

  it('依排列結果更新 accountId 與 order,且只觸發一次 store 更新', () => {
    const [a, b, c] = [addCharacter('A'), addCharacter('B'), addCharacter('C')];
    let updateCount = 0;
    const unsubscribe = useCharacterStore.subscribe(() => {
      updateCount += 1;
    });
    useCharacterStore.getState().applyCharacterLayout([
      { accountId: 'acc-1', characterIds: [c, a] },
      { accountId: null, characterIds: [b] },
    ]);
    unsubscribe();

    const { characters } = useCharacterStore.getState();
    const inAccount = characters.filter((ch) => ch.accountId === 'acc-1').sort((p, q) => p.order - q.order);
    expect(inAccount.map((ch) => ch.id)).toEqual([c, a]);
    expect(characters.find((ch) => ch.id === b)?.accountId).toBeNull();
    expect(updateCount).toBe(1);
  });
});
