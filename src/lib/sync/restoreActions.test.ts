import { describe, expect, it } from 'vitest';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import { restoreSignedIn, restoreSignedOut } from '@/lib/sync/restoreActions';
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
} from '@/lib/sync/syncTestKit';

const OLD = T0.toISOString();
const laterClock = () => createClock(new Date(T0.getTime() + DAY_MS));

describe('restoreSignedIn（3-1）', () => {
  it('雲端版本沒變時：目前雲端資料存成還原點，本機換成還原內容並標記待推送，同步後其他裝置一致', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, {
      tokenPrefix: 'a',
      clock: laterClock(),
      data: emptySnapshot({ characters: [character('c1', OLD, { level: 250 }), character('c2')] }),
    });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();

    const target = emptySnapshot({ characters: [character('c1', OLD, { level: 100 })] });
    expect(await restoreSignedIn(createActionDeps(a).deps, target, a.state.read().lastVersion)).toEqual({ kind: 'restored' });
    expect(ids(cloudDocument(cloud, RESTORE_POINT_FILE).snapshot.characters)).toEqual(['c1', 'c2']);
    expect(isPending(a.state.read())).toBe(true);

    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.read().characters.map((c) => [c.id, c.level])).toEqual([['c1', 100]]);
  });

  it('看比較畫面期間雲端版本變了時回 cloudChanged，什麼都不改', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const result = await restoreSignedIn(createActionDeps(a).deps, emptySnapshot(), 'version-seen-before');
    expect(result).toEqual({ kind: 'cloudChanged' });
    expect(cloud.countFiles(RESTORE_POINT_FILE)).toBe(0);
    expect(ids(a.repo.read().characters)).toEqual(['c1']);
    expect(isPending(a.state.read())).toBe(false);
  });

  it('還原先前已刪除（刪除已同步）的角色：其他還留著墓碑的裝置同步、修改、推送後，那個角色仍然存在', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', clock: laterClock(), data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    b.edit((s) => ({ ...s, characters: [], characterTombstones: [{ id: 'c1', deletedAt: OLD }] }));
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(a.repo.read().characters).toEqual([]);

    const target = emptySnapshot({ characters: [character('c1')] });
    await restoreSignedIn(createActionDeps(a).deps, target, a.state.read().lastVersion);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    b.edit((s) => ({ ...s, characters: [...s.characters, character('c9')] }));
    await b.engine.syncOnce();
    await a.engine.syncOnce();

    expect(a.repo.read().characters.map((c) => c.name).sort()).toEqual(['c1', 'c9']);
    expect(b.repo.read().characters.map((c) => c.name).sort()).toEqual(['c1', 'c9']);
  });
});

describe('restoreSignedOut（3-2）', () => {
  it('目前本機資料存成本機還原點，本機換成還原內容，並記下待覆蓋雲端與還原時間', () => {
    const device = createDevice(new FakeCloudStore(), { data: emptySnapshot({ characters: [character('before')] }) });
    const h = createActionDeps(device);
    restoreSignedOut(h.deps, emptySnapshot({ characters: [character('from-file')] }));
    expect(ids(h.localRestorePoint.read()?.snapshot.characters ?? [])).toEqual(['before']);
    expect(ids(device.repo.read().characters)).toEqual(['from-file']);
    expect(device.repo.read().characterTombstones.map((t) => t.id)).toEqual(['before']);
    expect(device.state.read().pendingCloudOverwrite).toEqual({ restoredAt: T0.toISOString() });
  });
});
