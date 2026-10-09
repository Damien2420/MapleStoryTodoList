import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@/lib/auth/authClient';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { DAILY_SNAPSHOT_FILE, RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import { deleteAllRecords } from '@/lib/sync/deleteActions';
import { serializeBackup } from '@/lib/sync/restorePoints';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { createControllerHarness, TEST_USER, type ControllerHarness, type HarnessOptions } from '@/lib/sync/syncControllerTestKit';
import { T0, character, cloudDocument, createActionDeps, createDevice, emptySnapshot, ids, seedCloud } from '@/lib/sync/syncTestKit';
import { adjust, at } from '@/lib/weapon/testUtils';

const withCharacters = (...names: string[]): DataSnapshot => emptySnapshot({ characters: names.map((n) => character(n)) });
const addCharacter = (id: string) => (s: DataSnapshot) => ({ ...s, characters: [...s.characters, character(id)] });
const withWeapon = (s: DataSnapshot): DataSnapshot => ({
  ...s,
  weapons: { ...s.weapons, events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 })] },
});
const UNBOUND = { boundSub: undefined };
const FILE = { kind: 'file' as const, savedAt: T0.toISOString() };

const harnesses: ControllerHarness[] = [];
function harness(options: HarnessOptions = {}): ControllerHarness {
  const h = createControllerHarness(options);
  harnesses.push(h);
  return h;
}

afterEach(() => {
  for (const h of harnesses.splice(0)) h.dispose();
});

/** 已登入、已綁定並完成第一輪同步的裝置 */
async function syncedHarness(options: HarnessOptions = {}): Promise<ControllerHarness> {
  const h = harness(options);
  await h.controller.boot();
  await vi.waitFor(() => expect(h.controller.store.getState().status).toEqual({ kind: 'synced' }));
  return h;
}

const view = (h: ControllerHarness) => h.controller.store.getState();

describe('開機', () => {
  it('後端沒有登入 cookie：顯示未登入，不啟動同步也不提示錯誤', async () => {
    const h = harness({ signedIn: false });
    await h.controller.boot();
    expect(view(h).auth).toEqual({ kind: 'signedOut' });
    expect(view(h).status).toBeUndefined();
    expect(h.notify.error).not.toHaveBeenCalled();
  });

  it('已綁定的帳號：顯示帳號、開始同步並記下同步時間', async () => {
    const h = await syncedHarness({ data: withCharacters('c1') });
    expect(view(h).auth).toEqual({ kind: 'signedIn', user: TEST_USER });
    expect(view(h).lastSyncedAt).toBeDefined();
    expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['c1']);
  });

  it('refresh token 失效：顯示需要重新連線，不啟動同步', async () => {
    const h = harness();
    h.auth.getUser.mockRejectedValueOnce(new AuthError('reconnectRequired', 'x'));
    await h.controller.boot();
    expect(view(h)).toMatchObject({ auth: { kind: 'signedIn' }, status: { kind: 'reconnectRequired' } });
  });

  it('暫時連不上且本機有待覆蓋雲端：不啟動同步，顯示離線', async () => {
    const h = harness({ state: { pendingCloudOverwrite: { restoredAt: T0.toISOString() } } });
    h.auth.getUser.mockRejectedValueOnce(new AuthError('network', 'x'));
    await h.controller.boot();
    expect(view(h).status).toEqual({ kind: 'offline' });
    expect(h.cloud.countFiles('backup-latest.json')).toBe(0);
  });
});

