import { beforeEach, describe, expect, it } from 'vitest';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload, pruneAllTombstones, TOMBSTONE_RETENTION_DAYS } from '@/lib/backupMerge';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import type { Account, Character, CharacterTask } from '@/types';
import { emptyWeaponSnapshot } from '@/lib/weapon/types';

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-02-01T00:00:00.000Z';

function makeAccount(id: string, order: number, updatedAt = OLD): Account {
  return { id, name: id, order, updatedAt };
}

function makeCharacter(id: string, accountId: string | null, order: number, placementUpdatedAt = OLD): Character {
  return {
    id,
    name: id,
    server: '艾麗亞',
    level: 1,
    job: 'Warrior',
    order,
    source: 'manual',
    accountId,
    updatedAt: OLD,
    placementUpdatedAt,
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

function emptyPayload(overrides: Partial<DriveBackupPayload> = {}): DriveBackupPayload {
  return {
    version: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
    accounts: [],
    accountTombstones: [],
    weapons: emptyWeaponSnapshot(),
    ...overrides,
  };
}

describe('mergeBackupPayload', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
    useTaskStore.setState({ tasks: [], deletedIds: [] });
    useBossStore.setState({ bosses: [], deletedIds: [] });
    useAccountStore.setState({ accounts: [], deletedIds: [] });
  });

  it('新增遠端有、本機沒有的角色/任務/BOSS,並回報新增筆數', () => {
    const payload = emptyPayload({
      characters: [
        { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual', accountId: null, updatedAt: '2026-01-01T00:00:00.000Z', placementUpdatedAt: '2026-01-01T00:00:00.000Z' },
      ],
      tasks: [
        {
          id: 't1',
          characterId: 'c1',
          name: '任務',
          category: '日常',
          resetCycle: 'daily',
          checked: false,
          lastResetAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          order: 0,
        },
      ],
    });
    const result = mergeBackupPayload(payload);
    expect(result).toEqual({
      addedAccounts: 0,
      addedCharacters: 1,
      addedTasks: 1,
      addedBosses: 0,
      updated: 0,
      removedByTombstone: 0,
      skippedByLocalTombstone: 0,
    });
    expect(useCharacterStore.getState().activeCharacterId).toBe('c1');
  });

  it('新增遠端有、本機沒有的帳號,並回報新增筆數', () => {
    const payload = emptyPayload({ accounts: [{ id: 'a1', name: '主力練功', order: 0, updatedAt: '2026-01-01T00:00:00.000Z' }] });
    const result = mergeBackupPayload(payload);
    expect(result.addedAccounts).toBe(1);
    expect(useAccountStore.getState().accounts).toEqual([{ id: 'a1', name: '主力練功', order: 0, updatedAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('遠端帳號墓碑會移除本機對應的帳號,並計入 removedByTombstone', () => {
    useAccountStore.setState({ accounts: [{ id: 'a1', name: '主力練功', order: 0, updatedAt: '2026-01-01T00:00:00.000Z' }], deletedIds: [] });
    const payload = emptyPayload({ accountTombstones: [{ id: 'a1', deletedAt: '2026-02-01T00:00:00.000Z' }] });
    const result = mergeBackupPayload(payload);
    expect(result.removedByTombstone).toBe(1);
    expect(useAccountStore.getState().accounts).toEqual([]);
  });

  it('本機原本沒有任何角色,合併新增角色後自動選中第一個', () => {
    const payload = emptyPayload({
      characters: [
        { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual', accountId: null, updatedAt: '2026-01-01T00:00:00.000Z', placementUpdatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    mergeBackupPayload(payload);
    expect(useCharacterStore.getState().activeCharacterId).toBe('c1');
  });

  it('遠端墓碑會移除本機目前選中、但已被其他裝置刪除的角色,並回退到下一個角色', () => {
    useCharacterStore.setState({
      characters: [
        { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual', accountId: null, updatedAt: '2026-01-01T00:00:00.000Z', placementUpdatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'c2', name: 'B', server: '艾麗亞', level: 1, job: 'Warrior', order: 1, source: 'manual', accountId: null, updatedAt: '2026-01-01T00:00:00.000Z', placementUpdatedAt: '2026-01-01T00:00:00.000Z' },
      ],
      activeCharacterId: 'c1',
      deletedIds: [],
    });
    const payload = emptyPayload({ characterTombstones: [{ id: 'c1', deletedAt: '2026-02-01T00:00:00.000Z' }] });
    const result = mergeBackupPayload(payload);
    expect(result.removedByTombstone).toBe(1);
    expect(useCharacterStore.getState().characters.map((c) => c.id)).toEqual(['c2']);
    expect(useCharacterStore.getState().activeCharacterId).toBe('c2');
  });

  it('本機 A1(C1,C2) A2(C3) A3,備份 A1(C1) A2(C2,C3) A3(C4):C2 依較新的位置搬到 A2,C4 被新增', () => {
    useAccountStore.setState({ accounts: [makeAccount('A1', 0), makeAccount('A2', 1), makeAccount('A3', 2)], deletedIds: [] });
    useCharacterStore.setState({
      characters: [makeCharacter('C1', 'A1', 0), makeCharacter('C2', 'A1', 1), makeCharacter('C3', 'A2', 2)],
      activeCharacterId: 'C1',
      deletedIds: [],
    });
    const payload = emptyPayload({
      accounts: [makeAccount('A1', 0), makeAccount('A2', 1), makeAccount('A3', 2)],
      characters: [
        makeCharacter('C1', 'A1', 0),
        makeCharacter('C2', 'A2', 1, NEW),
        makeCharacter('C3', 'A2', 2),
        makeCharacter('C4', 'A3', 3, NEW),
      ],
    });

    const result = mergeBackupPayload(payload);

    const placement = Object.fromEntries(useCharacterStore.getState().characters.map((c) => [c.id, c.accountId]));
    expect(placement).toEqual({ C1: 'A1', C2: 'A2', C3: 'A2', C4: 'A3' });
    expect(result.addedCharacters).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('本機較新的修改不會被備份裡的舊版本蓋掉', () => {
    useCharacterStore.setState({ characters: [makeCharacter('C1', 'A2', 0, NEW)], activeCharacterId: 'C1', deletedIds: [] });
    mergeBackupPayload(emptyPayload({ characters: [makeCharacter('C1', 'A1', 0)] }));
    expect(useCharacterStore.getState().characters[0].accountId).toBe('A2');
  });

  it('此裝置刪除過的資料不會被備份加回來,並計入略過筆數', () => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [{ id: 'C1', deletedAt: NEW }] });
    const result = mergeBackupPayload(emptyPayload({ characters: [makeCharacter('C1', null, 0)] }));
    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(result.skippedByLocalTombstone).toBe(1);
  });

  it('已刪除角色底下、由其他裝置新增的任務與 BOSS 會一併移除並記錄墓碑', () => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [{ id: 'C1', deletedAt: NEW }] });
    const payload = emptyPayload({
      tasks: [makeTask('t1', 'C1')],
      bosses: [
        {
          id: 'b1',
          characterId: 'C1',
          bossName: '測試王',
          difficulty: '普通',
          resetCycle: 'weekly',
          crystalValue: 1,
          partySize: 1,
          checked: false,
          lastResetAt: OLD,
          updatedAt: OLD,
        },
      ],
    });

    const result = mergeBackupPayload(payload);

    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useBossStore.getState().bosses).toEqual([]);
    expect(useTaskStore.getState().deletedIds.map((t) => t.id)).toEqual(['t1']);
    expect(useBossStore.getState().deletedIds.map((t) => t.id)).toEqual(['b1']);
    // 這兩筆從來沒出現在本機,不算新增也不算移除
    expect(result.addedTasks).toBe(0);
    expect(result.addedBosses).toBe(0);
    expect(result.removedByTombstone).toBe(0);
  });

  it('其他裝置刪除角色時,本機該角色底下的任務一併移除並計入移除筆數', () => {
    useCharacterStore.setState({ characters: [makeCharacter('C1', null, 0)], activeCharacterId: 'C1', deletedIds: [] });
    useTaskStore.setState({ tasks: [makeTask('t1', 'C1')], deletedIds: [] });

    const result = mergeBackupPayload(emptyPayload({ characterTombstones: [{ id: 'C1', deletedAt: NEW }] }));

    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().deletedIds.map((t) => t.id)).toEqual(['t1']);
    expect(result.removedByTombstone).toBe(2);
  });

  it('兩台裝置各自新增的任務合併後 order 撞號時,重新編號成連號', () => {
    useTaskStore.setState({ tasks: [makeTask('t-local', 'C1', { order: 0 })], deletedIds: [] });
    mergeBackupPayload(emptyPayload({ tasks: [makeTask('t-remote', 'C1', { order: 0 })] }));
    const orders = useTaskStore
      .getState()
      .tasks.map((t) => t.order)
      .sort();
    expect(orders).toEqual([0, 1]);
  });

  it('合併後重新跑重置檢查:備份裡較新、但已跨過重置點的勾選會被清掉', () => {
    useTaskStore.setState({ tasks: [makeTask('t1', 'C1', { resetCycle: 'daily' })], deletedIds: [] });
    mergeBackupPayload(
      emptyPayload({ tasks: [makeTask('t1', 'C1', { resetCycle: 'daily', checked: true, lastResetAt: NEW, updatedAt: NEW })] }),
    );
    const task = useTaskStore.getState().tasks[0];
    expect(task.checked).toBe(false);
    expect(task.updatedAt).toBe(NEW);
  });

  it('合併內容與本機完全相同時，store 裡的資料陣列維持原本的參照（不會被誤判成本機異動）', () => {
    const characters = [makeCharacter('C1', null, 0)];
    const tasks = [makeTask('t1', 'C1')];
    useCharacterStore.setState({ characters, activeCharacterId: 'C1', deletedIds: [] });
    useTaskStore.setState({ tasks, deletedIds: [] });

    mergeBackupPayload(emptyPayload({ characters: [makeCharacter('C1', null, 0)], tasks: [makeTask('t1', 'C1')] }));

    expect(useCharacterStore.getState().characters).toBe(characters);
    expect(useTaskStore.getState().tasks).toBe(tasks);
  });
});

describe('pruneAllTombstones', () => {
  it('清掉三個 store 裡超過保留天數的墓碑', () => {
    const old = new Date(Date.now() - (TOMBSTONE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();
    const tombstones = [
      { id: 'old', deletedAt: old },
      { id: 'recent', deletedAt: recent },
    ];
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: tombstones });
    useTaskStore.setState({ tasks: [], deletedIds: tombstones });
    useBossStore.setState({ bosses: [], deletedIds: tombstones });
    useAccountStore.setState({ accounts: [], deletedIds: tombstones });

    pruneAllTombstones();

    expect(useCharacterStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
    expect(useTaskStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
    expect(useBossStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
    expect(useAccountStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
  });
});
