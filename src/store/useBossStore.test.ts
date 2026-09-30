import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterBossTrackList } from '@/types';
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
        updatedAt: '2026-01-01T00:00:00.000Z',
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

  it('removeBossesByIds 只對實際存在並被刪除的 BOSS 寫入墓碑', () => {
    seedBoss();
    useBossStore.getState().removeBossesByIds(['b1', 'not-exist']);
    expect(useBossStore.getState().deletedIds.map((t) => t.id)).toEqual(['b1']);
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
              updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('useBossStore migration v2 -> v3', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('舊版(v2)persisted state 的 order 欄位在 migrate 後被移除,顯示順序改依 BOSS_CATALOG 目錄即時計算', async () => {
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
              updatedAt: '2026-01-01T00:00:00.000Z',
              order: 0,
            },
          ],
          deletedIds: [],
        },
        version: 2,
      }),
    );
    const { useBossStore: freshStore } = await import('@/store/useBossStore');
    expect(freshStore.getState().bosses[0]).not.toHaveProperty('order');
  });
});

/** 建立測試用的完整 BOSS 追蹤紀錄,預設為炎魔普通(日王),可用 overrides 覆寫 */
function makeTracked(overrides: Partial<CharacterBossTrackList>): CharacterBossTrackList {
  return {
    id: 'b1',
    characterId: 'c1',
    bossName: '炎魔',
    difficulty: '普通',
    resetCycle: 'daily',
    bossCatalogId: 'zakum',
    crystalValue: 384_000,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seed(bosses: CharacterBossTrackList[]) {
  useBossStore.setState({ bosses, deletedIds: [] });
}

function findBoss(id: string) {
  return useBossStore.getState().bosses.find((b) => b.id === id);
}

describe('useBossStore.changeBossDifficulty', () => {
  beforeEach(() => {
    useBossStore.setState({ bosses: [], deletedIds: [] });
  });

  it('切換難度時更新 difficulty 並換成新難度的目錄收益', () => {
    seed([makeTracked({})]);
    useBossStore.getState().changeBossDifficulty('b1', '簡單');
    expect(findBoss('b1')).toMatchObject({ difficulty: '簡單', crystalValue: 115_800 });
  });

  it('一般週王切換難度時同步 weeklyResetDay', () => {
    seed([
      makeTracked({
        bossName: '露希妲',
        bossCatalogId: 'lucid',
        difficulty: '簡單',
        resetCycle: 'weekly',
        weeklyResetDay: 2,
        crystalValue: 53_800_000,
      }),
    ]);
    useBossStore.getState().changeBossDifficulty('b1', '困難');
    expect(findBoss('b1')).toMatchObject({ difficulty: '困難', weeklyResetDay: 4, crystalValue: 102_400_000 });
  });

  it('攻略人數超過新難度上限時夾到上限(史烏困難 5 人換成極限剩 3 人)', () => {
    seed([
      makeTracked({
        bossName: '史烏',
        bossCatalogId: 'lotus',
        difficulty: '困難',
        resetCycle: 'weekly',
        weeklyResetDay: 4,
        partySize: 5,
      }),
    ]);
    useBossStore.getState().changeBossDifficulty('b1', '極限');
    expect(findBoss('b1')?.partySize).toBe(3);
  });

  it('保留 checked 與 lastResetAt', () => {
    seed([makeTracked({ checked: true, lastResetAt: '2026-03-03T00:00:00.000Z' })]);
    useBossStore.getState().changeBossDifficulty('b1', '簡單');
    expect(findBoss('b1')).toMatchObject({ checked: true, lastResetAt: '2026-03-03T00:00:00.000Z' });
  });

  it('updatedAt 遞增,即使原本的時間比現在還晚(其他裝置時鐘較快)', () => {
    const future = '2999-01-01T00:00:00.000Z';
    seed([makeTracked({ updatedAt: future })]);
    useBossStore.getState().changeBossDifficulty('b1', '簡單');
    expect(Date.parse(findBoss('b1')!.updatedAt)).toBeGreaterThan(Date.parse(future));
  });

  it('目標難度不在候選內時不做任何事(日王炎魔不能換成週王渾沌)', () => {
    seed([makeTracked({})]);
    const before = useBossStore.getState().bosses;
    useBossStore.getState().changeBossDifficulty('b1', '渾沌');
    expect(useBossStore.getState().bosses).toBe(before);
  });

  it('目標難度與目前相同時不做任何事', () => {
    seed([makeTracked({})]);
    const before = useBossStore.getState().bosses;
    useBossStore.getState().changeBossDifficulty('b1', '普通');
    expect(useBossStore.getState().bosses).toBe(before);
  });

  it('VIP BOSS 只能在同一張券的難度內切換,且不動券等級、週期與重置星期', () => {
    seed([
      makeTracked({
        bossName: '史烏',
        bossCatalogId: 'lotus',
        difficulty: '普通',
        resetCycle: 'weekly',
        category: 'vip',
        vipTicketLevel: '中',
        crystalValue: 27_207_040,
      }),
    ]);
    useBossStore.getState().changeBossDifficulty('b1', '極限');
    expect(findBoss('b1')?.difficulty).toBe('普通');

    useBossStore.getState().changeBossDifficulty('b1', '困難');
    const boss = findBoss('b1');
    expect(boss).toMatchObject({
      difficulty: '困難',
      crystalValue: 91_900_000,
      category: 'vip',
      vipTicketLevel: '中',
      resetCycle: 'weekly',
    });
    expect(boss?.weeklyResetDay).toBeUndefined();
  });

  it('切換後重新依目錄順序排序該角色的 BOSS,不影響其他角色', () => {
    const lotus = {
      bossName: '史烏',
      bossCatalogId: 'lotus',
      resetCycle: 'weekly' as const,
      category: 'vip' as const,
      vipTicketLevel: '中' as const,
    };
    seed([
      makeTracked({ ...lotus, id: 'v1', difficulty: '普通' }),
      makeTracked({ ...lotus, id: 'v2', difficulty: '普通' }),
      makeTracked({ id: 'other', characterId: 'c2' }),
    ]);
    useBossStore.getState().changeBossDifficulty('v1', '困難');
    const c1Ids = useBossStore
      .getState()
      .bosses.filter((b) => b.characterId === 'c1')
      .map((b) => b.id);
    expect(c1Ids).toEqual(['v2', 'v1']);
    expect(findBoss('other')?.difficulty).toBe('普通');
  });

  it('沒有 bossCatalogId 的舊資料不做任何事', () => {
    seed([makeTracked({ bossCatalogId: undefined })]);
    const before = useBossStore.getState().bosses;
    useBossStore.getState().changeBossDifficulty('b1', '簡單');
    expect(useBossStore.getState().bosses).toBe(before);
  });
});