describe('登入與首次登入對話框', () => {
  async function firstLoginHarness(): Promise<ControllerHarness> {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const h = harness({ cloud, signedIn: false, data: withCharacters('mine'), state: UNBOUND });
    await h.controller.boot();
    await h.controller.signIn();
    return h;
  }

  it('兩邊都有資料時跳出首次登入對話框；選雲端後本機換成雲端資料並開始同步', async () => {
    const h = await firstLoginHarness();
    expect(view(h).dialog).toMatchObject({ kind: 'firstLogin', reason: 'firstLogin' });
    await h.controller.chooseCloud();
    expect(view(h).dialog).toBeUndefined();
    expect(ids(h.device.repo.read().characters)).toEqual(['remote']);
    await vi.waitFor(() => expect(view(h).status).toEqual({ kind: 'synced' }));
  });

  it('選合併：同步後兩邊的資料都保留', async () => {
    const h = await firstLoginHarness();
    await h.controller.chooseMerge();
    await vi.waitFor(() => expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['mine', 'remote']));
  });

  it('關閉對話框：登出，本機資料與綁定都不變', async () => {
    const h = await firstLoginHarness();
    await h.controller.dismissDialog();
    expect(view(h)).toMatchObject({ auth: { kind: 'signedOut' }, dialog: undefined });
    expect(h.auth.signOut).toHaveBeenCalledTimes(1);
    expect(ids(h.device.repo.read().characters)).toEqual(['mine']);
    expect(h.device.state.read().boundSub).toBeUndefined();
  });

  it('登入後到第一輪同步結束前標記為載入中；之後的定期同步不會再標記', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const h = harness({ cloud, signedIn: false, state: UNBOUND });
    await h.controller.boot();
    expect(view(h).initialSyncPending).toBe(false);

    const seen = [view(h).initialSyncPending];
    const unsubscribe = h.controller.store.subscribe((s) => {
      if (seen.at(-1) !== s.initialSyncPending) seen.push(s.initialSyncPending);
    });
    await h.controller.signIn();
    await vi.waitFor(() => expect(view(h).status).toEqual({ kind: 'synced' }));
    expect(seen).toEqual([false, true, false]);
    expect(ids(h.device.repo.read().characters)).toEqual(['remote']);

    await h.controller.syncNow();
    unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it('跳出首次登入對話框或登入後無法連線時解除載入中', async () => {
    const h = await firstLoginHarness();
    expect(view(h).initialSyncPending).toBe(false);

    const offline = harness({ signedIn: false, state: UNBOUND });
    await offline.controller.boot();
    offline.cloud.failNext('findFiles', new CloudError('network', 'offline'));
    await offline.controller.signIn();
    expect(view(offline)).toMatchObject({ auth: { kind: 'signedIn' }, initialSyncPending: false });
  });

  it('登入後檢查雲端時授權失效：顯示需要重新連線而不是離線；後端已登出時顯示未登入', async () => {
    const unauthorized = harness({ signedIn: false, state: UNBOUND });
    await unauthorized.controller.boot();
    unauthorized.cloud.failNext('findFiles', new CloudError('unauthorized', '401'));
    await unauthorized.controller.signIn();
    expect(view(unauthorized)).toMatchObject({ auth: { kind: 'signedIn' }, status: { kind: 'reconnectRequired' } });
    expect(unauthorized.notify.error).toHaveBeenCalledWith('Google 雲端硬碟的授權已失效，請重新連線');

    const signedOut = harness({ signedIn: false, state: UNBOUND });
    await signedOut.controller.boot();
    signedOut.auth.getUser.mockRejectedValueOnce(new AuthError('signedOut', 'x'));
    await signedOut.controller.signIn();
    expect(view(signedOut)).toMatchObject({ auth: { kind: 'signedOut' }, status: undefined });
  });

  it('使用者自己關閉 Google 登入視窗：維持未登入，不提示錯誤', async () => {
    const h = harness({ signedIn: false });
    await h.controller.boot();
    h.auth.signIn.mockRejectedValueOnce(new AuthError('popupClosed', 'x'));
    await h.controller.signIn();
    expect(view(h).auth).toEqual({ kind: 'signedOut' });
    expect(h.notify.error).not.toHaveBeenCalled();
  });

  it('3-3：未登入時還原過，登入後跳出比較；關閉時登出並保留待覆蓋雲端，選這台裝置後雲端換成還原結果', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const h = harness({ cloud, signedIn: false, data: withCharacters('before') });
    await h.controller.boot();
    await h.controller.startRestore(withCharacters('restored'), FILE);
    await h.controller.confirmRestore();
    expect(h.device.state.read().pendingCloudOverwrite).toBeDefined();

    await h.controller.signIn();
    expect(view(h).dialog).toMatchObject({ kind: 'confirmOverwrite' });
    await h.controller.dismissDialog();
    expect(view(h).auth).toEqual({ kind: 'signedOut' });
    expect(h.device.state.read().pendingCloudOverwrite).toBeDefined();

    await h.controller.signIn();
    await h.controller.chooseDevice();
    await vi.waitFor(() => expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['restored']));
  });

  it('登出前先推送還沒推送的修改', async () => {
    const h = await syncedHarness();
    h.device.edit(addCharacter('unsynced'));
    await h.controller.signOut();
    expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['unsynced']);
    expect(view(h)).toMatchObject({ auth: { kind: 'signedOut' }, status: undefined });
  });
});

