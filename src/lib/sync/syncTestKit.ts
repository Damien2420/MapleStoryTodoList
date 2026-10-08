import type { Character, CharacterTask } from '@/types';
import type { AuthUser } from '@/lib/auth/authClient';
import { CURRENT_VERSION, buildBackupPayload } from '@/lib/backupPayload';
import type { CloudFileMeta, CloudStore } from '@/lib/sync/cloud/cloudStore';
import type { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { LATEST_FILE, parseCloudDocument, type CloudDocument } from '@/lib/sync/cloudDocument';
import type { LocalRepo } from '@/lib/sync/localRepo';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { createMemorySyncState, type SyncState, type SyncStateStore } from '@/lib/sync/syncState';
import { createSyncEngine, type SyncEngine, type SyncEngineDeps } from '@/lib/sync/syncEngine';
import type { SyncActionDeps } from '@/lib/sync/actionDeps';
import { createMemoryRestorePointStore, type LocalRestorePointStore } from '@/lib/sync/restorePoints';

/** 測試的基準時間（台灣時間 2026-10-08 12:00） */
export const T0 = new Date('2026-10-08T04:00:00.000Z');
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 可手動推進的時鐘，多台模擬裝置可以共用同一個 */
export interface Clock {
  now(): Date;
  advance(ms: number): void;
}

export function createClock(start: Date = T0): Clock {
  let time = start.getTime();
  return {
    now: () => new Date(time),
    advance: (ms) => {
      time += ms;
    },
  };
}

export function emptySnapshot(overrides: Partial<DataSnapshot> = {}): DataSnapshot {
  return {
    accounts: [],
    accountTombstones: [],
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
    ...overrides,
  };
}

export function character(id: string, updatedAt: string = T0.toISOString(), overrides: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    server: '艾麗亞',
    level: 1,
    job: 'Warrior',
    order: 0,
    source: 'manual',
    accountId: null,
    updatedAt,
    placementUpdatedAt: updatedAt,
    ...overrides,
  };
}

export function task(id: string, characterId: string, updatedAt: string = T0.toISOString()): CharacterTask {
  return {
    id,
    characterId,
    name: id,
    category: '日常',
    resetCycle: 'once',
    checked: false,
    lastResetAt: updatedAt,
    order: 0,
    updatedAt,
  };
}

/** 記憶體版 LocalRepo，代表一台裝置的本機資料 */
export function createMemoryRepo(initial: DataSnapshot = emptySnapshot()): LocalRepo {
  let current = initial;
  return {
    read: () => current,
    write: (snapshot) => {
      current = snapshot;
    },
  };
}

/** 直接在雲端建立一份主檔（模擬其他裝置或舊版程式寫入的內容）；version 可指定成比程式新的格式 */
export function seedCloud(
  cloud: CloudStore,
  doc: { snapshot: DataSnapshot; resetToken?: string; dailySnapshotDate?: string; version?: number },
): Promise<CloudFileMeta> {
  const body = {
    ...buildBackupPayload(doc.snapshot),
    version: doc.version ?? CURRENT_VERSION,
    resetToken: doc.resetToken,
    dailySnapshotDate: doc.dailySnapshotDate,
  };
  return cloud.create(LATEST_FILE, JSON.stringify(body));
}

/** 讀出假雲端上指定檔名（最早建立的那個）目前的內容 */
export function cloudDocument(cloud: FakeCloudStore, name: string = LATEST_FILE): CloudDocument {
  const content = cloud.contentOf(name);
  if (content === undefined) throw new Error(`雲端沒有 ${name}`);
  return parseCloudDocument(content);
}

/** 依 id 排序後的 id 清單，方便比較 */
export function ids(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id).sort();
}

/** 一台模擬裝置：自己的本機資料、自己的同步狀態、自己的引擎，共用同一個雲端 */
export interface Device {
  repo: LocalRepo;
  state: SyncStateStore;
  engine: SyncEngine;
  /** 建立引擎時使用的依賴，供動作函式組出 SyncActionDeps */
  deps: SyncEngineDeps;
  /** 引擎呼叫 sleep 的毫秒數紀錄 */
  sleeps: number[];
  /** 模擬使用者修改資料：寫回本機並把修改計數器 +1 */
  edit(change: (snapshot: DataSnapshot) => DataSnapshot): void;
}

export interface DeviceOptions {
  /** 登入的帳號 ID，預設 user-1 */
  sub?: string;
  data?: DataSnapshot;
  /** 初始同步狀態；預設已綁定 sub、剛同步過 */
  state?: Partial<SyncState>;
  clock?: Clock;
  /** 這台裝置產生的 resetToken 前綴，預設 token（產生 token-1、token-2…） */
  tokenPrefix?: string;
  /** 取代預設的取得帳號函式，用來模擬授權錯誤 */
  getUser?: () => Promise<AuthUser>;
}

export function createDevice(cloud: CloudStore, options: DeviceOptions = {}): Device {
  const clock = options.clock ?? createClock();
  const sub = options.sub ?? 'user-1';
  const repo = createMemoryRepo(options.data ?? emptySnapshot());
  const state = createMemorySyncState({ boundSub: sub, lastSyncedAt: clock.now().toISOString(), ...options.state });
  const sleeps: number[] = [];
  let tokenCount = 0;
  const deps: SyncEngineDeps = {
    cloud,
    local: repo,
    state,
    auth: { getUser: options.getUser ?? (async () => ({ sub, email: `${sub}@example.com` })) },
    withLock: (_name, run) => run(),
    now: () => clock.now(),
    newResetToken: () => `${options.tokenPrefix ?? 'token'}-${++tokenCount}`,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  const engine = createSyncEngine(deps);
  return {
    repo,
    state,
    engine,
    deps,
    sleeps,
    edit(change) {
      repo.write(change(repo.read()));
      state.update((current) => ({ changeCounter: current.changeCounter + 1 }));
    },
  };
}

/** 動作函式的測試依賴：沿用裝置的引擎與狀態，另外提供記憶體版本機還原點、可預測的 id 與記錄登出次數 */
export function createActionDeps(device: Device): {
  deps: SyncActionDeps;
  localRestorePoint: LocalRestorePointStore;
  signOutCalls(): number;
} {
  let signOuts = 0;
  let idCount = 0;
  const localRestorePoint = createMemoryRestorePointStore();
  return {
    deps: {
      ...device.deps,
      engine: device.engine,
      localRestorePoint,
      newId: () => `new-${++idCount}`,
      signOut: async () => {
        signOuts += 1;
      },
    },
    localRestorePoint,
    signOutCalls: () => signOuts,
  };
}
