import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { AuthError } from '@/lib/auth/authClient';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { DAILY_SNAPSHOT_FILE, LATEST_FILE } from '@/lib/sync/cloudDocument';
import { isPending } from '@/lib/sync/syncState';
import {
  DAY_MS,
  T0,
  character,
  cloudDocument,
  createClock,
  createDevice,
  emptySnapshot,
  ids,
  seedCloud,
} from '@/lib/sync/syncTestKit';

/** 記錄之後每一個雲端操作的名稱 */
function recordOps(cloud: FakeCloudStore): string[] {
  const ops: string[] = [];
  cloud.beforeOp = (op) => {
    ops.push(op);
  };
  return ops;
}

const addCharacter = (id: string) => (s: ReturnType<typeof emptySnapshot>) => ({
  ...s,
  characters: [...s.characters, character(id)],
});

describe('同步前的檢查', () => {
  it('本機沒有綁定帳號、或綁定的不是目前登入的帳號時回 needsFirstLogin，不碰雲端', async () => {
    const cloud = new FakeCloudStore();
    const ops = recordOps(cloud);
    const unbound = createDevice(cloud, { state: { boundSub: undefined } });
    expect(await unbound.engine.syncOnce()).toEqual({ kind: 'needsFirstLogin' });
    const otherAccount = createDevice(cloud, { state: { boundSub: 'someone-else' } });
    expect(await otherAccount.engine.syncOnce()).toEqual({ kind: 'needsFirstLogin' });
    expect(ops).toEqual([]);
  });

  it('超過 90 天沒有成功同步時回 stale，不碰雲端', async () => {
    const cloud = new FakeCloudStore();
    const ops = recordOps(cloud);
    const device = createDevice(cloud, { state: { lastSyncedAt: new Date(T0.getTime() - 91 * DAY_MS).toISOString() } });
    expect(await device.engine.syncOnce()).toEqual({ kind: 'stale' });
    expect(ops).toEqual([]);
  });
});

describe('拉取與推送', () => {
  it('雲端沒有主檔時，用本機資料與新的 resetToken 建立，並記下 version、歷史版本與同步時間', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { data: emptySnapshot({ characters: [character('c1')] }) });
    expect(await device.engine.syncOnce()).toEqual({ kind: 'synced' });
    const doc = cloudDocument(cloud);
    expect(ids(doc.snapshot.characters)).toEqual(['c1']);
    expect(doc.resetToken).toBe('token-1');
    const [file] = await cloud.findFiles(LATEST_FILE);
    expect(device.state.read()).toMatchObject({
      lastVersion: file.version,
      lastRevisionId: file.headRevisionId,
      resetToken: 'token-1',
      lastSyncedAt: T0.toISOString(),
    });
  });

  it('雲端 version 沒變且沒有待推送時，只查一次檔案清單', async () => {
    const cloud = new FakeCloudStore();
    const device = createDevice(cloud, { data: emptySnapshot({ characters: [character('c1')] }) });
    await device.engine.syncOnce();
    const ops = recordOps(cloud);
    expect(await device.engine.syncOnce()).toEqual({ kind: 'synced' });
    expect(ops).toEqual(['findFiles']);
  });

  it('雲端 version 變了時下載並合併進本機，回報套用的筆數；沒有待推送就不上傳', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('remote')] }), resetToken: 'R1' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    const ops = recordOps(cloud);
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced', applied: { addedCharacters: 1 } });
    expect(ids(device.repo.read().characters)).toEqual(['remote']);
    expect(ops).toEqual(['findFiles', 'download']);
  });

  it('有待推送時上傳本機資料（帶同一個 resetToken），完成後不再是待推送', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot(), resetToken: 'R1' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    await device.engine.syncOnce();
    device.edit(addCharacter('mine'));
    expect(isPending(device.state.read())).toBe(true);

    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    const doc = cloudDocument(cloud);
    expect(ids(doc.snapshot.characters)).toEqual(['mine']);
    expect(doc.resetToken).toBe('R1');
    expect(isPending(device.state.read())).toBe(false);
    const [file] = await cloud.findFiles(LATEST_FILE);
    expect(device.state.read().lastVersion).toBe(file.version);
  });

  it('上傳期間又有新修改時，同步完成但仍是待推送', async () => {
    const cloud = new FakeCloudStore();
    const file = await seedCloud(cloud, { snapshot: emptySnapshot(), resetToken: 'R1' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    await device.engine.syncOnce();
    device.edit(addCharacter('first'));
    let edited = false;
    cloud.beforeOp = (op, args) => {
      if (op === 'update' && args[0] === file.id && !edited) {
        edited = true;
        device.edit(addCharacter('second'));
      }
    };
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced' });
    expect(ids(cloudDocument(cloud).snapshot.characters)).toEqual(['first']);
    expect(isPending(device.state.read())).toBe(true);
  });

  it('上傳前清掉超過 90 天的墓碑，本機與雲端都清', async () => {
    const cloud = new FakeCloudStore();
    const expired = { id: 'gone', deletedAt: new Date(T0.getTime() - 91 * DAY_MS).toISOString() };
    const recent = { id: 'recent', deletedAt: T0.toISOString() };
    const device = createDevice(cloud, { data: emptySnapshot({ characterTombstones: [expired, recent] }) });
    await device.engine.syncOnce();
    expect(cloudDocument(cloud).snapshot.characterTombstones).toEqual([recent]);
    expect(device.repo.read().characterTombstones).toEqual([recent]);
  });
});

