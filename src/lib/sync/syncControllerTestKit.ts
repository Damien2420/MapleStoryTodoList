import { vi, type Mock } from 'vitest';
import { AuthError, type AuthUser } from '@/lib/auth/authClient';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import type { LocalRestorePointStore } from '@/lib/sync/restorePoints';
import { createSyncController, type SyncController } from '@/lib/sync/syncController';
import { createSyncScheduler, type SyncScheduler, type SyncTriggers } from '@/lib/sync/syncScheduler';
import { isPending } from '@/lib/sync/syncState';
import { createActionDeps, createDevice, type Device, type DeviceOptions } from '@/lib/sync/syncTestKit';

/** 模擬裝置預設綁定的帳號（與 syncTestKit 的預設 sub 相同） */
export const TEST_USER: AuthUser = { sub: 'user-1', email: 'player@example.com', name: '玩家' };

/** 測試不觸發瀏覽器事件，同步只靠排程器啟動時的第一輪與 syncNow */
const NO_TRIGGERS: SyncTriggers = {
  onVisible: () => () => undefined,
  onHidden: () => () => undefined,
  onFocus: () => () => undefined,
  onOnline: () => () => undefined,
};

export interface HarnessOptions extends Omit<DeviceOptions, 'getUser'> {
  /** 與其他模擬裝置共用雲端時傳入 */
  cloud?: FakeCloudStore;
  /** 開始時後端是否有登入 cookie（預設 true） */
  signedIn?: boolean;
}

export interface ControllerHarness {
  cloud: FakeCloudStore;
  device: Device;
  controller: SyncController;
  auth: {
    signedIn: boolean;
    signIn: Mock<() => Promise<AuthUser>>;
    getUser: Mock<() => Promise<AuthUser>>;
    signOut: Mock<() => Promise<void>>;
  };
  localRestorePoint: LocalRestorePointStore;
  notify: { applied: Mock; error: Mock<(message: string) => void>; success: Mock<(message: string) => void> };
  clearWeaponProgress: Mock<() => void>;
  /** 停止排程器（afterEach 呼叫，避免計時器跨測試觸發） */
  dispose(): void;
}

/**
 * 用假雲端、模擬裝置與真的排程器組出控制器，供控制器與元件測試使用。
 * 授權是假的：signIn 會讓後端進入登入狀態，signOut 會清掉，getUser 在未登入時丟出 signedOut。
 */
export function createControllerHarness(options: HarnessOptions = {}): ControllerHarness {
  const cloud = options.cloud ?? new FakeCloudStore();
  const auth: ControllerHarness['auth'] = {
    signedIn: options.signedIn ?? true,
    signIn: vi.fn(async () => {
      auth.signedIn = true;
      return TEST_USER;
    }),
    getUser: vi.fn(async () => {
      if (!auth.signedIn) throw new AuthError('signedOut', 'not signed in');
      return TEST_USER;
    }),
    signOut: vi.fn(async () => {
      auth.signedIn = false;
    }),
  };
  const device = createDevice(cloud, { ...options, getUser: () => auth.getUser() });
  const action = createActionDeps(device);
  let scheduler: SyncScheduler | undefined;
  const stopSync = () => {
    scheduler?.stop();
    scheduler = undefined;
  };
  const notify = { applied: vi.fn(), error: vi.fn<(message: string) => void>(), success: vi.fn<(message: string) => void>() };
  const clearWeaponProgress = vi.fn<() => void>();
  const controller = createSyncController({
    auth,
    actions: { ...action.deps, signOut: () => auth.signOut() },
    startSync: (handlers) => {
      stopSync();
      scheduler = createSyncScheduler({
        engine: device.engine,
        isPending: () => isPending(device.state.read()),
        triggers: NO_TRIGGERS,
        ...handlers,
      });
      scheduler.start();
      return scheduler;
    },
    stopSync,
    clearWeaponProgress,
    notify,
  });
  return { cloud, device, controller, auth, localRestorePoint: action.localRestorePoint, notify, clearWeaponProgress, dispose: stopSync };
}
