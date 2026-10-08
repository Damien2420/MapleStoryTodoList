import { describe, expect, it } from 'vitest';
import { restoreSnapshot } from '@/lib/sync/restore';
import { mergeSnapshots } from '@/lib/sync/snapshot';
import { T0, character, emptySnapshot, ids, task } from '@/lib/sync/syncTestKit';

const NOW = new Date('2026-10-09T00:00:00.000Z');
const STAMP = NOW.toISOString();
const OLD = T0.toISOString();

function idCounter(): () => string {
  let n = 0;
  return () => `new-${++n}`;
}

describe('restoreSnapshot', () => {
  it('還原的每一筆資料都改成現在的修改時間（角色的位置時間也一起改），其他內容不變', () => {
    const target = emptySnapshot({
      accounts: [{ id: 'a1', name: 'A', order: 0, updatedAt: OLD }],
      characters: [character('c1', OLD, { level: 200 })],
      tasks: [task('t1', 'c1')],
    });
    const result = restoreSnapshot(emptySnapshot(), target, NOW, idCounter());
    expect(result.accounts).toEqual([{ id: 'a1', name: 'A', order: 0, updatedAt: STAMP }]);
    expect(result.characters).toEqual([{ ...target.characters[0], updatedAt: STAMP, placementUpdatedAt: STAMP }]);
    expect(result.tasks).toEqual([{ ...target.tasks[0], updatedAt: STAMP }]);
  });

  it('目前有、要還原的資料沒有的紀錄全部寫上墓碑', () => {
    const current = emptySnapshot({ characters: [character('keep'), character('drop')], tasks: [task('t-drop', 'drop')] });
    const target = emptySnapshot({ characters: [character('keep')] });
    const result = restoreSnapshot(current, target, NOW, idCounter());
    expect(ids(result.characters)).toEqual(['keep']);
    expect(result.characterTombstones).toEqual([{ id: 'drop', deletedAt: STAMP }]);
    expect(result.taskTombstones).toEqual([{ id: 't-drop', deletedAt: STAMP }]);
  });

  it('要還原的紀錄先前被刪除過（目前有墓碑）時改用新 id，任務與所屬帳號的關聯跟著換，舊 id 的墓碑保留', () => {
    const current = emptySnapshot({
      accountTombstones: [{ id: 'a-old', deletedAt: OLD }],
      characterTombstones: [{ id: 'c-old', deletedAt: OLD }],
    });
    const target = emptySnapshot({
      accounts: [{ id: 'a-old', name: 'A', order: 0, updatedAt: OLD }],
      characters: [character('c-old', OLD, { accountId: 'a-old' })],
      tasks: [task('t1', 'c-old')],
    });
    const result = restoreSnapshot(current, target, NOW, idCounter());
    expect(result.accounts.map((a) => a.id)).toEqual(['new-1']);
    expect(result.characters[0]).toMatchObject({ id: 'new-2', name: 'c-old', accountId: 'new-1' });
    expect(result.tasks[0]).toMatchObject({ id: 't1', characterId: 'new-2' });
    expect(result.characterTombstones).toEqual([{ id: 'c-old', deletedAt: OLD }]);
    expect(result.accountTombstones).toEqual([{ id: 'a-old', deletedAt: OLD }]);
  });

  it('目前與要還原的資料各自的墓碑都保留', () => {
    const current = emptySnapshot({ taskTombstones: [{ id: 't-a', deletedAt: OLD }] });
    const target = emptySnapshot({ tasks: [task('t1', 'c1')], taskTombstones: [{ id: 't-b', deletedAt: OLD }] });
    expect(ids(restoreSnapshot(current, target, NOW, idCounter()).taskTombstones)).toEqual(['t-a', 't-b']);
  });

  it('還保留舊資料的裝置拿還原結果合併後與還原內容一致：被移除的不復活，還原的不被舊版本蓋掉', () => {
    const current = emptySnapshot({
      characters: [character('c1', OLD, { level: 250 }), character('c2')],
      characterTombstones: [{ id: 'c3', deletedAt: OLD }],
    });
    const target = emptySnapshot({ characters: [character('c1', OLD, { level: 100 }), character('c3')] });
    const restored = restoreSnapshot(current, target, NOW, idCounter());
    const { merged } = mergeSnapshots(current, restored);
    expect(merged.characters.map((c) => [c.name, c.level]).sort()).toEqual([
      ['c1', 100],
      ['c3', 1],
    ]);
  });

  it('不修改傳入的快照', () => {
    const current = emptySnapshot({ characters: [character('c1')], characterTombstones: [{ id: 'c2', deletedAt: OLD }] });
    const target = emptySnapshot({ characters: [character('c2')] });
    const currentCopy = structuredClone(current);
    const targetCopy = structuredClone(target);
    restoreSnapshot(current, target, NOW, idCounter());
    expect(current).toEqual(currentCopy);
    expect(target).toEqual(targetCopy);
  });
});
