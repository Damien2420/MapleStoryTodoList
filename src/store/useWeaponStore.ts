import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import { syncAcrossTabs } from '@/lib/crossTabSync';
import { isQuotaError } from '@/lib/quotaError';
import type { Tombstone } from '@/lib/tombstone';
import { compactCharacter, compactWatermark } from '@/lib/weapon/compact';
import { sanitizeWeaponSnapshot } from '@/lib/weapon/sanitize';
import type { BossClear, DailyClear, WeaponCheckpoint, WeaponEvent, WeaponProfile } from '@/lib/weapon/types';
import type { Settings } from '@/types';

/** 武器 store 的 localStorage key */
export const WEAPON_STORAGE_KEY = 'maplestory-todolist-weapons';

interface WeaponState {
  /** 每角色一筆:創世通行證、暴風修練 */
  profiles: WeaponProfile[];
  /** 每角色、每 BOSS 種類、每週期一筆 */
  bossClears: BossClear[];
  /** 每角色、每天一筆 */
  dailyClears: DailyClear[];
  /** 初始設定、校正、升階、標記完成、命運開始第二階段 */
  events: WeaponEvent[];
  /** 每角色一筆存檔點 */
  checkpoints: WeaponCheckpoint[];
  /** 武器墓碑：只由還原產生，id = weaponTombstoneId(kind, 紀錄 id)；同步合併時傳到其他裝置 */
  deletedIds: Tombstone[];
  /** 修改角色的加成設定(沒有設定時建立) */
  setProfile: (characterId: string, patch: Partial<Pick<WeaponProfile, 'genesisPass' | 'stormTraining'>>) => void;
  /** 新增事件;id 相同時取代(升階 id 固定,重複升階只會留一筆) */
  addEvent: (event: WeaponEvent) => void;
  /** 寫入 deriveClears 的結果,以 id upsert */
  upsertClears: (bossClears: BossClear[], dailyClears: DailyClear[]) => void;
  /** 把超過寬限期的紀錄折入存檔點;回傳是否有壓縮(沒有可壓縮的資料時不寫入) */
  compact: (now: Date, settings: Settings) => boolean;
  /** 刪除角色時一併清除該角色的武器資料 */
  removeCharacter: (characterId: string) => void;
  /** 刪除全部紀錄 */
  clearAll: () => void;
}

/** 依 id 合併:incoming 取代同 id 的舊資料,新的接在後面 */
function upsertById<T extends { id: string }>(list: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return list;
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const merged = list.map((x) => byId.get(x.id) ?? x);
  const existing = new Set(list.map((x) => x.id));
  return [...merged, ...incoming.filter((x) => !existing.has(x.id))];
}

let quotaWarned = false;

