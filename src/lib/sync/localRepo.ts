import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { DataSnapshot } from '@/lib/sync/snapshot';

/**
 * 本機資料的存取介面：同步與合併只透過它讀寫本機資料，不直接碰 store。
 * 正式環境使用 storeRepo；同步引擎的測試可以換成記憶體版本，模擬多台裝置各自的本機資料。
 */
export interface LocalRepo {
  /** 讀取目前本機的完整快照 */
  read(): DataSnapshot;
  /** 把快照寫回本機；呼叫端必須在 read 之後同步呼叫，中間不得 await */
  write(snapshot: DataSnapshot): void;
}

/**
 * 讀寫四個 Zustand 資料 store 的 LocalRepo。
 * write 除了寫回資料與墓碑，還負責兩件不屬於資料本身的事：
 * - 目前選中的角色若已不存在，回退到第一個可用角色（沒有角色時為 null）
 * - 寫回後重新跑任務與 BOSS 的重置檢查（遠端較新的版本可能是上個週期勾選的）
 */
export const storeRepo: LocalRepo = {
  read() {
    const { characters, deletedIds: characterTombstones } = useCharacterStore.getState();
    const { tasks, deletedIds: taskTombstones } = useTaskStore.getState();
    const { bosses, deletedIds: bossTombstones } = useBossStore.getState();
    const { accounts, deletedIds: accountTombstones } = useAccountStore.getState();
    return { accounts, accountTombstones, characters, characterTombstones, tasks, taskTombstones, bosses, bossTombstones };
  },

  write(snapshot) {
    useCharacterStore.setState((state) => ({
      characters: snapshot.characters,
      deletedIds: snapshot.characterTombstones,
      activeCharacterId:
        state.activeCharacterId !== null && snapshot.characters.some((c) => c.id === state.activeCharacterId)
          ? state.activeCharacterId
          : (snapshot.characters[0]?.id ?? null),
    }));
    useTaskStore.setState({ tasks: snapshot.tasks, deletedIds: snapshot.taskTombstones });
    useBossStore.setState({ bosses: snapshot.bosses, deletedIds: snapshot.bossTombstones });
    useAccountStore.setState({ accounts: snapshot.accounts, deletedIds: snapshot.accountTombstones });

    const { settings } = useSettingsStore.getState();
    useTaskStore.getState().runResetCheck(settings);
    useBossStore.getState().runResetCheck(settings);
  },
};
