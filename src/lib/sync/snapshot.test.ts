import { describe, expect, it } from 'vitest';
import type { Account, Character, CharacterBossTrackList, CharacterTask } from '@/types';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { mergeSnapshots, pruneSnapshot, snapshotFromPayload, type DataSnapshot } from '@/lib/sync/snapshot';

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-02-01T00:00:00.000Z';

function makeAccount(id: string): Account {
  return { id, name: id, order: 0, updatedAt: OLD };
}

function makeCharacter(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    server: '艾麗亞',
    level: 1,
    job: 'Warrior',
    order: 0,
    source: 'manual',
    accountId: null,
    updatedAt: OLD,
    placementUpdatedAt: OLD,
    ...overrides,
  };
}

function makeTask(id: string, characterId: string, overrides: Partial<CharacterTask> = {}): CharacterTask {
  return {
    id,
    characterId,
    name: id,
    category: '日常',
    resetCycle: 'once',
    checked: false,
    lastResetAt: OLD,
    order: 0,
    updatedAt: OLD,
    ...overrides,
  };
}

function makeBoss(id: string, characterId: string): CharacterBossTrackList {
  return {
    id,
    characterId,
    bossName: '測試王',
    difficulty: '普通',
    resetCycle: 'weekly',
    crystalValue: 1,
    partySize: 1,
    checked: false,
    lastResetAt: OLD,
    updatedAt: OLD,
  };
}

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
    ...overrides,
  };
}

describe('snapshotFromPayload', () => {
  it('去掉 version 與 createdAt，只留下資料與墓碑', () => {
    const payload: DriveBackupPayload = { version: 6, createdAt: NEW, ...snapshot({ accounts: [makeAccount('a1')] }) };
    expect(snapshotFromPayload(payload)).toEqual(snapshot({ accounts: [makeAccount('a1')] }));
  });
});

describe('mergeSnapshots', () => {
  it('新增遠端有、本機沒有的資料，並回報各類新增筆數', () => {
    const remote = snapshot({
      accounts: [makeAccount('a1')],
      characters: [makeCharacter('c1')],
      tasks: [makeTask('t1', 'c1')],
      bosses: [makeBoss('b1', 'c1')],
    });
    const { merged, result } = mergeSnapshots(snapshot(), remote);
    expect(merged.characters.map((c) => c.id)).toEqual(['c1']);
    expect(result).toEqual({
      addedAccounts: 1,
      addedCharacters: 1,
      addedTasks: 1,
      addedBosses: 1,
      updated: 0,
      removedByTombstone: 0,
      skippedByLocalTombstone: 0,
    });
  });

  it('遠端帶進來、但所屬角色已被刪除的任務與 BOSS 會被丟掉並補墓碑，不算新增也不算移除', () => {
    const local = snapshot({ characterTombstones: [{ id: 'c1', deletedAt: NEW }] });
    const remote = snapshot({ tasks: [makeTask('t1', 'c1')], bosses: [makeBoss('b1', 'c1')] });
    const { merged, result } = mergeSnapshots(local, remote);
    expect(merged.tasks).toEqual([]);
    expect(merged.bosses).toEqual([]);
    expect(merged.taskTombstones.map((t) => t.id)).toEqual(['t1']);
    expect(merged.bossTombstones.map((t) => t.id)).toEqual(['b1']);
    expect(result.addedTasks).toBe(0);
    expect(result.addedBosses).toBe(0);
    expect(result.removedByTombstone).toBe(0);
  });

  it('遠端刪除角色時，本機該角色底下的任務一併移除並計入移除筆數', () => {
    const local = snapshot({ characters: [makeCharacter('c1')], tasks: [makeTask('t1', 'c1')] });
    const remote = snapshot({ characterTombstones: [{ id: 'c1', deletedAt: NEW }] });
    const { merged, result } = mergeSnapshots(local, remote);
    expect(merged.characters).toEqual([]);
    expect(merged.tasks).toEqual([]);
    expect(merged.taskTombstones.map((t) => t.id)).toEqual(['t1']);
    expect(result.removedByTombstone).toBe(2);
  });

  it('兩邊各自新增的任務 order 撞號時重新編號成連號', () => {
    const local = snapshot({ tasks: [makeTask('t-local', 'c1', { order: 0 })] });
    const remote = snapshot({ tasks: [makeTask('t-remote', 'c1', { order: 0 })] });
    const { merged } = mergeSnapshots(local, remote);
    expect(merged.tasks.map((t) => t.order).sort()).toEqual([0, 1]);
  });

  it('合併結果與本機相同時，四個資料陣列維持本機原本的參照', () => {
    const local = snapshot({
      accounts: [makeAccount('a1')],
      characters: [makeCharacter('c1')],
      tasks: [makeTask('t1', 'c1')],
      bosses: [makeBoss('b1', 'c1')],
    });
    const remote = snapshot({
      accounts: [makeAccount('a1')],
      characters: [makeCharacter('c1')],
      tasks: [makeTask('t1', 'c1')],
      bosses: [makeBoss('b1', 'c1')],
    });
    const { merged } = mergeSnapshots(local, remote);
    expect(merged.accounts).toBe(local.accounts);
    expect(merged.characters).toBe(local.characters);
    expect(merged.tasks).toBe(local.tasks);
    expect(merged.bosses).toBe(local.bosses);
  });

  it('不修改傳入的本機與遠端快照', () => {
    const local = snapshot({ characters: [makeCharacter('c1')], tasks: [makeTask('t1', 'c1')] });
    const remote = snapshot({
      characters: [makeCharacter('c1', { level: 200, updatedAt: NEW })],
      characterTombstones: [{ id: 'c9', deletedAt: NEW }],
      tasks: [makeTask('t2', 'c1')],
    });
    const localCopy = structuredClone(local);
    const remoteCopy = structuredClone(remote);
    mergeSnapshots(local, remote);
    expect(local).toEqual(localCopy);
    expect(remote).toEqual(remoteCopy);
  });
});

describe('pruneSnapshot', () => {
  it('四種墓碑都只保留未超過保留天數的紀錄，資料本身不變', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const old = { id: 'old', deletedAt: '2026-01-01T00:00:00.000Z' };
    const recent = { id: 'recent', deletedAt: '2026-05-25T00:00:00.000Z' };
    const input = snapshot({
      characters: [makeCharacter('c1')],
      accountTombstones: [old, recent],
      characterTombstones: [old, recent],
      taskTombstones: [old, recent],
      bossTombstones: [old, recent],
    });
    const pruned = pruneSnapshot(input, 90, now);
    expect(pruned.characters).toBe(input.characters);
    expect(pruned.accountTombstones).toEqual([recent]);
    expect(pruned.characterTombstones).toEqual([recent]);
    expect(pruned.taskTombstones).toEqual([recent]);
    expect(pruned.bossTombstones).toEqual([recent]);
  });
});
