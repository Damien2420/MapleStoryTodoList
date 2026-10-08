import { describe, expect, it } from 'vitest';
import { FakeCloudStore } from '@/lib/sync/cloud/fakeCloudStore';
import { upsertFile } from '@/lib/sync/cloudFiles';
import { FormatTooNewError, parseCloudDocument, serializeCloudDocument } from '@/lib/sync/cloudDocument';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { emptyWeaponSnapshot } from '@/lib/weapon/types';
import { adjust, at } from '@/lib/weapon/testUtils';

function snapshot(overrides: Partial<DataSnapshot> = {}): DataSnapshot {
  return {
    accounts: [],
    accountTombstones: [],
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
    weapons: emptyWeaponSnapshot(),
    ...overrides,
  };
}

describe('parseCloudDocument / serializeCloudDocument', () => {
  it('序列化後可以解析回相同的快照、resetToken 與每日快照日期，內容是 version 6 的備份格式', () => {
    const data = snapshot({ characterTombstones: [{ id: 'c9', deletedAt: '2026-10-01T00:00:00.000Z' }] });
    const content = serializeCloudDocument({ snapshot: data, resetToken: 'R1', dailySnapshotDate: '2026-10-08' });
    expect(JSON.parse(content)).toMatchObject({ version: 6, resetToken: 'R1', dailySnapshotDate: '2026-10-08' });
    expect(parseCloudDocument(content)).toEqual({ snapshot: data, resetToken: 'R1', dailySnapshotDate: '2026-10-08' });
  });

  it('沒有每日快照日期時不寫出這個欄位', () => {
    const content = serializeCloudDocument({ snapshot: snapshot(), resetToken: 'R1' });
    expect('dailySnapshotDate' in JSON.parse(content)).toBe(false);
  });

  it('舊版檔案沒有 resetToken 與日期時，兩者為 undefined', () => {
    const legacy = JSON.stringify({ version: 6, createdAt: '2026-01-01T00:00:00.000Z', ...snapshot() });
    expect(parseCloudDocument(legacy)).toEqual({ snapshot: snapshot(), resetToken: undefined, dailySnapshotDate: undefined });
  });

  it('較舊的格式會先升級到目前版本', () => {
    const v5 = JSON.stringify({
      version: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [],
      characterTombstones: [],
      tasks: [],
      taskTombstones: [],
      bosses: [],
      bossTombstones: [],
    });
    expect(parseCloudDocument(v5).snapshot).toEqual(snapshot());
  });

  it('格式比程式新時丟出 FormatTooNewError', () => {
    const newer = JSON.stringify({ version: 7, createdAt: '2026-01-01T00:00:00.000Z', ...snapshot() });
    expect(() => parseCloudDocument(newer)).toThrow(FormatTooNewError);
  });

  it('v6 檔案沒有 weapons 時視為空的武器進度；有 weapons 時保留並清理損毀的項目', () => {
    const legacy = JSON.stringify({ version: 6, createdAt: '2026-01-01T00:00:00.000Z', ...snapshot(), weapons: undefined });
    expect(parseCloudDocument(legacy).snapshot.weapons).toEqual(emptyWeaponSnapshot());

    const event = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const withWeapons = JSON.stringify({
      version: 6,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...snapshot(),
      weapons: { events: [event, { id: 'broken' }], profiles: 'x' },
    });
    expect(parseCloudDocument(withWeapons).snapshot.weapons).toEqual({ ...emptyWeaponSnapshot(), events: [event] });
  });
});

describe('upsertFile', () => {
  it('沒有同名檔時建立，有的話更新同一個檔案，不會產生重複檔', async () => {
    const cloud = new FakeCloudStore();
    const created = await upsertFile(cloud, 'daily-snapshot.json', 'first');
    const updated = await upsertFile(cloud, 'daily-snapshot.json', 'second');
    expect(updated.id).toBe(created.id);
    expect(cloud.countFiles('daily-snapshot.json')).toBe(1);
    expect(cloud.contentOf('daily-snapshot.json')).toBe('second');
  });
});
