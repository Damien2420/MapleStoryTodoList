import { describe, expect, it } from 'vitest';
import { buildBackupPayload } from '@/lib/backupPayload';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { LATEST_FILE, serializeCloudDocument } from '@/lib/sync/cloudDocument';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { isPending } from '@/lib/sync/syncState';
import { T0, character, cloudDocument, createActionDeps, createDevice, emptySnapshot, ids, seedCloud, task } from '@/lib/sync/syncTestKit';
import { restoreSnapshot } from '@/lib/sync/restore';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { deleteAllRecords } from '@/lib/sync/deleteActions';
import { adjust, at } from '@/lib/weapon/testUtils';
import type { WeaponEvent } from '@/lib/weapon/types';

const addCharacter = (id: string) => (s: DataSnapshot) => ({ ...s, characters: [...s.characters, character(id)] });

/** 建立「A 先建立雲端主檔、B 再同步一次」的兩台裝置，兩台的 resetToken 都是 a-1 */
async function twoSyncedDevices(cloud: FakeCloudStore) {
  const a = createDevice(cloud, { tokenPrefix: 'a' });
  await a.engine.syncOnce();
  const b = createDevice(cloud, { tokenPrefix: 'b' });
  await b.engine.syncOnce();
  const [file] = await cloud.findFiles(LATEST_FILE);
  return { a, b, file };
}

