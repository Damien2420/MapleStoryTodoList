import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '@/types';
import { useCharacterStore } from '@/store/useCharacterStore';
import { trackLocalChange } from '@/lib/trackLocalChange';
import { syncAcrossTabs } from '@/lib/crossTabSync';
import { recordTombstone, type Tombstone } from '@/lib/tombstone';

/** 更新帳號時可覆寫的欄位:名稱與 VIP 等級 */
export type AccountUpdateInput = Partial<Pick<Account, 'name' | 'vipTier'>>;

interface AccountState {
  accounts: Account[];
  deletedIds: Tombstone[];
  /** 新增帳號,回傳新帳號的 id */
  addAccount: (input: { name: string }) => string;
  /** 更新既有帳號的部分欄位(重新命名、調整 VIP 等級) */
  updateAccount: (id: string, patch: AccountUpdateInput) => void;
  /** 刪除帳號,原本屬於這個帳號的角色一併改回未歸類(accountId: null),避免留下懸空的 accountId */
  removeAccount: (id: string) => void;
  /** 依傳入的 id 順序重新指定每個帳號的 order */
  reorderAccounts: (orderedIds: string[]) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      deletedIds: [],
      addAccount: (input) => {
        const trimmed = input.name.trim();
        if (!trimmed) return '';
        const account: Account = {
          id: crypto.randomUUID(),
          name: trimmed,
          order: get().accounts.length,
        };
        set((state) => ({ accounts: [...state.accounts, account] }));
        return account.id;
      },
      updateAccount: (id, patch) => {
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
      },
      removeAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          deletedIds: recordTombstone(state.deletedIds, id),
        }));
        useCharacterStore.setState((state) => ({
          characters: state.characters.map((c) => (c.accountId === id ? { ...c, accountId: null } : c)),
        }));
      },
      reorderAccounts: (orderedIds) => {
        set((state) => {
          const byId = new Map(state.accounts.map((a) => [a.id, a]));
          const reordered = orderedIds
            .map((id) => byId.get(id))
            .filter((a): a is Account => a !== undefined)
            .map((a, index) => ({ ...a, order: index }));
          // 防呆:傳入清單漏掉既有帳號時(理論上不該發生),原樣接在後面,避免資料被吃掉
          const reorderedIds = new Set(orderedIds);
          const missing = state.accounts.filter((a) => !reorderedIds.has(a.id));
          return { accounts: [...reordered, ...missing] };
        });
      },
    }),
    {
      name: 'maplestory-todolist-accounts',
      // schema 版本:改動 Account 持久化結構時 version +1 並補 migrate,
      // 且需同步檢查 backupPayload.ts 的 CURRENT_VERSION/MIGRATIONS 是否也要升版
      version: 0,
    },
  ),
);

trackLocalChange(useAccountStore, (s) => s.accounts);
syncAcrossTabs(useAccountStore, 'maplestory-todolist-accounts');