describe('重置偵測', () => {
  async function resetHarness(): Promise<ControllerHarness> {
    const cloud = new FakeCloudStore();
    const h = await syncedHarness({ cloud, data: withCharacters('c1') });
    const other = createDevice(cloud, { tokenPrefix: 'other' });
    await other.engine.syncOnce();
    await deleteAllRecords(createActionDeps(other).deps);
    await h.controller.syncNow();
    return h;
  }

  it('其他裝置刪除所有紀錄後跳出重置對話框；重置此裝置會清空本機與武器進度並恢復同步', async () => {
    const h = await resetHarness();
    expect(view(h).dialog).toEqual({ kind: 'reset' });
    await h.controller.resetDevice();
    expect(view(h).dialog).toBeUndefined();
    expect(h.device.repo.read()).toEqual(emptySnapshot());
    await vi.waitFor(() => expect(view(h).status).toEqual({ kind: 'synced' }));
  });

  it('不重置（關閉視窗）：登出，本機資料保留', async () => {
    const h = await resetHarness();
    await h.controller.dismissDialog();
    expect(view(h).auth).toEqual({ kind: 'signedOut' });
    expect(ids(h.device.repo.read().characters)).toEqual(['c1']);
  });
});

describe('還原', () => {
  it('已登入：比較畫面的目前資料等於雲端；選要還原的資料後本機與雲端都換掉，並建立雲端還原點', async () => {
    const h = await syncedHarness({ data: withCharacters('c1') });
    await h.controller.startRestore(withCharacters('old'), FILE);
    expect(view(h).dialog).toMatchObject({ kind: 'restore', mode: 'signedIn', refreshed: false });
    await h.controller.confirmRestore();
    expect(view(h).dialog).toBeUndefined();
    expect(h.notify.success).toHaveBeenCalled();
    await vi.waitFor(() => expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['old']));
    expect(ids(cloudDocument(h.cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['c1']);
  });

  it('同步進行中按還原：等這輪同步結束才開比較畫面', async () => {
    const h = harness({ data: withCharacters('c1') });
    await h.controller.boot();
    await h.controller.startRestore(withCharacters('old'), FILE);
    expect(view(h).dialog).toMatchObject({ kind: 'restore', mode: 'signedIn' });
    expect(h.notify.error).not.toHaveBeenCalled();
  });

  it('看比較畫面期間雲端被其他裝置更新：重新比較並標示，本機還沒被覆蓋', async () => {
    const cloud = new FakeCloudStore();
    const h = await syncedHarness({ cloud, data: withCharacters('c1') });
    await h.controller.startRestore(withCharacters('old'), FILE);
    const other = createDevice(cloud, { tokenPrefix: 'other' });
    await other.engine.syncOnce();
    other.edit(addCharacter('c2'));
    await other.engine.syncOnce();

    await h.controller.confirmRestore();
    expect(view(h).dialog).toMatchObject({ kind: 'restore', refreshed: true });
    const dialog = view(h).dialog;
    if (dialog?.kind !== 'restore') throw new Error('unexpected dialog');
    expect(ids(dialog.current.characters)).toEqual(['c1', 'c2']);
    expect(ids(h.device.repo.read().characters)).toEqual(['c1', 'c2']);
  });

  it('關閉還原比較畫面：什麼都不改，也不建立還原點', async () => {
    const h = await syncedHarness({ data: withCharacters('c1') });
    await h.controller.startRestore(withCharacters('old'), FILE);
    await h.controller.dismissDialog();
    expect(view(h)).toMatchObject({ dialog: undefined, auth: { kind: 'signedIn' } });
    expect(h.cloud.countFiles(RESTORE_POINT_FILE)).toBe(0);
  });

  it('列出可用的還原來源：未登入只有本機還原點，已登入是雲端還原點與每日快照', async () => {
    const signedOut = harness({ signedIn: false });
    await signedOut.controller.boot();
    expect(await signedOut.controller.listRestoreSources()).toEqual([]);
    signedOut.localRestorePoint.save(withCharacters('local'), T0);
    expect(await signedOut.controller.listRestoreSources()).toEqual([
      { kind: 'localRestorePoint', savedAt: T0.toISOString(), snapshot: withCharacters('local') },
    ]);

    const h = await syncedHarness();
    await h.cloud.create(RESTORE_POINT_FILE, serializeBackup(withCharacters('rp'), T0));
    await h.cloud.create(DAILY_SNAPSHOT_FILE, serializeBackup(withCharacters('daily'), T0));
    expect((await h.controller.listRestoreSources()).map((s) => [s.kind, ids(s.snapshot.characters)])).toEqual([
      ['cloudRestorePoint', ['rp']],
      ['dailySnapshot', ['daily']],
    ]);
  });

  it('刪除前建立還原點：呼叫當下就讀取資料，之後的刪除不影響還原點內容', async () => {
    const h = harness({ signedIn: false, data: withCharacters('c1') });
    await h.controller.boot();
    const saving = h.controller.saveRestorePointBeforeDelete();
    h.device.edit(() => emptySnapshot());
    await saving;
    expect(ids(h.localRestorePoint.read()?.snapshot.characters ?? [])).toEqual(['c1']);
  });
});

describe('刪除', () => {
  it('已登入刪除本機紀錄：推送後登出，清空本機與武器進度', async () => {
    const h = await syncedHarness();
    h.device.edit(addCharacter('unsynced'));
    expect(await h.controller.deleteLocal()).toBe(true);
    expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['unsynced']);
    expect(view(h)).toMatchObject({ auth: { kind: 'signedOut' }, status: undefined });
    expect(h.device.repo.read()).toEqual(emptySnapshot());
  });

  it('推送失敗時不登出也不清空，顯示錯誤並恢復自動同步', async () => {
    const h = await syncedHarness();
    h.device.edit(addCharacter('unsynced'));
    h.cloud.failNext('findFiles', new CloudError('network', 'offline'));
    expect(await h.controller.deleteLocal()).toBe(false);
    expect(h.notify.error).toHaveBeenCalledWith('還有修改沒有同步到雲端，請確認網路連線後再試一次');
    expect(view(h).auth.kind).toBe('signedIn');
    expect(ids(h.device.repo.read().characters)).toEqual(['unsynced']);
    await vi.waitFor(() => expect(ids(cloudDocument(h.cloud).snapshot.characters)).toEqual(['unsynced']));
  });

  it('未登入刪除本機紀錄：只清空資料（保留墓碑）並清空武器進度', async () => {
    const h = harness({ signedIn: false, data: withWeapon(withCharacters('c1')) });
    await h.controller.boot();
    expect(await h.controller.deleteLocal()).toBe(true);
    expect(h.device.repo.read().characters).toEqual([]);
    expect(h.device.repo.read().weapons.events).toEqual([]);
  });

  it('刪除所有紀錄：雲端與本機清空，維持登入並繼續同步', async () => {
    const h = await syncedHarness({ data: withWeapon(withCharacters('c1')) });
    expect(await h.controller.deleteAll()).toBe(true);
    expect(cloudDocument(h.cloud).snapshot).toEqual(emptySnapshot());
    expect(h.device.repo.read()).toEqual(emptySnapshot());
    await vi.waitFor(() => expect(view(h)).toMatchObject({ auth: { kind: 'signedIn' }, status: { kind: 'synced' } }));
  });

  it('動作進行中再次呼叫時直接忽略', async () => {
    const h = await syncedHarness({ data: withCharacters('c1') });
    const [first, second] = await Promise.all([h.controller.deleteAll(), h.controller.deleteAll()]);
    expect([first, second].sort()).toEqual([false, true]);
  });
});