/**
 * 包一層 localStorage:寫入超過容量(QuotaExceededError)時跳出提示,不讓錯誤丟到 React 事件處理器;
 * 提示只出現一次,避免每次勾選都跳
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      if (!quotaWarned) {
        quotaWarned = true;
        toast.error('瀏覽器儲存空間已滿，武器進度沒有儲存', {
          description: '請到「資料管理」下載備份後清理不需要的角色，或清除其他網站的資料。',
        });
      }
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export const useWeaponStore = create<WeaponState>()(
  persist(
    (set, get) => ({
      profiles: [],
      bossClears: [],
      dailyClears: [],
      events: [],
      checkpoints: [],
      deletedIds: [],
      setProfile: (characterId, patch) => {
        set((state) => {
          const now = new Date().toISOString();
          const prev = state.profiles.find((p) => p.id === characterId);
          const next: WeaponProfile = { id: characterId, genesisPass: false, stormTraining: false, ...prev, ...patch, updatedAt: now };
          if (prev && prev.genesisPass === next.genesisPass && prev.stormTraining === next.stormTraining) return state;
          return { profiles: upsertById(state.profiles, [next]) };
        });
      },
      addEvent: (event) => set((state) => ({ events: upsertById(state.events, [event]) })),
      upsertClears: (bossClears, dailyClears) => {
        if (bossClears.length === 0 && dailyClears.length === 0) return;
        set((state) => ({
          bossClears: upsertById(state.bossClears, bossClears),
          dailyClears: upsertById(state.dailyClears, dailyClears),
        }));
      },
      compact: (now, settings) => {
        const state = get();
        const watermark = compactWatermark(now, settings);
        const characterIds = new Set([...state.events, ...state.bossClears, ...state.dailyClears].map((x) => x.characterId));
        const nowIso = now.toISOString();
        const removeBoss = new Set<string>();
        const removeDaily = new Set<string>();
        const removeEvents = new Set<string>();
        const checkpoints: WeaponCheckpoint[] = [];
        for (const characterId of characterIds) {
          const result = compactCharacter(
            {
              characterId,
              checkpoint: state.checkpoints.find((c) => c.id === characterId),
              bossClears: state.bossClears.filter((c) => c.characterId === characterId),
              dailyClears: state.dailyClears.filter((d) => d.characterId === characterId),
              events: state.events.filter((e) => e.characterId === characterId),
            },
            watermark,
            settings,
            nowIso,
          );
          if (!result) continue;
          checkpoints.push(result.checkpoint);
          result.removeBossClearIds.forEach((id) => removeBoss.add(id));
          result.removeDailyClearIds.forEach((id) => removeDaily.add(id));
          result.removeEventIds.forEach((id) => removeEvents.add(id));
        }
        if (checkpoints.length === 0) return false;
        // 新存檔點與刪除舊紀錄在同一次 set 完成,不會出現「紀錄刪了、存檔點還沒寫」的中間狀態
        set((s) => ({
          checkpoints: upsertById(s.checkpoints, checkpoints),
          bossClears: s.bossClears.filter((c) => !removeBoss.has(c.id)),
          dailyClears: s.dailyClears.filter((d) => !removeDaily.has(d.id)),
          events: s.events.filter((e) => !removeEvents.has(e.id)),
        }));
        return true;
      },
      removeCharacter: (characterId) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== characterId),
          bossClears: s.bossClears.filter((c) => c.characterId !== characterId),
          dailyClears: s.dailyClears.filter((d) => d.characterId !== characterId),
          events: s.events.filter((e) => e.characterId !== characterId),
          checkpoints: s.checkpoints.filter((c) => c.id !== characterId),
        })),
      clearAll: () => set({ profiles: [], bossClears: [], dailyClears: [], events: [], checkpoints: [], deletedIds: [] }),
    }),
    {
      name: WEAPON_STORAGE_KEY,
      storage: createJSONStorage(() => safeLocalStorage),
      // schema 版本:改動持久化結構時 version +1 並補 migrate;武器資料也在備份與同步的快照裡,欄位變動時一併檢查 backupPayload.ts 與 sanitize.ts
      version: 2,
      // v1 → v2 只新增 deletedIds,由 merge 補上空陣列;其他欄位不變
      migrate: (persisted) => persisted as WeaponState,
      // localStorage 的內容可能被手動改過或損毀:載入時驗證形狀,壞掉的欄位退回預設值,不讓整個頁面崩潰
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
        // store 的墓碑欄位叫 deletedIds(與其他 store 一致),快照裡叫 tombstones
        const { tombstones, ...data } = sanitizeWeaponSnapshot({ ...p, tombstones: p.deletedIds });
        return { ...current, ...data, deletedIds: tombstones };
      },
      partialize: (s) => ({
        profiles: s.profiles,
        bossClears: s.bossClears,
        dailyClears: s.dailyClears,
        events: s.events,
        checkpoints: s.checkpoints,
        deletedIds: s.deletedIds,
      }),
    },
  ),
);

syncAcrossTabs(useWeaponStore, WEAPON_STORAGE_KEY);

/**
 * 角色是否已開啟武器追蹤(已完成任一武器的初始設定);只有開啟的角色才會寫入擊破紀錄
 * @param state 武器 store 狀態
 * @param characterId 角色 id
 */
export function isWeaponTracked(state: Pick<WeaponState, 'events' | 'checkpoints'>, characterId: string): boolean {
  if (state.events.some((e) => e.characterId === characterId && (e.kind === 'adjust' || e.kind === 'complete'))) return true;
  const cp = state.checkpoints.find((c) => c.id === characterId);
  return !!cp && Object.values(cp.state).some((w) => w.status !== 'unset');
}