describe('重置、格式與舊版檔案', () => {
  it('雲端格式比程式新時回 formatTooNew，不上傳也不改本機', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('new-app')] }), resetToken: 'R1', version: 7 });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    device.edit(addCharacter('mine'));
    const ops = recordOps(cloud);
    expect(await device.engine.syncOnce()).toEqual({ kind: 'formatTooNew' });
    expect(ops).toEqual(['findFiles', 'download']);
    expect(ids(device.repo.read().characters)).toEqual(['mine']);
  });

  it('雲端 resetToken 與本機不同時回 resetDetected，不合併也不上傳', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot(), resetToken: 'R2' });
    const device = createDevice(cloud, { state: { resetToken: 'R1' } });
    device.edit(addCharacter('mine'));
    const ops = recordOps(cloud);
    expect(await device.engine.syncOnce()).toEqual({ kind: 'resetDetected' });
    expect(ops).toEqual(['findFiles', 'download']);
    expect(ids(device.repo.read().characters)).toEqual(['mine']);
    expect(device.state.read().resetToken).toBe('R1');
  });

  it('舊版雲端檔案沒有 resetToken 時照常合併，並上傳補上 resetToken', async () => {
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('legacy')] }) });
    const device = createDevice(cloud);
    expect(await device.engine.syncOnce()).toMatchObject({ kind: 'synced', applied: { addedCharacters: 1 } });
    expect(cloudDocument(cloud).resetToken).toBe('token-1');
    expect(device.state.read().resetToken).toBe('token-1');
  });

  it('雲端內容不是合法 JSON 時把錯誤往上拋（由排程器記錄並重試）', async () => {
    const cloud = new FakeCloudStore();
    await cloud.create(LATEST_FILE, 'not json');
    const device = createDevice(cloud);
    await expect(device.engine.syncOnce()).rejects.toThrow(SyntaxError);
  });
});

describe('每日快照', () => {
  it('當天第一次上傳前把雲端原本的內容存成每日快照，同一天的其他上傳（含其他裝置）不再覆寫，隔天再存', async () => {
    const clock = createClock();
    const cloud = new FakeCloudStore();
    await seedCloud(cloud, { snapshot: emptySnapshot({ characters: [character('before')] }), resetToken: 'R1' });
    const a = createDevice(cloud, { clock, state: { resetToken: 'R1' } });
    const b = createDevice(cloud, { clock, state: { resetToken: 'R1' } });
    await a.engine.syncOnce();
    await b.engine.syncOnce();

    a.edit(addCharacter('today-a'));
    await a.engine.syncOnce();
    expect(ids(cloudDocument(cloud, DAILY_SNAPSHOT_FILE).snapshot.characters)).toEqual(['before']);
    expect(cloudDocument(cloud).dailySnapshotDate).toBe(format(clock.now(), 'yyyy-MM-dd'));

    b.edit(addCharacter('today-b'));
    await b.engine.syncOnce();
    expect(ids(cloudDocument(cloud, DAILY_SNAPSHOT_FILE).snapshot.characters)).toEqual(['before']);

    clock.advance(DAY_MS);
    a.edit(addCharacter('tomorrow'));
    await a.engine.syncOnce();
    expect(ids(cloudDocument(cloud, DAILY_SNAPSHOT_FILE).snapshot.characters)).toEqual(['before', 'today-a', 'today-b']);
    expect(cloud.countFiles(DAILY_SNAPSHOT_FILE)).toBe(1);
  });
});

describe('錯誤對應', () => {
  it('雲端錯誤：權限問題回 reconnectRequired，其他回 retryLater offline', async () => {
    const cases: Array<[CloudError, object]> = [
      [new CloudError('network', 'x'), { kind: 'retryLater', reason: 'offline' }],
      [new CloudError('server', 'x'), { kind: 'retryLater', reason: 'offline' }],
      [new CloudError('rateLimited', 'x'), { kind: 'retryLater', reason: 'offline' }],
      [new CloudError('unauthorized', 'x'), { kind: 'reconnectRequired' }],
    ];
    for (const [error, expected] of cases) {
      const cloud = new FakeCloudStore();
      cloud.failNext('findFiles', error);
      expect(await createDevice(cloud).engine.syncOnce()).toEqual(expected);
    }
  });

  it('授權錯誤：reconnectRequired、signedOut 原樣回報，網路錯誤回 retryLater offline', async () => {
    const cases: Array<[AuthError, object]> = [
      [new AuthError('reconnectRequired', 'x'), { kind: 'reconnectRequired' }],
      [new AuthError('signedOut', 'x'), { kind: 'signedOut' }],
      [new AuthError('network', 'x'), { kind: 'retryLater', reason: 'offline' }],
    ];
    for (const [error, expected] of cases) {
      const device = createDevice(new FakeCloudStore(), {
        getUser: async () => {
          throw error;
        },
      });
      expect(await device.engine.syncOnce()).toEqual(expected);
    }
  });
});
