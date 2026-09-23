import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { applyCharacterLayout, findCharacterContainer, moveCharacterInContainers } from '@/lib/accountLayout';

function makeCharacter(id: string, order: number, accountId: string | null = null): Character {
  return { id, name: id, server: '艾麗亞', level: 250, job: 'Warrior', order, source: 'manual', accountId };
}

describe('applyCharacterLayout', () => {
  it('同一個帳號內重新排序:accountId 不變,order 依新順序重新分配', () => {
    const characters = [makeCharacter('a', 0, 'x'), makeCharacter('b', 1, 'x'), makeCharacter('c', 2, 'x')];
    const result = applyCharacterLayout(characters, [{ accountId: 'x', characterIds: ['c', 'a', 'b'] }]);
    const sorted = [...result].sort((p, q) => p.order - q.order).map((ch) => ch.id);
    expect(sorted).toEqual(['c', 'a', 'b']);
    expect(result.every((ch) => ch.accountId === 'x')).toBe(true);
  });

  it('跨帳號搬移:被搬的角色 accountId 改成目標帳號', () => {
    const characters = [makeCharacter('a', 0, 'x'), makeCharacter('b', 1, 'y')];
    const result = applyCharacterLayout(characters, [
      { accountId: 'x', characterIds: ['a', 'b'] },
      { accountId: 'y', characterIds: [] },
    ]);
    expect(result.find((c) => c.id === 'b')?.accountId).toBe('x');
  });

  it('accountId 為 null 代表移到未歸類', () => {
    const characters = [makeCharacter('a', 0, 'x')];
    const result = applyCharacterLayout(characters, [{ accountId: null, characterIds: ['a'] }]);
    expect(result[0].accountId).toBeNull();
  });

  it('沒被提到的角色完全不變,而且整體 order 值集合不變(不會撞號)', () => {
    const characters = [makeCharacter('a', 0, 'x'), makeCharacter('b', 5, 'x'), makeCharacter('other', 3, 'y')];
    const result = applyCharacterLayout(characters, [{ accountId: 'x', characterIds: ['b', 'a'] }]);
    expect(result.find((c) => c.id === 'other')).toBe(characters[2]);
    expect(result.map((c) => c.order).sort()).toEqual([0, 3, 5]);
    expect(result.find((c) => c.id === 'b')?.order).toBe(0);
    expect(result.find((c) => c.id === 'a')?.order).toBe(5);
  });

  it('不存在的 id 與重複的 id 會被忽略', () => {
    const characters = [makeCharacter('a', 0, 'x')];
    const result = applyCharacterLayout(characters, [
      { accountId: 'x', characterIds: ['ghost', 'a', 'a'] },
      { accountId: 'y', characterIds: ['a'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe('x');
  });

  it('不改動傳入的陣列與物件', () => {
    const characters = [makeCharacter('a', 0, 'x'), makeCharacter('b', 1, 'x')];
    applyCharacterLayout(characters, [{ accountId: 'y', characterIds: ['b', 'a'] }]);
    expect(characters.map((c) => [c.id, c.order, c.accountId])).toEqual([
      ['a', 0, 'x'],
      ['b', 1, 'x'],
    ]);
  });
});

describe('findCharacterContainer', () => {
  it('回傳角色所在的容器 id,找不到回傳 undefined', () => {
    const containers = { x: ['a', 'b'], y: ['c'] };
    expect(findCharacterContainer(containers, 'c')).toBe('y');
    expect(findCharacterContainer(containers, 'zzz')).toBeUndefined();
  });
});

describe('moveCharacterInContainers', () => {
  const base = { x: ['a', 'b', 'c'], y: ['d'], empty: [] as string[] };

  it('跨容器:放到某隻角色的位置(插在它前面)', () => {
    expect(moveCharacterInContainers(base, 'd', 'x', 'b')).toEqual({ x: ['a', 'd', 'b', 'c'], y: [], empty: [] });
  });

  it('拖到空容器(overCharacterId 為 null):放進去', () => {
    expect(moveCharacterInContainers(base, 'a', 'empty', null)).toEqual({ x: ['b', 'c'], y: ['d'], empty: ['a'] });
  });

  it('拖到容器本身最後面:接在最後', () => {
    expect(moveCharacterInContainers(base, 'd', 'x', null).x).toEqual(['a', 'b', 'c', 'd']);
  });

  it('同容器往前拖:插在目標前面', () => {
    expect(moveCharacterInContainers(base, 'c', 'x', 'a').x).toEqual(['c', 'a', 'b']);
  });

  it('同容器往後拖:放在目標後面(拖到最後一格就是排到最後)', () => {
    expect(moveCharacterInContainers(base, 'a', 'x', 'c').x).toEqual(['b', 'c', 'a']);
  });

  it('找不到角色或目標容器時原樣回傳,不改動', () => {
    expect(moveCharacterInContainers(base, 'ghost', 'x', null)).toBe(base);
    expect(moveCharacterInContainers(base, 'a', 'nope', null)).toBe(base);
  });

  it('不改動傳入的物件', () => {
    const snapshot = JSON.stringify(base);
    moveCharacterInContainers(base, 'a', 'y', 'd');
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
