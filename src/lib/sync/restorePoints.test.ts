import { beforeEach, describe, expect, it } from 'vitest';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { DAILY_SNAPSHOT_FILE, RESTORE_POINT_FILE } from '@/lib/sync/cloudDocument';
import {
  LOCAL_RESTORE_POINT_KEY,
  createLocalStorageRestorePointStore,
  createMemoryRestorePointStore,
  parseSavedSnapshot,
  readCloudSavedSnapshot,
  saveCloudRestorePoint,
  serializeBackup,
} from '@/lib/sync/restorePoints';
import { T0, character, emptySnapshot } from '@/lib/sync/syncTestKit';

const DATA = emptySnapshot({ characters: [character('c1')] });

describe('serializeBackup / parseSavedSnapshot', () => {
  it('序列化成一般備份格式，解析回存檔時間與資料', () => {
    const content = serializeBackup(DATA, T0);
    expect(JSON.parse(content)).toMatchObject({ version: 6, createdAt: T0.toISOString() });
    expect(parseSavedSnapshot(content)).toEqual({ savedAt: T0.toISOString(), snapshot: DATA });
  });

  it('內容損毀或格式比程式新時回傳 undefined', () => {
    expect(parseSavedSnapshot('{broken')).toBeUndefined();
    expect(parseSavedSnapshot(JSON.stringify({ version: 99, createdAt: T0.toISOString() }))).toBeUndefined();
  });
});

describe('本機還原點', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localStorage 版：存一份、新的取代舊的、其他實例讀得到、clear 後消失', () => {
    const store = createLocalStorageRestorePointStore();
    store.save(emptySnapshot(), T0);
    store.save(DATA, T0);
    expect(createLocalStorageRestorePointStore().read()).toEqual({ savedAt: T0.toISOString(), snapshot: DATA });
    store.clear();
    expect(store.read()).toBeUndefined();
    expect(localStorage.getItem(LOCAL_RESTORE_POINT_KEY)).toBeNull();
  });

  it('記憶體版行為相同', () => {
    const store = createMemoryRestorePointStore();
    expect(store.read()).toBeUndefined();
    store.save(DATA, T0);
    expect(store.read()).toEqual({ savedAt: T0.toISOString(), snapshot: DATA });
    store.clear();
    expect(store.read()).toBeUndefined();
  });

  it('localStorage 版不縮排，減少占用的容量', () => {
    createLocalStorageRestorePointStore().save(DATA, T0);
    expect(localStorage.getItem(LOCAL_RESTORE_POINT_KEY)).not.toContain('\n');
  });
});

describe('雲端還原點與每日快照', () => {
  it('雲端還原點只保留一份，可以讀回；檔案不存在時回傳 undefined', async () => {
    const cloud = new FakeCloudStore();
    expect(await readCloudSavedSnapshot(cloud, RESTORE_POINT_FILE)).toBeUndefined();
    await saveCloudRestorePoint(cloud, serializeBackup(emptySnapshot(), T0));
    await saveCloudRestorePoint(cloud, serializeBackup(DATA, T0));
    expect(cloud.countFiles(RESTORE_POINT_FILE)).toBe(1);
    expect(await readCloudSavedSnapshot(cloud, RESTORE_POINT_FILE)).toEqual({ savedAt: T0.toISOString(), snapshot: DATA });
  });

  it('每日快照（雲端主檔格式，含 resetToken）也能讀回', async () => {
    const cloud = new FakeCloudStore();
    await cloud.create(DAILY_SNAPSHOT_FILE, JSON.stringify({ ...JSON.parse(serializeBackup(DATA, T0)), resetToken: 'R1' }));
    expect(await readCloudSavedSnapshot(cloud, DAILY_SNAPSHOT_FILE)).toEqual({ savedAt: T0.toISOString(), snapshot: DATA });
  });
});
