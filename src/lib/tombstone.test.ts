import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTombstone, pruneTombstones, recordTombstone, type Tombstone } from '@/lib/tombstone';

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
