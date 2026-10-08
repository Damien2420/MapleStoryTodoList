/** 同步狀態的 localStorage key；不屬於任何資料 store，也不進備份內容 */
export const SYNC_STATE_KEY = 'maplestory-todolist-sync';

/**
 * 每台裝置自己的同步狀態（同一台裝置的分頁共用）。
 * 計數器規則：使用者每修改一次資料 changeCounter +1；上傳前記下 changeCounter，上傳成功後 syncedCounter 設成記下的值。
 * 兩者不同就代表有修改還沒同步。
 */
export interface SyncState {
  /** 本機資料綁定的 Google 帳號 ID（AuthUser.sub）；沒有綁定過為 undefined */
  boundSub?: string;
  /** 上次同步時看到的雲端主檔 version */
  lastVersion?: string;
  /** 上次同步時雲端主檔的歷史版本 ID */
  lastRevisionId?: string;
  /** 這台裝置認得的 resetToken；與雲端不同代表雲端被重置過 */
  resetToken?: string;
  changeCounter: number;
  syncedCounter: number;
  /** 上次成功同步的時間（ISO 字串）；超過墓碑保留天數就不能自動合併 */
  lastSyncedAt?: string;
  /** 這台裝置知道的最後一次每日快照日期（yyyy-MM-dd） */
  dailySnapshotDate?: string;
  /** 未登入時還原過資料，下次登入要讓使用者決定是否覆蓋雲端 */
  pendingCloudOverwrite?: { restoredAt: string };
}

/** 同步狀態的讀寫介面；正式環境存在 localStorage，測試用記憶體版本模擬各台裝置 */
export interface SyncStateStore {
  read(): SyncState;
  /** 合併更新；值為 undefined 的欄位等同移除 */
  update(patch: Partial<SyncState> | ((current: SyncState) => Partial<SyncState>)): void;
  /** 清除全部狀態（登出並刪除本機紀錄時使用） */
  clear(): void;
}

const DEFAULT_STATE: SyncState = { changeCounter: 0, syncedCounter: 0 };

/** 是否有修改還沒同步到雲端 */
export function isPending(state: SyncState): boolean {
  return state.changeCounter !== state.syncedCounter;
}

function applyPatch(current: SyncState, patch: Partial<SyncState> | ((current: SyncState) => Partial<SyncState>)): SyncState {
  return { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
}

/**
 * 記憶體版的同步狀態，供測試模擬各台裝置。
 * @param initial 初始值，未指定的計數器為 0
 */
export function createMemorySyncState(initial: Partial<SyncState> = {}): SyncStateStore {
  let state: SyncState = { ...DEFAULT_STATE, ...initial };
  return {
    read: () => state,
    update: (patch) => {
      state = applyPatch(state, patch);
    },
    clear: () => {
      state = { ...DEFAULT_STATE };
    },
  };
}

/**
 * 存在 localStorage 的同步狀態。每次讀取都直接讀 localStorage（不快取），同一台裝置的其他分頁立即看得到最新值。
 * @param storage 測試時可替換
 * @param key localStorage key
 */
export function createLocalStorageSyncState(storage: Storage = localStorage, key: string = SYNC_STATE_KEY): SyncStateStore {
  const read = (): SyncState => {
    try {
      const raw = storage.getItem(key);
      return raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<SyncState>) } : { ...DEFAULT_STATE };
    } catch {
      return { ...DEFAULT_STATE };
    }
  };
  return {
    read,
    update: (patch) => {
      storage.setItem(key, JSON.stringify(applyPatch(read(), patch)));
    },
    clear: () => {
      storage.removeItem(key);
    },
  };
}
