import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { isWeaponTracked, useWeaponStore } from '@/store/useWeaponStore';
import { deriveClears } from './deriveClears';

/** 暴風修練只在挑戰者伺服器有效 */
export const STORM_TRAINING_SERVER = '挑戰者';

/** 依目前的勾選框,替所有已開啟武器追蹤的角色重建本週期的紀錄 */
export function syncWeaponClears(now: Date = new Date()): void {
  const weapon = useWeaponStore.getState();
  const { bosses } = useBossStore.getState();
  const { tasks } = useTaskStore.getState();
  const { settings } = useSettingsStore.getState();
  const characterIds = new Set(useCharacterStore.getState().characters.map((c) => c.id));

  const bossOut = [];
  const dailyOut = [];
  for (const characterId of characterIds) {
    if (!isWeaponTracked(weapon, characterId)) continue;
    const profile = weapon.profiles.find((p) => p.id === characterId) ?? { genesisPass: false, stormTraining: false };
    const result = deriveClears({
      characterId,
      bosses: bosses.filter((b) => b.characterId === characterId),
      tasks: tasks.filter((t) => t.characterId === characterId),
      bossClears: weapon.bossClears.filter((c) => c.characterId === characterId),
      dailyClears: weapon.dailyClears.filter((d) => d.characterId === characterId),
      profile,
      settings,
      now,
    });
    bossOut.push(...result.bossClears);
    dailyOut.push(...result.dailyClears);
  }
  weapon.upsertClears(bossOut, dailyOut);
}

/** 角色的伺服器離開挑戰者時,自動取消暴風修練(手動編輯與 API 更新都會經過角色 store) */
export function cancelStormTrainingOffChallenger(): void {
  const weapon = useWeaponStore.getState();
  const characters = useCharacterStore.getState().characters;
  for (const profile of weapon.profiles) {
    if (!profile.stormTraining) continue;
    const character = characters.find((c) => c.id === profile.id);
    if (character && character.server !== STORM_TRAINING_SERVER) weapon.setProfile(profile.id, { stormTraining: false });
  }
}

type HydratableStore = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

/** 等所有 store 都從 localStorage 讀完才開始,避免把「還沒讀到的空資料」當成取消勾選 */
function whenHydrated(stores: HydratableStore[], fn: () => void): void {
  let done = false;
  const once = () => {
    if (done || !stores.every((s) => s.persist.hasHydrated())) return;
    done = true;
    fn();
  };
  stores.forEach((s) => s.persist.onFinishHydration(once));
  once();
}

let started = false;

/**
 * 啟動武器紀錄的同步:勾選框(BOSS、任務)、武器設定或事件一有變動,就依目前勾選狀態重建本週期的紀錄;
 * 同時訂閱角色 store,伺服器離開挑戰者時取消暴風修練。只會啟動一次
 */
export function startWeaponSync(): void {
  if (started) return;
  started = true;
  whenHydrated([useBossStore, useTaskStore, useCharacterStore, useWeaponStore], () => {
    // 其他分頁改了資料觸發 rehydrate 期間,store 暫時是舊資料,不同步
    const ready = () => [useBossStore, useTaskStore, useCharacterStore, useWeaponStore].every((s) => s.persist.hasHydrated());
    const sync = () => {
      if (ready()) syncWeaponClears();
    };
    useBossStore.subscribe((s, prev) => s.bosses !== prev.bosses && sync());
    useTaskStore.subscribe((s, prev) => s.tasks !== prev.tasks && sync());
    useWeaponStore.subscribe((s, prev) => (s.profiles !== prev.profiles || s.events !== prev.events) && sync());
    useCharacterStore.subscribe((s, prev) => {
      if (s.characters !== prev.characters && ready()) cancelStormTrainingOffChallenger();
    });
    cancelStormTrainingOffChallenger();
    syncWeaponClears();
  });
}
