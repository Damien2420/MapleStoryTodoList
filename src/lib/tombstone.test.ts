import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTombstones, clearTombstone, pruneTombstones, recordTombstone, type Tombstone } from '@/lib/tombstone';

describe('recordTombstone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('新增一筆墓碑,deletedAt 為呼叫當下的時間', () => {
    const result = recordTombstone([], 'a');
    expect(result).toEqual([{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('同一個 id 已有舊墓碑時,用新紀錄取代,不重複', () => {
    const existing: Tombstone[] = [{ id: 'a', deletedAt: '2025-01-01T00:00:00.000Z' }];
    const result = recordTombstone(existing, 'a');
    expect(result).toEqual([{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }]);
  });
});

describe('clearTombstone', () => {
  it('移除指定 id 的墓碑,保留其他墓碑', () => {
    const tombstones: Tombstone[] = [
      { id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', deletedAt: '2026-01-01T00:00:00.000Z' },
    ];
    expect(clearTombstone(tombstones, 'a')).toEqual([{ id: 'b', deletedAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('id 不存在時原樣返回', () => {
    const tombstones: Tombstone[] = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    expect(clearTombstone(tombstones, 'x')).toEqual(tombstones);
  });
});

describe('pruneTombstones', () => {
  const now = new Date('2026-04-01T00:00:00.000Z');

  it('保留期內的墓碑保留,超過保留期的清除', () => {
    const tombstones: Tombstone[] = [
      { id: 'recent', deletedAt: '2026-03-20T00:00:00.000Z' }, // 12 天前,保留
      { id: 'old', deletedAt: '2025-12-01T00:00:00.000Z' }, // 121 天前,清除
    ];
    expect(pruneTombstones(tombstones, 90, now)).toEqual([tombstones[0]]);
  });

  it('剛好等於保留天數的邊界值予以保留', () => {
    const boundary = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const tombstones: Tombstone[] = [{ id: 'boundary', deletedAt: boundary }];
    expect(pruneTombstones(tombstones, 90, now)).toEqual(tombstones);
  });
});

interface Item {
  id: string;
  name: string;
}

describe('applyTombstones', () => {
  it('遠端有、本機沒有、沒被墓碑擋住的項目會被新增', () => {
    const local: Item[] = [{ id: 'a', name: 'A' }];
    const remote: Item[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const result = applyTombstones(local, [], remote, []);
    expect(result.items).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    expect(result.addedCount).toBe(1);
    expect(result.removedByRemoteTombstoneCount).toBe(0);
  });

  it('本機自己的墓碑會擋住遠端傳來的舊資料,不會被還原復活', () => {
    const localTombstones = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const remote: Item[] = [{ id: 'a', name: 'A' }];
    const result = applyTombstones([], localTombstones, remote, []);
    expect(result.items).toEqual([]);
    expect(result.addedCount).toBe(0);
    expect(result.tombstones).toEqual(localTombstones);
  });

  it('遠端傳來的墓碑會移除本機還留著、但別的裝置已經刪除的資料', () => {
    const local: Item[] = [{ id: 'a', name: 'A' }];
    const remoteTombstones = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const result = applyTombstones(local, [], [], remoteTombstones);
    expect(result.items).toEqual([]);
    expect(result.removedByRemoteTombstoneCount).toBe(1);
  });

  it('同一個 id 雙方都有墓碑時,合併後保留 deletedAt 較新的那筆', () => {
    const localTombstones = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const remoteTombstones = [{ id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' }];
    const result = applyTombstones([], localTombstones, [], remoteTombstones);
    expect(result.tombstones).toEqual([{ id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' }]);
  });

  it('新增與刪除可以同時發生,互不影響', () => {
    const local: Item[] = [{ id: 'a', name: 'A' }];
    const localTombstones = [{ id: 'b', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const remote: Item[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const result = applyTombstones(local, localTombstones, remote, []);
    expect(result.items.map((i) => i.id).sort()).toEqual(['a', 'c']);
    expect(result.addedCount).toBe(1);
  });

  it('完全沒有新增或移除時,items 與 tombstones 保留原本的陣列參照,避免呼叫端誤判成本機資料異動', () => {
    const local: Item[] = [{ id: 'a', name: 'A' }];
    const localTombstones = [{ id: 'z', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const result = applyTombstones(local, localTombstones, [], []);
    expect(result.items).toBe(local);
    expect(result.tombstones).toBe(localTombstones);
  });

  it('遠端資料本機都已經有,沒有新項目要新增時,items 保留原本的陣列參照', () => {
    const local: Item[] = [{ id: 'a', name: 'A' }];
    const remote: Item[] = [{ id: 'a', name: 'A' }];
    const result = applyTombstones(local, [], remote, []);
    expect(result.items).toBe(local);
  });

  it('遠端墓碑跟本機完全一樣(沒有更新的)時,tombstones 保留原本的陣列參照', () => {
    const localTombstones = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const remoteTombstones = [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }];
    const result = applyTombstones([], localTombstones, [], remoteTombstones);
    expect(result.tombstones).toBe(localTombstones);
  });
});
