import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWeaponStore } from '@/store/useWeaponStore';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { withDeriveSuspended } from '@/lib/weapon/deriveGate';
import { cancelStormTrainingOffChallenger, derivedNeedsPush, syncWeaponClears } from '@/lib/weapon/syncClears';

let applyingSyncWrite = false;

/**
 * storeRepo.write 執行期間為 true。變動追蹤據此排除同步引擎寫回的合併結果（含寫回後的重置檢查），
 * 只把使用者自己的操作算成「有修改待同步」。
 */
export function isApplyingSyncWrite(): boolean {
  return applyingSyncWrite;
}

/**
 * 本機資料的存取介面：同步與合併只透過它讀寫本機資料，不直接碰 store。
 * 正式環境使用 storeRepo；同步引擎的測試可以換成記憶體版本，模擬多台裝置各自的本機資料。
 */
export interface LocalRepo {
  /** 讀取目前本機的完整快照 */
  read(): DataSnapshot;
  /**
   * 把快照寫回本機；呼叫端必須在 read 之後同步呼叫，中間不得 await。
   * @returns 寫回後本機自行衍生出需要推送的變更時回傳 true（呼叫端負責標記待推送）
   */
  write(snapshot: DataSnapshot): boolean;
}

/**
 * 讀寫帳號、角色、任務、BOSS 與武器 store 的 LocalRepo。
 * write 除了寫回資料與墓碑，還負責兩件不屬於資料本身的事：
 * - 目前選中的角色若已不存在，回退到第一個可用角色（沒有角色時為 null）
 * - 寫回後重新跑任務與 BOSS 的重置檢查（遠端較新的版本可能是上個週期勾選的）
 * - 寫回期間暫停武器的衍生計算，全部寫完後依合併結果衍生一次，回傳是否需要推送
 */
export const storeRepo: LocalRepo = {
  read() {
    const { characters, deletedIds: characterTombstones } = useCharacterStore.getState();
    const { tasks, deletedIds: taskTombstones } = useTaskStore.getState();
    const { bosses, deletedIds: bossTombstones } = useBossStore.getState();
    const { accounts, deletedIds: accountTombstones } = useAccountStore.getState();
    const { profiles, bossClears, dailyClears, events, checkpoints, deletedIds: weaponTombstones } = useWeaponStore.getState();
    return {
      accounts,
      accountTombstones,
      characters,
      characterTombstones,
      tasks,
      taskTombstones,
      bosses,
      bossTombstones,
      weapons: { profiles, bossClears, dailyClears, events, checkpoints, tombstones: weaponTombstones },
    };
  },

  write(snapshot) {
    applyingSyncWrite = true;
    try {
      withDeriveSuspended(() => {
        const w = snapshot.weapons;
        useWeaponStore.setState({
          profiles: w.profiles,
          bossClears: w.bossClears,
          dailyClears: w.dailyClears,
          events: w.events,
          checkpoints: w.checkpoints,
          deletedIds: w.tombstones,
        });
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
      });
      // 所有資料都寫完才衍生：即使勾選框的陣列參照沒變（訂閱不會觸發），也會補上被墓碑刪掉但仍勾著的紀錄
      cancelStormTrainingOffChallenger();
      return derivedNeedsPush(snapshot.weapons, syncWeaponClears());
    } finally {
      applyingSyncWrite = false;
    }
  },
};
