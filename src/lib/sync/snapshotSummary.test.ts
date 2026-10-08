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
  it('列出以 target 取代 current 後各類新增、刪除、內容變更的筆數與角色名稱；只差在修改時間不算變更', () => {
    const current = emptySnapshot({
      characters: [character('same'), character('changed'), character('removed')],
      tasks: [task('t1', 'same')],
    });
    const target = emptySnapshot({
      characters: [character('same', '2026-12-01T00:00:00.000Z'), character('changed', OLD, { level: 99 }), character('added')],
      tasks: [task('t1', 'same'), task('t2', 'same')],
    });
    expect(describeOverwrite(current, target)).toEqual({
      accounts: { added: 0, removed: 0, changed: 0 },
      characters: { added: 1, removed: 1, changed: 1 },
      tasks: { added: 1, removed: 0, changed: 0 },
      bosses: { added: 0, removed: 0, changed: 0 },
      addedCharacterNames: ['added'],
      removedCharacterNames: ['removed'],
    });
  });
});
