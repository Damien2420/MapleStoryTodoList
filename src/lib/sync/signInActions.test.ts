import { describe, expect, it } from 'vitest';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import { adoptCloudData, inspectSignIn, keepRestoredVersion, mergeBothData } from '@/lib/sync/signInActions';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { isPending } from '@/lib/sync/syncState';
import {
  DAY_MS,
  T0,
  character,
  cloudDocument,
  createActionDeps,
  createClock,
  createDevice,
  emptySnapshot,
  ids,
  seedCloud,
} from '@/lib/sync/syncTestKit';
import { adjust, at } from '@/lib/weapon/testUtils';

const withCharacters = (...names: string[]): DataSnapshot => emptySnapshot({ characters: names.map((n) => character(n)) });
const UNBOUND = { boundSub: undefined };

describe('inspectSignIn', () => {
  it('已綁定同一個帳號且沒有超過 90 天：直接開始同步，不改綁定，並刪除本機還原點', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { state: { resetToken: 'R1', lastVersion: '3' } });
    const h = createActionDeps(device);
    h.localRestorePoint.save(withCharacters('old'), T0);
    expect(await inspectSignIn(h.deps)).toEqual({ kind: 'ready' });
    expect(device.state.read()).toMatchObject({ boundSub: 'user-1', resetToken: 'R1', lastVersion: '3' });
    expect(h.localRestorePoint.read()).toBeUndefined();
  });

  it('第一次登入、本機與雲端都沒有資料：綁定帳號後直接開始同步', async () => {
    const device = createDevice(new FakeCloudStore(), { state: UNBOUND });
    expect(await inspectSignIn(createActionDeps(device).deps)).toEqual({ kind: 'ready' });
    expect(device.state.read().boundSub).toBe('user-1');
  });

  it('第一次登入、只有本機有資料：綁定並標記待推送，同步後雲端是本機資料', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { data: withCharacters('mine'), state: UNBOUND });
    expect(await inspectSignIn(createActionDeps(device).deps)).toEqual({ kind: 'ready' });
    expect(isPending(device.state.read())).toBe(true);
    await device.engine.syncOnce();
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['mine']);
  });

  it('第一次登入、只有雲端有資料：綁定後同步把雲端資料下載到本機', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, { state: UNBOUND });
    expect(await inspectSignIn(createActionDeps(device).deps)).toEqual({ kind: 'ready' });
    await device.engine.syncOnce();
    expect(ids(device.repo.read().characters)).toEqual(['remote']);
    expect(device.state.read().resetToken).toBe('R1');
  });

  it('雲端主檔存在但沒有任何資料、本機有資料：不跳對話框，綁定並標記待推送，同步後上傳本機資料', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot(), resetToken: 'R1' });
    const device = createDevice(cloud, { data: withCharacters('mine'), state: UNBOUND });
    expect(await inspectSignIn(createActionDeps(device).deps)).toEqual({ kind: 'ready' });
    await device.engine.syncOnce();
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['mine']);
  });

  it('第一次登入、兩邊都有資料：回傳對話框需要的兩邊資料，還沒綁定帳號', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, { data: withCharacters('mine'), state: UNBOUND });
    const plan = await inspectSignIn(createActionDeps(device).deps);
    expect(plan).toMatchObject({ kind: 'chooseFirstLogin', reason: 'firstLogin', cloud: { resetToken: 'R1' } });
    if (plan.kind !== 'chooseFirstLogin') throw new Error('unexpected plan');
    expect(ids(plan.local.characters)).toEqual(['mine']);
    expect(ids(plan.cloud.snapshot.characters)).toEqual(['remote']);
    expect(device.state.read().boundSub).toBeUndefined();
  });

  it('綁定的是其他帳號時視同第一次登入；同帳號但超過 90 天沒同步時原因為 stale', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const otherAccount = createDevice(cloud, { data: withCharacters('mine'), state: { boundSub: 'someone-else' } });
    expect(await inspectSignIn(createActionDeps(otherAccount).deps)).toMatchObject({ kind: 'chooseFirstLogin', reason: 'firstLogin' });
    const stale = createDevice(cloud, {
      data: withCharacters('mine'),
      state: { lastSyncedAt: new Date(T0.getTime() - 91 * DAY_MS).toISOString() },
    });
    expect(await inspectSignIn(createActionDeps(stale).deps)).toMatchObject({ kind: 'chooseFirstLogin', reason: 'stale' });
  });

  it('未登入時還原過（待覆蓋雲端）：雲端有資料時回傳 3-3 比較需要的內容；雲端沒有資料時直接綁定並清除標記', async () => {
    const restoredAt = T0.toISOString();
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, { data: withCharacters('restored'), state: { ...UNBOUND, pendingCloudOverwrite: { restoredAt } } });
    expect(await inspectSignIn(createActionDeps(device).deps)).toMatchObject({ kind: 'confirmOverwrite', restoredAt });

    const emptyCloud = new FakeCloudStore();
    const fresh = createDevice(emptyCloud, { data: withCharacters('restored'), state: { ...UNBOUND, pendingCloudOverwrite: { restoredAt } } });
    expect(await inspectSignIn(createActionDeps(fresh).deps)).toEqual({ kind: 'ready' });
    expect(fresh.state.read()).toMatchObject({ boundSub: 'user-1', pendingCloudOverwrite: undefined });
  });
});

