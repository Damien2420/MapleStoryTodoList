import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { mergeRecords, resolveByUpdatedAt, resolveCharacter } from '@/lib/recordMerge';
import { LEGACY_TIMESTAMP } from '@/lib/timestamp';

interface Item {
  id: string;
  name: string;
  updatedAt: string;
}

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function item(id: string, name = id.toUpperCase(), updatedAt = T1): Item {
  return { id, name, updatedAt };
}

function merge(local: Item[], localTombstones: { id: string; deletedAt: string }[], remote: Item[], remoteTombstones: { id: string; deletedAt: string }[]) {
  return mergeRecords(local, localTombstones, remote, remoteTombstones, resolveByUpdatedAt);
}

describe('mergeRecords 新增與墓碑', () => {
  it('遠端有、本機沒有、沒被墓碑擋住的項目會被新增', () => {
    const result = merge([item('a')], [], [item('a'), item('b')], []);
    expect(result.items).toEqual([item('a'), item('b')]);
    expect(result.addedCount).toBe(1);
    expect(result.removedByTombstoneCount).toBe(0);
  });

  it('本機自己的墓碑會擋住遠端傳來的舊資料,不會被還原復活,並計入略過筆數', () => {
    const localTombstones = [{ id: 'a', deletedAt: T1 }];
    const result = merge([], localTombstones, [item('a')], []);
    expect(result.items).toEqual([]);
    expect(result.addedCount).toBe(0);
    expect(result.skippedByLocalTombstoneCount).toBe(1);
    expect(result.tombstones).toEqual(localTombstones);
  });

  it('遠端傳來的墓碑會移除本機還留著、但別的裝置已經刪除的資料', () => {
    const result = merge([item('a')], [], [], [{ id: 'a', deletedAt: T1 }]);
    expect(result.items).toEqual([]);
    expect(result.removedByTombstoneCount).toBe(1);
  });

  it('遠端同時帶著資料與墓碑時(不同裝置的舊備份),不算成本機略過', () => {
    const result = merge([], [], [item('a')], [{ id: 'a', deletedAt: T1 }]);
    expect(result.items).toEqual([]);
    expect(result.skippedByLocalTombstoneCount).toBe(0);
  });

  it('刪除優先於編輯:本機較新的修改仍會被遠端墓碑移除', () => {
    const result = merge([item('a', 'A', T2)], [], [], [{ id: 'a', deletedAt: T1 }]);
    expect(result.items).toEqual([]);
  });

  it('同一個 id 雙方都有墓碑時,合併後保留 deletedAt 較新的那筆', () => {
    const result = merge([], [{ id: 'a', deletedAt: T1 }], [], [{ id: 'a', deletedAt: T2 }]);
    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: T2 }]);
  });

  it('完全沒有異動時,items 與 tombstones 保留原本的陣列參照,避免呼叫端誤判成本機資料異動', () => {
    const local = [item('a')];
    const localTombstones = [{ id: 'z', deletedAt: T1 }];
    const result = merge(local, localTombstones, [item('a')], [{ id: 'z', deletedAt: T1 }]);
    expect(result.items).toBe(local);
    expect(result.tombstones).toBe(localTombstones);
    expect(result.updatedCount).toBe(0);
  });
});

describe('mergeRecords 兩邊都有同一筆資料(resolveByUpdatedAt)', () => {
  it('遠端較新時採用遠端版本,並計入更新筆數', () => {
    const result = merge([item('a', '舊', T1)], [], [item('a', '新', T2)], []);
    expect(result.items).toEqual([item('a', '新', T2)]);
    expect(result.updatedCount).toBe(1);
  });

  it('本機較新時保留本機版本,不計入更新筆數', () => {
    const local = [item('a', '新', T2)];
    const result = merge(local, [], [item('a', '舊', T1)], []);
    expect(result.items).toBe(local);
    expect(result.updatedCount).toBe(0);
  });

  it('兩邊都是沒有修改紀錄的舊資料時保留本機,與升級前行為一致', () => {
    const local = [item('a', '本機', LEGACY_TIMESTAMP)];
    const result = merge(local, [], [item('a', '遠端', LEGACY_TIMESTAMP)], []);
    expect(result.items).toBe(local);
  });

  it('時間相同但內容不同時,兩台裝置各自合併都得到同一個版本', () => {
    const x = item('a', 'X', T1);
    const y = item('a', 'Y', T1);
    expect(resolveByUpdatedAt(x, y)).toEqual(resolveByUpdatedAt(y, x));
  });

  it('時間格式不同但代表同一時刻時視為相同時間(用數值比較而不是字串比較)', () => {
    const local = [item('a', 'A', '2026-01-01T08:00:00+08:00')];
    const result = merge(local, [], [item('a', 'A', T1)], []);
    expect(result.items[0].name).toBe('A');
  });

  it('時間格式錯誤視為最舊', () => {
    const result = merge([item('a', '壞', 'not-a-date')], [], [item('a', '好', T1)], []);
    expect(result.items[0].name).toBe('好');
  });
});

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: '角色',
    server: '艾麗亞',
    level: 200,
    job: 'Warrior',
    order: 0,
    source: 'manual',
    accountId: 'a1',
    updatedAt: T1,
    placementUpdatedAt: T1,
    ...overrides,
  };
}

describe('resolveCharacter', () => {
  it('角色資料與位置各自取較新者:一邊改等級、另一邊搬帳號,兩個修改都保留', () => {
    const local = character({ level: 210, updatedAt: T2 });
    const remote = character({ accountId: 'a2', order: 3, placementUpdatedAt: T2 });
    expect(resolveCharacter(local, remote)).toEqual(
      character({ level: 210, updatedAt: T2, accountId: 'a2', order: 3, placementUpdatedAt: T2 }),
    );
  });

  it('兩個時間都是本機較新時回傳本機物件本身', () => {
    const local = character({ level: 210, updatedAt: T2, placementUpdatedAt: T2 });
    expect(resolveCharacter(local, character())).toBe(local);
  });

  it('兩個時間都是遠端較新時回傳遠端物件本身', () => {
    const remote = character({ level: 210, updatedAt: T2, accountId: 'a2', placementUpdatedAt: T2 });
    expect(resolveCharacter(character(), remote)).toBe(remote);
  });
});