describe('多裝置情境', () => {
  it('S1 兩台各自修改後依序同步，最後兩台與雲端一致', async () => {
    const cloud = new FakeCloudStore();
    const { a, b } = await twoSyncedDevices(cloud);
    a.edit(addCharacter('from-a'));
    await a.engine.syncOnce();
    b.edit(addCharacter('from-b'));
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(ids(a.repo.read().characters)).toEqual(['from-a', 'from-b']);
    expect(ids(b.repo.read().characters)).toEqual(['from-a', 'from-b']);
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['from-a', 'from-b']);
  });

  it('S2 下載途中的本機修改不會被合併結果蓋掉，並且一起上傳', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('remote')] }), resetToken: 'R1' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    let edited = false;
    cloud.beforeOp = (op) => {
      if (op === 'download' && !edited) {
        edited = true;
        device.edit(addCharacter('during'));
      }
    };
    await device.engine.syncOnce();
    expect(ids(device.repo.read().characters)).toEqual(['during', 'remote']);
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['during', 'remote']);
    expect(isPending(device.state.read())).toBe(false);
  });

  it('S3 兩台幾乎同時推送：後寫入的那台從歷史版本發現對方的寫入，當下合併並重新上傳', async () => {
    const cloud = new FakeCloudStore();
    const { a, b, file } = await twoSyncedDevices(cloud);
    a.edit(addCharacter('from-a'));
    b.edit(addCharacter('from-b'));
    let interleaved = false;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !interleaved) {
        interleaved = true;
        await b.engine.syncOnce();
      }
    };
    expect(await a.engine.syncOnce()).toMatchObject({ kind: 'synced', applied: { addedCharacterNames: ['from-b'] } });
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['from-a', 'from-b']);
    expect(a.sleeps).toEqual([500]);

    cloud.beforeOp = undefined;
    await b.engine.syncOnce();
    expect(ids(b.repo.read().characters)).toEqual(['from-a', 'from-b']);
  });

  it('S4 上傳前記下的歷史版本已被 Drive 清掉時，改合併自己前一筆，仍能救回對方的修改', async () => {
    const cloud = new FakeCloudStore();
    const { a, b, file } = await twoSyncedDevices(cloud);
    a.edit(addCharacter('from-a'));
    b.edit(addCharacter('from-b'));
    let interleaved = false;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !interleaved) {
        interleaved = true;
        await b.engine.syncOnce();
        cloud.pruneRevisions(file.id, 1);
      }
    };
    expect(await a.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['from-a', 'from-b']);
  });

  it('S5 另一台在上傳窗口內「刪除所有紀錄」：這台把重置後的內容還原回雲端並回 resetDetected，本機不動', async () => {
    const cloud = new FakeCloudStore();
    const { b, file } = await twoSyncedDevices(cloud);
    b.edit(addCharacter('stale-b'));
    let interleaved = false;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !interleaved) {
        interleaved = true;
        await cloud.update(file.id, serializeCloudDocument({ snapshot: emptySnapshot(), resetToken: 'reset-2' }));
      }
    };
    expect(await b.engine.syncOnce()).toEqual({ kind: 'resetDetected' });
    const doc = cloudDocument(cloud);
    expect(doc.resetToken).toBe('reset-2');
    expect(doc.snapshot.characters).toEqual([]);
    expect(ids(b.repo.read().characters)).toEqual(['stale-b']);
    expect(b.state.read().resetToken).toBe('a-1');
  });

  it('S6 每次上傳前都有其他寫入時，重試 3 次（間隔 500、1000ms）後回 retryLater conflict，雙方資料都沒有遺失', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a' });
    await a.engine.syncOnce();
    const [file] = await cloud.findFiles(LATEST_FILE);
    a.edit(addCharacter('mine'));
    let writing = false;
    let writes = 0;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !writing) {
        writing = true;
        writes += 1;
        await cloud.update(
          file.id,
          serializeCloudDocument({ snapshot: emptySnapshot({ characters: [character(`other-${writes}`)] }), resetToken: 'a-1' }),
        );
        writing = false;
      }
    };
    expect(await a.engine.syncOnce()).toMatchObject({ kind: 'retryLater', reason: 'conflict' });
    expect(a.sleeps).toEqual([500, 1000]);
    expect(ids(a.repo.read().characters)).toEqual(['mine', 'other-1', 'other-2', 'other-3']);
    expect(isPending(a.state.read())).toBe(true);
  });

  it('S7 刪除會傳到其他裝置，並回報同步移除的角色', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    a.edit((s) => ({ ...s, characters: [], characterTombstones: [{ id: 'c1', deletedAt: T0.toISOString() }] }));
    await a.engine.syncOnce();
    expect(await b.engine.syncOnce()).toMatchObject({ kind: 'synced', applied: { removedCharacterNames: ['c1'] } });
    expect(b.repo.read().characters).toEqual([]);
  });

  it('S8 兩台第一次同步時同時建立主檔：較晚建立的刪掉自己那份、改用最早那份的 resetToken，合併後只剩一個檔案', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('from-a')] }) });
    const b = createDevice(cloud, { tokenPrefix: 'b', data: emptySnapshot({ characters: [character('from-b')] }) });
    let raced = false;
    cloud.beforeOp = async (op) => {
      if (op === 'create' && !raced) {
        raced = true;
        await b.engine.syncOnce();
      }
    };
    expect(await a.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    cloud.beforeOp = undefined;
    expect(cloud.countFiles(LATEST_FILE)).toBe(1);
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['from-a', 'from-b']);
    expect(a.state.read().resetToken).toBe('b-1');

    expect(await b.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(ids(b.repo.read().characters)).toEqual(['from-a', 'from-b']);
    expect(b.state.read().resetToken).toBe('b-1');
  });

  it('S9 雲端有多個同名主檔時，合併同一個 resetToken（或沒有 resetToken 的舊檔）的內容後刪除，只留最早建立的那個；resetToken 不同的不合併', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('in-first')] }), resetToken: 'R1' });
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('in-second')] }), resetToken: 'R1' });
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('legacy')] }) });
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('before-reset')] }), resetToken: 'R-other' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(cloud.countFiles(LATEST_FILE)).toBe(1);
    const doc = cloudDocument(cloud);
    expect(ids(doc.snapshot.characters)).toEqual(['in-first', 'in-second', 'legacy']);
    expect(doc.resetToken).toBe('R1');
  });

  it('S10 上傳後才在歷史版本發現較新格式的寫入（新版已部署）：把那筆還原回雲端並回 formatTooNew', async () => {
    const cloud = new FakeCloudStore();
    const { a, file } = await twoSyncedDevices(cloud);
    a.edit(addCharacter('old-tab'));
    const newer = JSON.stringify({
      ...buildBackupPayload(emptySnapshot({ characters: [character('new-app')] })),
      version: 7,
      resetToken: 'a-1',
    });
    let interleaved = false;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !interleaved) {
        interleaved = true;
        await cloud.update(file.id, newer);
      }
    };
    expect(await a.engine.syncOnce()).toEqual({ kind: 'formatTooNew' });
    expect(cloud.contentOf(LATEST_FILE)).toBe(newer);
  });
});

