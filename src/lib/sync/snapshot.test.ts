import { describe, expect, it } from 'vitest';
import type { Account, Character, CharacterBossTrackList, CharacterTask } from '@/types';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { hasUnpushedContent, mergeSnapshots, pruneSnapshot, snapshotFromPayload, type DataSnapshot } from '@/lib/sync/snapshot';
import { emptyWeaponSnapshot } from '@/lib/weapon/types';
import { adjust, at, clear } from '@/lib/weapon/testUtils';

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
    weapons: emptyWeaponSnapshot(),
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

  it('合併武器進度；被刪除角色的武器資料一併移除；兩邊都沒有武器變化時沿用本機的武器物件', () => {
    const e1 = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const local = snapshot({ characters: [makeCharacter('c1')] });
    const remote = snapshot({ characters: [makeCharacter('c1')], weapons: { ...emptyWeaponSnapshot(), events: [e1] } });
    expect(mergeSnapshots(local, remote).merged.weapons.events).toEqual([e1]);

    const deleted = snapshot({ characterTombstones: [{ id: 'c1', deletedAt: NEW }] });
    expect(mergeSnapshots(remote, deleted).merged.weapons.events).toEqual([]);

    expect(mergeSnapshots(local, snapshot()).merged.weapons).toBe(local.weapons);
  });
});

describe('hasUnpushedContent', () => {
  it('雲端沒有的資料、本機較新的資料、雲端沒有的墓碑都算', () => {
    const remote = snapshot({ characters: [makeCharacter('c1')] });
    expect(hasUnpushedContent(remote, remote)).toBe(false);
    expect(hasUnpushedContent(snapshot({ characters: [makeCharacter('c1'), makeCharacter('c2')] }), remote)).toBe(true);
    expect(hasUnpushedContent(snapshot({ characters: [makeCharacter('c1', { updatedAt: NEW })] }), remote)).toBe(true);
    expect(hasUnpushedContent(snapshot({ characters: [makeCharacter('c1', { placementUpdatedAt: NEW })] }), remote)).toBe(true);
    expect(hasUnpushedContent(snapshot({ characters: [makeCharacter('c1')], taskTombstones: [{ id: 't9', deletedAt: NEW }] }), remote)).toBe(true);
  });

  it('時間相同但內容不同、或雲端較新的資料不算', () => {
    const remote = snapshot({ characters: [makeCharacter('c1', { updatedAt: NEW })], tasks: [makeTask('t1', 'c1')] });
    const local = snapshot({ characters: [makeCharacter('c1', { name: '改名' })], tasks: [makeTask('t1', 'c1', { checked: true })] });
    expect(hasUnpushedContent(local, remote)).toBe(false);
  });

  it('武器事件比較修改時間；擊破紀錄由勾選框衍生，只看 id', () => {
    const later = '2026-12-01T00:00:00.000Z';
    const e1 = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const c1 = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() });
    const remote = snapshot({ weapons: { ...emptyWeaponSnapshot(), events: [e1], bossClears: [c1] } });
    const local = (patch: Partial<DataSnapshot['weapons']>) => snapshot({ weapons: { ...remote.weapons, ...patch } });
    expect(hasUnpushedContent(local({ events: [{ ...e1, updatedAt: later }] }), remote)).toBe(true);
    expect(hasUnpushedContent(local({ bossClears: [{ ...c1, active: false, updatedAt: later }] }), remote)).toBe(false);
    expect(hasUnpushedContent(local({ bossClears: [c1, { ...c1, id: 'c1:will:n:x' }] }), remote)).toBe(true);
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
