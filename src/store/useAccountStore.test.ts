import { beforeEach, describe, expect, it } from 'vitest';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';

describe('useAccountStore', () => {
  beforeEach(() => {
    useAccountStore.setState({ accounts: [], deletedIds: [] });
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
  });

  it('addAccount 修剪名稱、回傳 id,並依目前帳號數指定 order', () => {
    useAccountStore.getState().addAccount({ name: '主力練功' });
    const id = useAccountStore.getState().addAccount({ name: '  小號倉庫  ' });

    expect(useAccountStore.getState().accounts).toEqual([
      { id: expect.any(String), name: '主力練功', order: 0, updatedAt: expect.any(String) },
      { id, name: '小號倉庫', order: 1, updatedAt: expect.any(String) },
    ]);
  });

  it('addAccount 的 order 取目前最大值 + 1,刪除過帳號後也不會與既有帳號撞號', () => {
    const a = useAccountStore.getState().addAccount({ name: 'A' });
    useAccountStore.getState().addAccount({ name: 'B' });
    useAccountStore.getState().removeAccount(a);
    const c = useAccountStore.getState().addAccount({ name: 'C' });

    expect(useAccountStore.getState().accounts.find((acc) => acc.id === c)?.order).toBe(2);
  });

  it('updateAccount 只更新 name/vipTier,不動 id/order', () => {
    const id = useAccountStore.getState().addAccount({ name: '主力練功' });
    useAccountStore.getState().updateAccount(id, { name: '打工帳', vipTier: 'diamond' });

    const account = useAccountStore.getState().accounts.find((a) => a.id === id);
    expect(account).toEqual({ id, name: '打工帳', order: 0, vipTier: 'diamond', updatedAt: expect.any(String) });
  });

  it('updateAccount 有實際改變時才更新 updatedAt', () => {
    const id = useAccountStore.getState().addAccount({ name: '主力練功' });
    const before = useAccountStore.getState().accounts[0];

    useAccountStore.getState().updateAccount(id, { name: '主力練功' });
    expect(useAccountStore.getState().accounts[0]).toBe(before);

    useAccountStore.getState().updateAccount(id, { name: '打工帳' });
    expect(Date.parse(useAccountStore.getState().accounts[0].updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
  });

  it('removeAccount 記錄墓碑,並把屬於這個帳號的角色一併改回未歸類', () => {
    const accountId = useAccountStore.getState().addAccount({ name: '主力練功' });
    const characterId = useCharacterStore.getState().addCharacter({
      name: '楓夜劍豪',
      server: '艾麗亞',
      level: 1,
      job: 'Warrior',
      source: 'manual',
    });
    useCharacterStore.getState().updateCharacter(characterId, { accountId });

    useAccountStore.getState().removeAccount(accountId);

    expect(useAccountStore.getState().accounts).toEqual([]);
    expect(useAccountStore.getState().deletedIds.map((t) => t.id)).toEqual([accountId]);
    expect(useCharacterStore.getState().characters.find((c) => c.id === characterId)?.accountId).toBeNull();
  });

  it('removeAccount 把角色改回未歸類時更新角色的 placementUpdatedAt,讓這個變更能同步到其他裝置', () => {
    const accountId = useAccountStore.getState().addAccount({ name: '主力練功' });
    const characterId = useCharacterStore.getState().addCharacter({
      name: '楓夜劍豪',
      server: '艾麗亞',
      level: 1,
      job: 'Warrior',
      source: 'manual',
      accountId,
    });
    const before = useCharacterStore.getState().characters[0];

    useAccountStore.getState().removeAccount(accountId);

    const after = useCharacterStore.getState().characters.find((c) => c.id === characterId)!;
    expect(Date.parse(after.placementUpdatedAt)).toBeGreaterThan(Date.parse(before.placementUpdatedAt));
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('reorderAccounts 依傳入的 id 順序重新指定 order', () => {
    const a = useAccountStore.getState().addAccount({ name: 'A' });
    const b = useAccountStore.getState().addAccount({ name: 'B' });
    const c = useAccountStore.getState().addAccount({ name: 'C' });

    useAccountStore.getState().reorderAccounts([c, a, b]);

    expect(useAccountStore.getState().accounts.map((acc) => [acc.id, acc.order])).toEqual([
      [c, 0],
      [a, 1],
      [b, 2],
    ]);
  });

  it('reorderAccounts 傳入的清單漏掉既有帳號時,漏掉的帳號原樣接在後面,不會被吃掉', () => {
    const a = useAccountStore.getState().addAccount({ name: 'A' });
    const b = useAccountStore.getState().addAccount({ name: 'B' });

    useAccountStore.getState().reorderAccounts([b]);

    expect(useAccountStore.getState().accounts.map((acc) => acc.id)).toEqual([b, a]);
  });
});
