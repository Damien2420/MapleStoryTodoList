import { describe, expect, it } from 'vitest';
import type { Account, Character, CharacterBossTrackList, CharacterTask } from '@/types';
import {
  buildCharacterBoard,
  isUnassignedCharacter,
  resolveAccountCollapsed,
  toCollapseDateKey,
  UNASSIGNED_GROUP_ID,
  type CollapseOverride,
} from '@/lib/characterBoard';

let taskIdCounter = 0;
function makeTask(overrides: Partial<CharacterTask> = {}): CharacterTask {
  taskIdCounter += 1;
  return {
    id: `task-${taskIdCounter}`,
    characterId: 'c1',
    name: '測試任務',
    category: '測試',
    resetCycle: 'daily',
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    order: 0,
    ...overrides,
  };
}

let bossIdCounter = 0;
function makeBoss(overrides: Partial<CharacterBossTrackList> = {}): CharacterBossTrackList {
  bossIdCounter += 1;
  return {
    id: `boss-${bossIdCounter}`,
    characterId: 'c1',
    bossName: '測試王',
    difficulty: '普通',
    resetCycle: 'weekly',
    crystalValue: 1000,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: '角色',
    server: '艾麗亞',
    level: 250,
    job: 'Warrior',
    order: 0,
    source: 'manual',
    accountId: null,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return { id: 'a1', name: '帳號', order: 0, ...overrides };
}

/** 只放一隻角色、不掛帳號的最小看板,回傳唯一那一列 */
function buildSingleRow(tasks: CharacterTask[], bosses: CharacterBossTrackList[], character = makeCharacter()) {
  const [group] = buildCharacterBoard({ characters: [character], accounts: [], tasks, bosses });
  return group.rows[0];
}

describe('buildCharacterBoard', () => {
  describe('分組', () => {
    it('帳號依 order 排序', () => {
      const accounts = [makeAccount({ id: 'a2', order: 1 }), makeAccount({ id: 'a1', order: 0 })];
      const groups = buildCharacterBoard({ characters: [], accounts, tasks: [], bosses: [] });
      expect(groups.map((g) => g.id)).toEqual(['a1', 'a2']);
    });

    it('未歸類永遠排最後,不論帳號的 order 多大', () => {
      const characters = [
        makeCharacter({ id: 'c1', accountId: null }),
        makeCharacter({ id: 'c2', accountId: 'a1' }),
      ];
      const accounts = [makeAccount({ id: 'a1', order: 99 })];
      const groups = buildCharacterBoard({ characters, accounts, tasks: [], bosses: [] });
      expect(groups.map((g) => g.id)).toEqual(['a1', UNASSIGNED_GROUP_ID]);
    });

    it('accountId 指向不存在的帳號,角色落入未歸類', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'deleted-account' })];
      const groups = buildCharacterBoard({ characters, accounts: [], tasks: [], bosses: [] });
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(UNASSIGNED_GROUP_ID);
      expect(groups[0].account).toBeNull();
      expect(groups[0].rows.map((r) => r.character.id)).toEqual(['c1']);
    });

    it('沒有角色的帳號仍產生 rows 為空的群組', () => {
      const groups = buildCharacterBoard({ characters: [], accounts: [makeAccount()], tasks: [], bosses: [] });
      expect(groups).toHaveLength(1);
      expect(groups[0].rows).toEqual([]);
    });

    it('沒有未歸類角色時不產生未歸類群組', () => {
      const characters = [makeCharacter({ accountId: 'a1' })];
      const groups = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [], bosses: [] });
      expect(groups.map((g) => g.id)).toEqual(['a1']);
    });

    it('群組內的角色列依 character.order 排序', () => {
      const characters = [
        makeCharacter({ id: 'c2', order: 1, accountId: 'a1' }),
        makeCharacter({ id: 'c1', order: 0, accountId: 'a1' }),
      ];
      const groups = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [], bosses: [] });
      expect(groups[0].rows.map((r) => r.character.id)).toEqual(['c1', 'c2']);
    });

    it('任務與 BOSS 只算在自己角色的那一列', () => {
      const characters = [makeCharacter({ id: 'c1' }), makeCharacter({ id: 'c2', order: 1 })];
      const tasks = [makeTask({ characterId: 'c1' }), makeTask({ characterId: 'c1' }), makeTask({ characterId: 'c2' })];
      const [group] = buildCharacterBoard({ characters, accounts: [], tasks, bosses: [] });
      const dailyTotals = group.rows.map((r) => r.cycles.find((c) => c.cycle === 'daily')!.taskTotal);
      expect(dailyTotals).toEqual([2, 1]);
    });
  });

  describe('VIP 環的有無', () => {
    const vipCharacter = (overrides: Partial<Character> = {}) => makeCharacter({ accountId: 'a1', ...overrides });

    it('帳號有 vipTier:5 個環,最後一個是 vip', () => {
      const [group] = buildCharacterBoard({
        characters: [vipCharacter()],
        accounts: [makeAccount({ vipTier: 'gold' })],
        tasks: [],
        bosses: [],
      });
      const cycles = group.rows[0].cycles.map((c) => c.cycle);
      expect(cycles).toEqual(['daily', 'weekly', 'monthly', 'season', 'vip']);
    });

    it('帳號沒有 vipTier:只有 4 個環', () => {
      const [group] = buildCharacterBoard({
        characters: [vipCharacter()],
        accounts: [makeAccount()],
        tasks: [],
        bosses: [],
      });
      expect(group.rows[0].cycles.map((c) => c.cycle)).toEqual(['daily', 'weekly', 'monthly', 'season']);
    });

    it('未歸類的角色沒有 VIP 環', () => {
      const [group] = buildCharacterBoard({
        characters: [makeCharacter({ accountId: null })],
        accounts: [],
        tasks: [],
        bosses: [],
      });
      expect(group.rows[0].cycles).toHaveLength(4);
    });
  });

  describe('vipQuota(帳號共用的VIP重置券用量)', () => {
    const vipBoss = (characterId: string, level: '下' | '中' | '每月') =>
      makeBoss({ characterId, category: 'vip', resetCycle: level === '每月' ? 'monthly' : 'weekly', vipTicketLevel: level });

    it('加總帳號內所有角色的VIP BOSS;配額是各券等級配額合計', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', order: 1, accountId: 'a1' })];
      const [group] = buildCharacterBoard({
        characters,
        accounts: [makeAccount({ vipTier: 'royal' })],
        tasks: [],
        bosses: [vipBoss('c1', '中'), vipBoss('c2', '中'), vipBoss('c2', '每月')],
      });
      expect(group.vipQuota).toEqual({ used: 3, cap: 7 });
    });

    it('別的帳號的VIP BOSS不計入', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', accountId: 'a2' })];
      const accounts = [makeAccount({ id: 'a1', vipTier: 'royal' }), makeAccount({ id: 'a2', order: 1, vipTier: 'royal' })];
      const groups = buildCharacterBoard({ characters, accounts, tasks: [], bosses: [vipBoss('c2', '中')] });
      expect(groups[0].vipQuota).toEqual({ used: 0, cap: 7 });
      expect(groups[1].vipQuota).toEqual({ used: 1, cap: 7 });
    });

    it('沒有VIP等級、金牌(無配額)、未歸類:都沒有 vipQuota', () => {
      const characters = [
        makeCharacter({ id: 'c1', accountId: 'a1' }),
        makeCharacter({ id: 'c2', accountId: 'a2' }),
        makeCharacter({ id: 'c3', accountId: null }),
      ];
      const accounts = [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2', order: 1, vipTier: 'gold' })];
      const groups = buildCharacterBoard({ characters, accounts, tasks: [], bosses: [] });
      expect(groups.map((g) => g.vipQuota)).toEqual([undefined, undefined, undefined]);
    });
  });

  describe('tracked 與 allDone', () => {
    it('沒有任何任務與 BOSS 的週期 tracked 為 false', () => {
      const row = buildSingleRow([makeTask({ resetCycle: 'daily' })], []);
      const tracked = Object.fromEntries(row.cycles.map((c) => [c.cycle, c.tracked]));
      expect(tracked).toEqual({ daily: true, weekly: false, monthly: false, season: false });
    });

    it('只有任務沒有 BOSS(或反之)仍算 tracked', () => {
      const onlyTask = buildSingleRow([makeTask({ resetCycle: 'weekly' })], []);
      const onlyBoss = buildSingleRow([], [makeBoss({ resetCycle: 'weekly' })]);
      expect(onlyTask.cycles.find((c) => c.cycle === 'weekly')!.tracked).toBe(true);
      expect(onlyBoss.cycles.find((c) => c.cycle === 'weekly')!.tracked).toBe(true);
    });

    it('所有 tracked 週期都完成:角色 allDone', () => {
      const row = buildSingleRow(
        [makeTask({ resetCycle: 'daily', checked: true })],
        [makeBoss({ resetCycle: 'weekly', checked: true })],
      );
      expect(row.allDone).toBe(true);
    });

    it('任一 tracked 週期未完成:角色與帳號都不是 allDone', () => {
      const characters = [makeCharacter({ accountId: 'a1' })];
      const tasks = [makeTask({ resetCycle: 'daily', checked: true }), makeTask({ resetCycle: 'daily', checked: false })];
      const [group] = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks, bosses: [] });
      expect(group.rows[0].allDone).toBe(false);
      expect(group.allDone).toBe(false);
    });

    it('完全沒追蹤任何東西的角色 allDone 為 false', () => {
      expect(buildSingleRow([], []).allDone).toBe(false);
    });

    it('帳號內全部角色都沒追蹤:帳號 allDone 為 false', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', order: 1, accountId: 'a1' })];
      const [group] = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [], bosses: [] });
      expect(group.allDone).toBe(false);
    });

    it('沒有角色的空帳號 allDone 為 false,不會掛上「今日已完成」', () => {
      const [group] = buildCharacterBoard({ characters: [], accounts: [makeAccount()], tasks: [], bosses: [] });
      expect(group.allDone).toBe(false);
    });

    it('只追蹤賽季且已完成:allDone 為 true', () => {
      const row = buildSingleRow([makeTask({ resetCycle: 'season', checked: true })], []);
      expect(row.allDone).toBe(true);
    });

    it('帳號內每隻角色都完成才算帳號 allDone', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', order: 1, accountId: 'a1' })];
      const doneTask = makeTask({ characterId: 'c1', checked: true });
      const pendingTask = makeTask({ characterId: 'c2', checked: false });

      const both = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [doneTask, pendingTask], bosses: [] });
      expect(both[0].allDone).toBe(false);

      const doneToo = makeTask({ characterId: 'c2', checked: true });
      const all = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [doneTask, doneToo], bosses: [] });
      expect(all[0].allDone).toBe(true);
    });
  });

  describe('帳號 revenueColumns', () => {
    const revenueOf = (groupBosses: CharacterBossTrackList[], characters: Character[] = [makeCharacter({ accountId: 'a1' })]) => {
      const [group] = buildCharacterBoard({ characters, accounts: [makeAccount()], tasks: [], bosses: groupBosses });
      return group.revenueColumns;
    };

    it('沒有任何 BOSS:整條隱藏(空陣列)', () => {
      expect(revenueOf([])).toEqual([]);
    });

    it('有追蹤但都沒勾:該欄存在且金額為 0', () => {
      const columns = revenueOf([makeBoss({ resetCycle: 'daily', checked: false })]);
      expect(columns).toEqual([{ cycle: 'daily', revenue: 0, bossDone: 0, bossTotal: 1 }]);
    });

    it('只有 VIP 月王、沒有一般月王:每月那一欄仍出現', () => {
      const columns = revenueOf([makeBoss({ category: 'vip', resetCycle: 'monthly', checked: true, crystalValue: 2000 })]);
      expect(columns).toEqual([{ cycle: 'monthly', revenue: 2000, bossDone: 0, bossTotal: 0 }]);
    });

    it('只有 VIP 週王、沒有一般週王:每週那一欄不出現', () => {
      const columns = revenueOf([makeBoss({ category: 'vip', resetCycle: 'weekly', checked: true })]);
      expect(columns).toEqual([]);
    });

    it('多隻角色的金額與已討伐/總數各自加總', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', order: 1, accountId: 'a1' })];
      const columns = revenueOf(
        [
          makeBoss({ characterId: 'c1', resetCycle: 'weekly', checked: true, crystalValue: 1000 }),
          makeBoss({ characterId: 'c1', resetCycle: 'weekly', checked: false, crystalValue: 500 }),
          makeBoss({ characterId: 'c2', resetCycle: 'weekly', checked: true, crystalValue: 300 }),
        ],
        characters,
      );
      expect(columns).toEqual([{ cycle: 'weekly', revenue: 1300, bossDone: 2, bossTotal: 3 }]);
    });

    it('其中一隻角色沒有該週期收益(undefined)時不當成 0 拖低,只是不計入', () => {
      const characters = [makeCharacter({ id: 'c1', accountId: 'a1' }), makeCharacter({ id: 'c2', order: 1, accountId: 'a1' })];
      const columns = revenueOf([makeBoss({ characterId: 'c1', resetCycle: 'daily', checked: true, crystalValue: 700 })], characters);
      expect(columns).toEqual([{ cycle: 'daily', revenue: 700, bossDone: 1, bossTotal: 1 }]);
    });

    it('欄位順序固定為 日 → 週 → 月', () => {
      const columns = revenueOf([
        makeBoss({ resetCycle: 'monthly' }),
        makeBoss({ resetCycle: 'daily' }),
        makeBoss({ resetCycle: 'weekly' }),
      ]);
      expect(columns.map((c) => c.cycle)).toEqual(['daily', 'weekly', 'monthly']);
    });
  });
});