describe('上傳後驗證中斷與多餘主檔', () => {
  it('B 上傳後驗證失敗（覆蓋了 A 剛推送的版本）：A 下次同步發現雲端少了自己的修改，重新推送', async () => {
    const cloud = new FakeCloudStore();
    const { a, b, file } = await twoSyncedDevices(cloud);
    b.edit(addCharacter('from-b'));
    a.edit(addCharacter('from-a'));
    let interleaved = false;
    cloud.beforeOp = async (op, args) => {
      if (op === 'update' && args[0] === file.id && !interleaved) {
        interleaved = true;
        cloud.beforeOp = undefined;
        expect(await a.engine.syncOnce()).toMatchObject({ kind: 'synced' });
        cloud.failNext('listRevisions', new CloudError('rateLimited', '429'));
      }
    };
    expect(await b.engine.syncOnce()).toMatchObject({ kind: 'retryLater' });
    expect(ids(cloudDocument(cloud).snapshot.characters)).not.toContain('from-a');

    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(ids(cloudDocument(cloud).snapshot.characters).sort()).toEqual(['from-a', 'from-b']);
    expect(ids(b.repo.read().characters).sort()).toEqual(['from-a', 'from-b']);
  });

  it('沒有新內容時，下載合併後不會因為時間相同、內容不同的資料而上傳', async () => {
    const cloud = new FakeCloudStore();
    const { a, b } = await twoSyncedDevices(cloud);
    a.edit(addCharacter('c1'));
    await a.engine.syncOnce();
    // B 本機同一筆資料內容不同但時間相同（例如重置檢查只改了 checked）
    b.edit((s) => ({ ...s, characters: [{ ...character('c1'), name: '本機改名但時間相同' }] }));
    b.state.update((current) => ({ syncedCounter: current.changeCounter }));
    const ops: string[] = [];
    cloud.beforeOp = (op) => {
      ops.push(op);
    };
    await b.engine.syncOnce();
    expect(ops).not.toContain('update');
  });

  it('同名主檔的 resetToken 與主檔不同時不合併，刪除所有紀錄後舊資料不會復活', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('old')] }) });
    await a.engine.syncOnce();
    await cloud.create(LATEST_FILE, serializeCloudDocument({ snapshot: emptySnapshot({ characters: [character('old2')] }), resetToken: 'a-1' }));
    await deleteAllRecords(createActionDeps(a).deps);
    expect(await cloud.findFiles(LATEST_FILE)).toHaveLength(1);

    await cloud.create(LATEST_FILE, serializeCloudDocument({ snapshot: emptySnapshot({ characters: [character('stale')] }), resetToken: 'a-1' }));
    expect(await a.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(a.repo.read().characters).toEqual([]);
    expect(cloudDocument(cloud).snapshot.characters).toEqual([]);
    expect(await cloud.findFiles(LATEST_FILE)).toHaveLength(1);
  });
});

describe('刪除後還原（toast 的還原按鈕）', () => {
  it('刪除已經同步到其他裝置後才按還原：以新 id 加回、保留舊墓碑，兩台最後都留著這筆', async () => {
    const cloud = new FakeCloudStore();
    const t1 = task('t1', 'c1');
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('c1')], tasks: [t1] }) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();

    a.edit((s) => ({ ...s, tasks: [], taskTombstones: [{ id: 't1', deletedAt: T0.toISOString() }] }));
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    // 與 useTaskStore.restoreTask 相同：新 id、較新的修改時間，舊 id 的墓碑保留
    a.edit((s) => ({ ...s, tasks: [{ ...t1, id: 't1-restored', updatedAt: new Date(T0.getTime() + 1000).toISOString() }] }));
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    b.edit(addCharacter('other'));
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(ids(a.repo.read().tasks)).toEqual(['t1-restored']);
    expect(ids(b.repo.read().tasks)).toEqual(['t1-restored']);
  });
});

describe('武器進度同步', () => {
  const addEvent = (event: WeaponEvent) => (s: DataSnapshot): DataSnapshot => ({
    ...s,
    weapons: { ...s.weapons, events: [...s.weapons.events, event] },
  });
  const genesis = (day: number, stage: number) => adjust(at(2026, 10, day), { weapon: 'genesis', stage, pool: 0 });

  it('兩台裝置各自設定與升階後同步，結果一致', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: emptySnapshot({ characters: [character('c1')] }) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    a.edit(addEvent(genesis(1, 1)));
    b.edit(addEvent(genesis(2, 2)));
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    expect(ids(a.repo.read().weapons.events).sort()).toEqual(ids(b.repo.read().weapons.events).sort());
    expect(a.repo.read().weapons.events).toHaveLength(2);
  });

  it('A 還原到較舊的資料後，B 同步時舊事件不會復活', async () => {
    const cloud = new FakeCloudStore();
    const base = emptySnapshot({ characters: [character('c1')] });
    const a = createDevice(cloud, { tokenPrefix: 'a', data: addEvent(genesis(1, 1))(base) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    b.edit(addEvent(genesis(2, 2)));
    await b.engine.syncOnce();
    await a.engine.syncOnce();
    let n = 0;
    a.edit((current) => restoreSnapshot(current, addEvent(genesis(1, 1))(base), T0, () => `new-${++n}`));
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.read().weapons.events.map((e) => e.payload)).toEqual([{ weapon: 'genesis', stage: 1, pool: 0 }]);
  });

  it('刪除角色後，另一台的武器資料一併消失', async () => {
    const cloud = new FakeCloudStore();
    const a = createDevice(cloud, { tokenPrefix: 'a', data: addEvent(genesis(1, 1))(emptySnapshot({ characters: [character('c1')] })) });
    await a.engine.syncOnce();
    const b = createDevice(cloud, { tokenPrefix: 'b' });
    await b.engine.syncOnce();
    expect(b.repo.read().weapons.events).toHaveLength(1);
    a.edit((s) => ({ ...s, characters: [], characterTombstones: [{ id: 'c1', deletedAt: T0.toISOString() }] }));
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    expect(b.repo.read().weapons.events).toEqual([]);
  });
});
