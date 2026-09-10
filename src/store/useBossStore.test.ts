import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBossStore } from '@/store/useBossStore';

function seedBoss() {
  useBossStore.setState({
    bosses: [
      {
        id: 'b1',
        characterId: 'c1',
        bossName: 'testBoss',
        difficulty: '簡單',
        resetCycle: 'weekly',
        crystalValue: 100,
        partySize: 1,
        checked: false,
        lastResetAt: '2026-01-01T00:00:00.000Z',
        order: 0,
      },
    ],
    deletedIds: [],
  });
}

describe('useBossStore 墓碑相關行為', () => {
  beforeEach(() => {
    useBossStore.setState({ bosses: [], deletedIds: [] });
  });

  it('removeBoss 寫入墓碑', () => {
    seedBoss();
    useBossStore.getState().removeBoss('b1');
    expect(useBossStore.getState().deletedIds.map((t) => t.id)).toEqual(['b1']);
    expect(useBossStore.getState().bosses).toEqual([]);
  });

  it('restoreBoss(undo)會清掉剛才寫入的墓碑', () => {
    seedBoss();
    const boss = useBossStore.getState().bosses[0];
    useBossStore.getState().removeBoss('b1');
    useBossStore.getState().restoreBoss(boss);
    expect(useBossStore.getState().deletedIds).toEqual([]);
    expect(useBossStore.getState().bosses).toEqual([boss]);
  });

  it('removeBossesForCharacter 對每一筆被刪除的 BOSS 都寫入墓碑', () => {
    seedBoss();
    useBossStore.getState().removeBossesForCharacter('c1');
    expect(useBossStore.getState().deletedIds).toHaveLength(1);
    expect(useBossStore.getState().bosses).toEqual([]);
  });
});

describe('useBossStore migration v1 -> v2', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('舊版(v1)persisted state 沒有 deletedIds,migrate 後補上空陣列', async () => {
    localStorage.setItem(
      'maplestory-todolist-bosses',
      JSON.stringify({
        state: {
          bosses: [
            {
              id: 'b1',
              characterId: 'c1',
              bossName: 'testBoss',
              difficulty: '簡單',
              resetCycle: 'weekly',
              crystalValue: 100,
              partySize: 1,
              checked: false,
              lastResetAt: '2026-01-01T00:00:00.000Z',
              order: 0,
            },
          ],
        },
        version: 1,
      }),
    );
    const { useBossStore: freshStore } = await import('@/store/useBossStore');
    expect(freshStore.getState().deletedIds).toEqual([]);
    expect(freshStore.getState().bosses).toHaveLength(1);
  });
});
