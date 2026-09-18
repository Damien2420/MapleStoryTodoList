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
      { id: expect.any(String), name: '主力練功', order: 0 },
      { id, name: '小號倉庫', order: 1 },
    ]);
  });

  it('updateAccount 只更新 name/vipTier,不動 id/order', () => {
    const id = useAccountStore.getState().addAccount({ name: '主力練功' });
    useAccountStore.getState().updateAccount(id, { name: '打工帳', vipTier: 'diamond' });

    const account = useAccountStore.getState().accounts.find((a) => a.id === id);
    expect(account).toEqual({ id, name: '打工帳', order: 0, vipTier: 'diamond' });
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
