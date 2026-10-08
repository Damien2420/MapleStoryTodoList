import { describe, expect, it } from 'vitest';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import {
  clearLocalDataSignedOut,
  deleteAllRecords,
  deleteLocalRecords,
  resetThisDevice,
  saveRestorePoint,
} from '@/lib/sync/deleteActions';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { isPending } from '@/lib/sync/syncState';
import { T0, character, cloudDocument, createActionDeps, createDevice, emptySnapshot, ids } from '@/lib/sync/syncTestKit';

const addCharacter = (id: string) => (s: DataSnapshot) => ({ ...s, characters: [...s.characters, character(id)] });

describe('deleteLocalRecords（已登入）', () => {
  it('先推送待同步的修改，再登出，最後清空本機資料、同步狀態與本機還原點', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { data: emptySnapshot({ characters: [character('c1')] }) });
    await device.engine.syncOnce();
    device.edit(addCharacter('unsynced'));
    const h = createActionDeps(device);
    h.localRestorePoint.save(emptySnapshot(), T0);

    expect(await deleteLocalRecords(h.deps)).toEqual({ kind: 'deleted' });
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['c1', 'unsynced']);
    expect(h.signOutCalls()).toBe(1);
    expect(device.repo.read()).toEqual(emptySnapshot());
    expect(device.state.read()).toEqual({ changeCounter: 0, syncedCounter: 0 });
    expect(h.localRestorePoint.read()).toBeUndefined();
  });

  it('推送失敗時不登出也不清空，回傳失敗原因', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud);
    await device.engine.syncOnce();
    device.edit(addCharacter('unsynced'));
    cloud.failNext('findFiles', new CloudError('network', 'offline'));
    const h = createActionDeps(device);

    expect(await deleteLocalRecords(h.deps)).toEqual({ kind: 'pushFailed', outcome: { kind: 'retryLater', reason: 'offline' } });
    expect(h.signOutCalls()).toBe(0);
    expect(ids(device.repo.read().characters)).toEqual(['unsynced']);
    expect(isPending(device.state.read())).toBe(true);
  });
});

describe('clearLocalDataSignedOut（未登入）', () => {
  it('只清空資料，保留墓碑與同步狀態（與現在的「刪除全部」相同）', () => {
    const tombstone = { id: 'gone', deletedAt: T0.toISOString() };
    const device = createDevice(new FakeCloudStore(), {
      data: emptySnapshot({ characters: [character('c1')], characterTombstones: [tombstone] }),
      state: { resetToken: 'R1' },
    });
    clearLocalDataSignedOut(createActionDeps(device).deps);
    expect(device.repo.read()).toEqual(emptySnapshot({ characterTombstones: [tombstone] }));
    expect(device.state.read().resetToken).toBe('R1');
  });
});

describe('deleteAllRecords 與 resetThisDevice', () => {
  it('刪除所有紀錄：雲端資料先存成還原點，雲端換成空資料與新的 resetToken，本機清空、維持登入且沒有待推送', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const h = createActionDeps(a);

    await deleteAllRecords(h.deps);
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['c1']);
    const doc = cloudDocument(cloud);
    expect(doc.snapshot).toEqual(emptySnapshot());
    expect(doc.resetToken).toBe('a-2');
    expect(a.repo.read()).toEqual(emptySnapshot());
    expect(a.state.read()).toMatchObject({ boundSub: 'user-1', resetToken: 'a-2' });
    expect(isPending(a.state.read())).toBe(false);
    expect(h.signOutCalls()).toBe(0);
  });

  it('其他裝置偵測到重置，選擇重置此裝置後清空本機、改用新的 resetToken，之後恢復正常同步', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    await deleteAllRecords(createActionDeps(a).deps);

    expect(await b.engine.syncOnce()).toEqual({ kind: 'resetDetected' });
    await resetThisDevice(createActionDeps(b).deps);
    expect(b.repo.read()).toEqual(emptySnapshot());
    expect(b.state.read().resetToken).toBe('a-2');
    expect(await b.engine.syncOnce()).toMatchObject({ kind: 'synced' });

    b.edit(addCharacter('fresh'));
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(ids(a.repo.read().characters)).toEqual(['fresh']);
  });
});

describe('saveRestorePoint', () => {
  it('已登入存成雲端還原點，未登入存成本機還原點', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { data: emptySnapshot({ characters: [character('c1')] }) });
    const h = createActionDeps(device);
    await saveRestorePoint(h.deps, 'cloud');
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['c1']);
    await saveRestorePoint(h.deps, 'local');
    expect(ids(h.localRestorePoint.read()?.snapshot.characters ?? [])).toEqual(['c1']);
  });
});
