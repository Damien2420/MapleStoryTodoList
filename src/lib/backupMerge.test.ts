import { beforeEach, describe, expect, it } from 'vitest';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload, pruneAllTombstones, TOMBSTONE_RETENTION_DAYS } from '@/lib/backupMerge';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';

function emptyPayload(overrides: Partial<DriveBackupPayload> = {}): DriveBackupPayload {
  return {
    version: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
    ...overrides,
  };
}

describe('mergeBackupPayload', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
    useTaskStore.setState({ tasks: [], deletedIds: [] });
    useBossStore.setState({ bosses: [], deletedIds: [] });
  });

  it('新增遠端有、本機沒有的角色/任務/BOSS,並回報新增筆數', () => {
    const payload = emptyPayload({
      characters: [{ id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' }],
      tasks: [
        {
          id: 't1',
          characterId: 'c1',
          name: '任務',
          category: '日常',
          resetCycle: 'daily',
          checked: false,
          lastResetAt: '2026-01-01T00:00:00.000Z',
          order: 0,
        },
      ],
    });
    const result = mergeBackupPayload(payload);
    expect(result).toEqual({ addedCharacters: 1, addedTasks: 1, addedBosses: 0, removedByTombstone: 0 });
    expect(useCharacterStore.getState().activeCharacterId).toBe('c1');
  });

  it('本機原本沒有任何角色,合併新增角色後自動選中第一個', () => {
    const payload = emptyPayload({
      characters: [{ id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' }],
    });
    mergeBackupPayload(payload);
    expect(useCharacterStore.getState().activeCharacterId).toBe('c1');
  });

  it('遠端墓碑會移除本機目前選中、但已被其他裝置刪除的角色,並回退到下一個角色', () => {
    useCharacterStore.setState({
      characters: [
        { id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' },
        { id: 'c2', name: 'B', server: '艾麗亞', level: 1, job: 'Warrior', order: 1, source: 'manual' },
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

    pruneAllTombstones();

    expect(useCharacterStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
    expect(useTaskStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
    expect(useBossStore.getState().deletedIds.map((t) => t.id)).toEqual(['recent']);
  });
});