describe('isUnassignedCharacter', () => {
  const accountIds = new Set(['acc-1']);

  it('accountId 為 null 視為未歸類', () => {
    expect(isUnassignedCharacter({ accountId: null }, accountIds)).toBe(true);
  });

  it('accountId 指向存在的帳號不是未歸類', () => {
    expect(isUnassignedCharacter({ accountId: 'acc-1' }, accountIds)).toBe(false);
  });

  it('accountId 指向已不存在的帳號視為未歸類', () => {
    expect(isUnassignedCharacter({ accountId: 'acc-deleted' }, accountIds)).toBe(true);
  });
});

describe('toCollapseDateKey', () => {
  it('回傳本地日期 YYYY-MM-DD,月與日補零', () => {
    expect(toCollapseDateKey(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
    expect(toCollapseDateKey(new Date(2026, 11, 21, 0, 0))).toBe('2026-12-21');
  });
});

describe('resolveAccountCollapsed', () => {
  const day1 = new Date(2026, 8, 21, 10, 0);
  const day1Evening = new Date(2026, 8, 21, 22, 0);
  const day2 = new Date(2026, 8, 22, 10, 0);
  const overrideOn = (dateWhenSet: Date, collapsed: boolean, allDoneWhenSet: boolean): CollapseOverride => ({
    collapsed,
    allDoneWhenSet,
    dateWhenSet: toCollapseDateKey(dateWhenSet),
  });

  it('沒有覆寫:回傳 allDone(全部完成就自動收合)', () => {
    expect(resolveAccountCollapsed(undefined, true, day1)).toBe(true);
    expect(resolveAccountCollapsed(undefined, false, day1)).toBe(false);
  });

  it('同一天、設定當下的 allDone 與現在相同:回傳覆寫值', () => {
    expect(resolveAccountCollapsed(overrideOn(day1, false, true), true, day1Evening)).toBe(false);
    expect(resolveAccountCollapsed(overrideOn(day1, true, false), false, day1Evening)).toBe(true);
  });

  it('同一天但 allDone 已翻轉:忽略覆寫,回到 allDone', () => {
    expect(resolveAccountCollapsed(overrideOn(day1, false, true), false, day1Evening)).toBe(false);
    expect(resolveAccountCollapsed(overrideOn(day1, true, false), true, day1Evening)).toBe(true);
  });

  it('隔天:即使 allDone 恰好跟設定當時相同,覆寫也已過期', () => {
    // 第 1 天全部完成後手動展開;第 2 天中間沒有人開著看板,全部做完後 allDone 又是 true,
    // 只比對 allDone 的話舊覆寫會復活,帳號不會自動收合
    expect(resolveAccountCollapsed(overrideOn(day1, false, true), true, day2)).toBe(true);
  });
});