describe('對話框的選擇', () => {
  it('改用雲端資料：本機的武器進度換成雲端的版本（雲端沒有時清空）', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const local = withCharacters('mine');
    const device = createDevice(cloud, {
      state: UNBOUND,
      data: { ...local, weapons: { ...local.weapons, events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 })] } },
    });
    const h = createActionDeps(device);
    const plan = await inspectSignIn(h.deps);
    if (plan.kind !== 'chooseFirstLogin') throw new Error('unexpected plan');
    await adoptCloudData(h.deps, plan.cloud);
    expect(device.repo.read().weapons.events).toEqual([]);
  });

  it('改用雲端資料：本機資料先存成雲端還原點，本機換成雲端資料，之後同步不需要上傳', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, { data: withCharacters('mine'), state: UNBOUND });
    const h = createActionDeps(device);
    const plan = await inspectSignIn(h.deps);
    if (plan.kind !== 'chooseFirstLogin') throw new Error('unexpected plan');

    await adoptCloudData(h.deps, plan.cloud);
    expect(ids(device.repo.read().characters)).toEqual(['remote']);
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['mine']);
    expect(device.state.read()).toMatchObject({ boundSub: 'user-1', resetToken: 'R1' });
    expect(isPending(device.state.read())).toBe(false);

    const ops: string[] = [];
    cloud.beforeOp = (op) => {
      ops.push(op);
    };
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(ops).toEqual(['findFiles']);
  });

  it('合併兩邊的資料：綁定並標記待推送，同步後兩邊的資料都保留', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, { data: withCharacters('mine'), state: UNBOUND });
    await mergeBothData(createActionDeps(device).deps);
    await device.engine.syncOnce();
    expect(ids(device.repo.read().characters)).toEqual(['mine', 'remote']);
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['mine', 'remote']);
  });

  it('3-3 選這台裝置：雲端資料存成還原點，以本機取代雲端並替雲端多出的紀錄寫墓碑，其他裝置同步後也一致', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, {
      snapshot: emptySnapshot({ characters: [character('c1', T0.toISOString(), { level: 250 }), character('c2')] }),
      resetToken: 'R1',
    });
    const other = createDevice(cloud, { tokenPrefix: 'other', state: { resetToken: 'R1' } });
    await other.engine.syncOnce();

    const later = createClock(new Date(T0.getTime() + DAY_MS));
    const device = createDevice(cloud, {
      clock: later,
      data: emptySnapshot({ characters: [character('c1', T0.toISOString(), { level: 100 })] }),
      state: { ...UNBOUND, pendingCloudOverwrite: { restoredAt: later.now().toISOString() } },
    });
    const h = createActionDeps(device);
    h.localRestorePoint.save(withCharacters('before-restore'), T0);
    const plan = await inspectSignIn(h.deps);
    if (plan.kind !== 'confirmOverwrite') throw new Error('unexpected plan');

    await keepRestoredVersion(h.deps, plan.cloud);
    await device.engine.syncOnce();
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['c1', 'c2']);
    expect(cloudDocument(cloud).snapshot.characters.map((c) => [c.id, c.level])).toEqual([['c1', 100]]);
    expect(device.state.read().pendingCloudOverwrite).toBeUndefined();
    expect(h.localRestorePoint.read()).toBeUndefined();

    await other.engine.syncOnce();
    expect(other.repo.read().characters.map((c) => [c.id, c.level])).toEqual([['c1', 100]]);
  });

  it('3-3 選雲端：這台裝置的還原結果存成雲端還原點，本機換成雲端資料並清除待覆蓋標記', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: withCharacters('remote'), resetToken: 'R1' });
    const device = createDevice(cloud, {
      data: withCharacters('restored'),
      state: { ...UNBOUND, pendingCloudOverwrite: { restoredAt: T0.toISOString() } },
    });
    const h = createActionDeps(device);
    const plan = await inspectSignIn(h.deps);
    if (plan.kind !== 'confirmOverwrite') throw new Error('unexpected plan');

    await adoptCloudData(h.deps, plan.cloud);
    expect(ids(device.repo.read().characters)).toEqual(['remote']);
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['restored']);
    expect(device.state.read()).toMatchObject({ boundSub: 'user-1', pendingCloudOverwrite: undefined });
  });
});
