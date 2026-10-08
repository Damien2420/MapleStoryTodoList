import { describe, expect, it } from 'vitest';
import { describeOverwrite, summarizeSnapshot } from '@/lib/sync/snapshotSummary';
import { T0, character, emptySnapshot, task } from '@/lib/sync/syncTestKit';

const OLD = T0.toISOString();

describe('summarizeSnapshot', () => {
  it('計算各類筆數，最後修改時間取所有資料與刪除紀錄裡最晚的時間', () => {
    const snapshot = emptySnapshot({
      characters: [character('c1', '2026-10-01T00:00:00.000Z')],
      tasks: [task('t1', 'c1', '2026-10-03T00:00:00.000Z')],
      characterTombstones: [{ id: 'x', deletedAt: '2026-10-05T00:00:00.000Z' }],
    });
    expect(summarizeSnapshot(snapshot)).toEqual({
      accounts: 0,
      characters: 1,
      tasks: 1,
      bosses: 0,
      lastModifiedAt: '2026-10-05T00:00:00.000Z',
    });
  });

  it('沒有任何資料時最後修改時間為 undefined', () => {
    expect(summarizeSnapshot(emptySnapshot()).lastModifiedAt).toBeUndefined();
  });
});

describe('describeOverwrite', () => {
  const NEW = '2026-12-01T00:00:00.000Z';

  it('列出加入、移除與進度不同的角色；只差在修改時間或重置時間不算不同', () => {
    const current = emptySnapshot({
      characters: [character('same'), character('profile'), character('progress'), character('removed')],
      tasks: [task('t1', 'same'), task('t2', 'progress'), task('gone', 'removed')],
    });
    const target = emptySnapshot({
      characters: [character('same', NEW), character('profile', OLD, { level: 99 }), character('progress'), character('added')],
      tasks: [
        { ...task('t1', 'same', NEW), lastResetAt: NEW },
        { ...task('t2', 'progress', NEW), checked: true },
        task('t3', 'added'),
        task('t4', 'added'),
      ],
    });
    expect(describeOverwrite(current, target)).toEqual({
      addedCharacterNames: ['added'],
      removedCharacterNames: ['removed'],
      changedCharacterNames: ['profile', 'progress'],
      newerCharacterNames: [],
      accountsChanged: false,
    });
  });

  it('被取代的一方有較新的修改，或有對方沒有的任務時，列為較新', () => {
    const current = emptySnapshot({
      characters: [character('c1'), character('c2')],
      tasks: [{ ...task('t1', 'c1', NEW), checked: true }, task('only-here', 'c2')],
    });
    const target = emptySnapshot({
      characters: [character('c1'), character('c2')],
      tasks: [task('t1', 'c1')],
    });
    const impact = describeOverwrite(current, target);
    expect(impact.changedCharacterNames).toEqual(['c1', 'c2']);
    expect(impact.newerCharacterNames).toEqual(['c1', 'c2']);
  });

  it('帳號設定不同時標記；新增帳號不算', () => {
    const account = (id: string, name = id) => ({ id, name, order: 0, updatedAt: OLD });
    const current = emptySnapshot({ accounts: [account('a1')] });
    expect(describeOverwrite(current, emptySnapshot({ accounts: [account('a1'), account('a2')] })).accountsChanged).toBe(false);
    expect(describeOverwrite(current, emptySnapshot({ accounts: [account('a1', '改名')] })).accountsChanged).toBe(true);
    expect(describeOverwrite(current, emptySnapshot()).accountsChanged).toBe(true);
  });
});
