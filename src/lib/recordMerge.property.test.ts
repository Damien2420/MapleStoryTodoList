import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mergeRecords, resolveByUpdatedAt } from '@/lib/recordMerge';
import type { Tombstone } from '@/lib/tombstone';

interface Rec {
  id: string;
  updatedAt: string;
  value: number;
}

/** 一台裝置上某一類資料的狀態：資料與墓碑 */
interface Side {
  items: Rec[];
  tombstones: Tombstone[];
}

// id 只從少量候選裡挑，讓兩邊大量重疊，才測得到「兩邊都有」與「一邊刪一邊改」的情況
const IDS = ['a', 'b', 'c', 'd', 'e'];
// 刻意只用有效時間：兩邊都沒有修改時間（舊資料）時保留本機，是 recordMerge.test.ts 已釘住的已知不對稱行為，
// 混進產生器會讓「順序無關」性質對這種舊資料誤報失敗
const TIMES = ['2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z'];

const sideArb: fc.Arbitrary<Side> = fc
  .record({
    items: fc.uniqueArray(
      fc.record({ id: fc.constantFrom(...IDS), updatedAt: fc.constantFrom(...TIMES), value: fc.integer({ min: 0, max: 3 }) }),
      { selector: (r) => r.id, maxLength: IDS.length },
    ),
    tombstones: fc.uniqueArray(fc.record({ id: fc.constantFrom(...IDS), deletedAt: fc.constantFrom(...TIMES) }), {
      selector: (t) => t.id,
      maxLength: 3,
    }),
  })
  // 同一台裝置上不會同時有某筆資料又有它的墓碑（復原刪除時會清掉墓碑）
  .map(({ items, tombstones }) => ({
    items: items.filter((item) => !tombstones.some((t) => t.id === item.id)),
    tombstones,
  }));

function merge(local: Side, remote: Side) {
  return mergeRecords(local.items, local.tombstones, remote.items, remote.tombstones, resolveByUpdatedAt);
}

function sortById<T extends { id: string }>(list: T[]): T[] {
  return [...list].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

describe('mergeRecords 屬性', () => {
  it('冪等：跟自己合併，結果沿用原本的陣列參照且沒有任何異動', () => {
    fc.assert(
      fc.property(sideArb, (side) => {
        const result = merge(side, side);
        expect(result.items).toBe(side.items);
        expect(result.tombstones).toBe(side.tombstones);
        expect(result.addedCount + result.updatedCount + result.removedByTombstoneCount).toBe(0);
      }),
    );
  });

  it('順序無關：A 合併 B 與 B 合併 A 得到相同的資料與墓碑（依 id 排序後比較）', () => {
    fc.assert(
      fc.property(sideArb, sideArb, (a, b) => {
        const ab = merge(a, b);
        const ba = merge(b, a);
        expect(sortById(ab.items)).toEqual(sortById(ba.items));
        expect(sortById(ab.tombstones)).toEqual(sortById(ba.tombstones));
      }),
    );
  });

  it('刪除優先：任一邊有墓碑的 id，合併後一定不在資料裡', () => {
    fc.assert(
      fc.property(sideArb, sideArb, (a, b) => {
        const deleted = new Set([...a.tombstones, ...b.tombstones].map((t) => t.id));
        expect(merge(a, b).items.some((item) => deleted.has(item.id))).toBe(false);
      }),
    );
  });

  it('不遺失：任一邊有、且沒有被任何墓碑刪除的 id，合併後一定還在', () => {
    fc.assert(
      fc.property(sideArb, sideArb, (a, b) => {
        const deleted = new Set([...a.tombstones, ...b.tombstones].map((t) => t.id));
        const expected = new Set([...a.items, ...b.items].map((item) => item.id).filter((id) => !deleted.has(id)));
        expect(new Set(merge(a, b).items.map((item) => item.id))).toEqual(expected);
      }),
    );
  });

  it('收斂後穩定：合併結果再跟同一個遠端合併一次，不會再有任何變化', () => {
    fc.assert(
      fc.property(sideArb, sideArb, (a, b) => {
        const once = merge(a, b);
        const twice = merge({ items: once.items, tombstones: once.tombstones }, b);
        expect(twice.items).toBe(once.items);
        expect(twice.tombstones).toBe(once.tombstones);
      }),
    );
  });
});
