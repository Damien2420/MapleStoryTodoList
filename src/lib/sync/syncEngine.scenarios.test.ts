import { describe, expect, it } from 'vitest';
import { buildBackupPayload } from '@/lib/backupPayload';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { LATEST_FILE, serializeCloudDocument } from '@/lib/sync/cloudDocument';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { isPending } from '@/lib/sync/syncState';
import { T0, character, cloudDocument, createDevice, emptySnapshot, ids, seedCloud } from '@/lib/sync/syncTestKit';

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

  it('S9 雲端有多個同名主檔時，合併其他檔案的內容後刪除，只留最早建立的那個', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('in-first')] }), resetToken: 'R1' });
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('in-second')] }), resetToken: 'R-other' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(cloud.countFiles(LATEST_FILE)).toBe(1);
    const doc = cloudDocument(cloud);
    expect(ids(doc.snapshot.characters)).toEqual(['in-first', 'in-second']);
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
