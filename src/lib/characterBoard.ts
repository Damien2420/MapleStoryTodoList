import type { Account, Character, CharacterBossTrackList, CharacterTask } from '@/types';
import type { BossCycleKey } from '@/store/useListFilterStore';
import { summarizeCharacterCycles, type CycleSummary } from '@/lib/characterSummary';
import { countTrackedVipBossesByLevelForCharacters, summarizeVipQuota } from '@/lib/vipBossCatalog';

/** 帳號分組裡代表「未歸類」的 sentinel id;不是真的 Account 紀錄 */
export const UNASSIGNED_GROUP_ID = '__unassigned__';

/** 看板一列裡單一週期的進度環資料 */
export interface BoardCycleProgress extends CycleSummary {
  cycle: BossCycleKey;
  /** taskTotal + bossTotal > 0;false 代表這個週期沒建立,畫虛線圈 */
  tracked: boolean;
}

/** 看板上的一隻角色 */
export interface BoardCharacterRow {
  character: Character;
  /** 固定順序 日 → 週 → 月 → 賽季;帳號有 vipTier 才有第 5 個 VIP */
  cycles: BoardCycleProgress[];
  /** 每個 tracked 的週期都全部完成;完全沒追蹤任何東西的角色為 false */
  allDone: boolean;
}

/** 帳號「討伐收益合計」橫條上的一欄 */
export interface BoardRevenueColumn {
  cycle: 'daily' | 'weekly' | 'monthly';
  revenue: number;
  bossDone: number;
  bossTotal: number;
}

/** 看板上的一個帳號區塊(含「未歸類」的合成分組) */
export interface BoardAccountGroup {
  /** account.id;未歸類為 UNASSIGNED_GROUP_ID */
  id: string;
  /** 未歸類為 null */
  account: Account | null;
  name: string;
  rows: BoardCharacterRow[];
  /** 沒有任何一欄成立時為空陣列,橫條整條不 render */
  revenueColumns: BoardRevenueColumn[];
  /** 至少有一隻角色,且每隻角色都 allDone */
  allDone: boolean;
  /** VIP 重置券的帳號共用用量(已用/總數);帳號沒有VIP等級,或該等級沒有任何重置券配額(如金牌)時為 undefined */
  vipQuota?: { used: number; cap: number };
}

/** 使用者對某個帳號區塊手動收合/展開的覆寫,連同設定當下的 allDone 狀態與日期 */
export interface CollapseOverride {
  collapsed: boolean;
  allDoneWhenSet: boolean;
  /** 設定當天的本地日期(YYYY-MM-DD),見 toCollapseDateKey */
  dateWhenSet: string;
}

/**
 * 把時間轉成本地日期字串(YYYY-MM-DD),記在覆寫上,用來判斷覆寫是不是「同一天」設的。
 * @param now 目前時間
 * @returns 本地日期,例如 2026-09-21
 */
export function toCollapseDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 未歸類分組的顯示名稱;也是保留名稱,使用者不能拿來當帳號名 */
export const UNASSIGNED_GROUP_NAME = '未歸類';

/** 有帳號層收益合計的週期,順序即橫條上的欄位順序 */
const REVENUE_CYCLES = ['daily', 'weekly', 'monthly'] as const;

/**
 * 依 characterId 把陣列分組成 Map,只需走過陣列一次;之後每隻角色用 map.get(id) 取自己的資料,
 * 不必再對整個陣列各做一次 filter。
 * @param items 任務或 BOSS 追蹤紀錄
 * @returns characterId 對應到該角色所有項目的 Map
 */
function groupByCharacterId<T extends { characterId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.characterId);
    if (list) list.push(item);
    else map.set(item.characterId, [item]);
  }
  return map;
}

function isCycleDone(cycle: BoardCycleProgress): boolean {
  return cycle.taskDone === cycle.taskTotal && cycle.bossDone === cycle.bossTotal;
}

function buildRow(
  character: Character,
  account: Account | null,
  tasks: CharacterTask[],
  bosses: CharacterBossTrackList[],
  now: Date | undefined,
): BoardCharacterRow {
  const summary = summarizeCharacterCycles(tasks, bosses, now);

  const cycleKeys: BossCycleKey[] = ['daily', 'weekly', 'monthly', 'season'];
  // VIP 是帳號共用屬性:未歸類的角色(account 為 null)沒有 VIP,同一帳號內的角色一律有或一律沒有第 5 個環
  if (account?.vipTier) cycleKeys.push('vip');

  const cycles = cycleKeys.map((cycle): BoardCycleProgress => {
    const s = summary[cycle];
    return { ...s, cycle, tracked: s.taskTotal + s.bossTotal > 0 };
  });

  const trackedCycles = cycles.filter((c) => c.tracked);
  return { character, cycles, allDone: trackedCycles.length > 0 && trackedCycles.every(isCycleDone) };
}

/**
 * 帳號的討伐收益合計:日/週/月各一欄,群組內任一列該週期 revenue 不是 undefined 就有這一欄
 * (不能改用 bossTotal > 0 判斷,monthly 的顯示條件比 bossTotal 寬:只有 VIP 月王也要顯示)。
 * 金額加總各列的 revenue,undefined 的列不計入而不是當成 0。
 */
function buildRevenueColumns(rows: BoardCharacterRow[]): BoardRevenueColumn[] {
  const columns: BoardRevenueColumn[] = [];
  for (const cycleKey of REVENUE_CYCLES) {
    const cycles = rows
      .map((row) => row.cycles.find((c) => c.cycle === cycleKey))
      .filter((c): c is BoardCycleProgress => c !== undefined);
    if (!cycles.some((c) => c.revenue !== undefined)) continue;
    columns.push({
      cycle: cycleKey,
      revenue: cycles.reduce((sum, c) => sum + (c.revenue ?? 0), 0),
      bossDone: cycles.reduce((sum, c) => sum + c.bossDone, 0),
      bossTotal: cycles.reduce((sum, c) => sum + c.bossTotal, 0),
    });
  }
  return columns;
}

function buildGroup(
  id: string,
  account: Account | null,
  name: string,
  characters: Character[],
  tasksByCharacter: Map<string, CharacterTask[]>,
  bossesByCharacter: Map<string, CharacterBossTrackList[]>,
  now: Date | undefined,
): BoardAccountGroup {
  const rows = [...characters]
    .sort((a, b) => a.order - b.order)
    .map((c) => buildRow(c, account, tasksByCharacter.get(c.id) ?? [], bossesByCharacter.get(c.id) ?? [], now));

  let vipQuota: BoardAccountGroup['vipQuota'];
  if (account?.vipTier) {
    const memberIds = new Set(characters.map((c) => c.id));
    const groupBosses = characters.flatMap((c) => bossesByCharacter.get(c.id) ?? []);
    const quota = summarizeVipQuota(account.vipTier, countTrackedVipBossesByLevelForCharacters(groupBosses, memberIds));
    if (quota.cap > 0) vipQuota = quota;
  }

  return {
    id,
    account,
    name,
    rows,
    revenueColumns: buildRevenueColumns(rows),
    allDone: rows.length > 0 && rows.every((r) => r.allDone),
    vipQuota,
  };
}

/**
 * 把所有角色依帳號分組,並算出看板要顯示的每一個數字。
 * 負責帳號分組、VIP 環要不要出現、tracked、allDone 與帳號層的收益合計。
 * 分組規則:accountId 為 null 或指向不存在的帳號(遠端墓碑刪掉帳號後留下的懸空 id)都歸到「未歸類」;
 * 帳號依 order 排序,沒有角色的帳號仍會產生空群組(否則剛建的空帳號會看不見);
 * 「未歸類」只在非空時附加在最後。
 * @param input.now 透傳給 summarizeCharacterCycles,判斷下架的基準時間,測試用
 */
export function buildCharacterBoard(input: {
  characters: Character[];
  accounts: Account[];
  tasks: CharacterTask[];
  bosses: CharacterBossTrackList[];
  now?: Date;
}): BoardAccountGroup[] {
  const { characters, accounts, tasks, bosses, now } = input;
  const tasksByCharacter = groupByCharacterId(tasks);
  const bossesByCharacter = groupByCharacterId(bosses);

  const accountIds = new Set(accounts.map((a) => a.id));
  const charactersByAccount = new Map<string, Character[]>();
  const unassigned: Character[] = [];
  for (const character of characters) {
    if (character.accountId !== null && accountIds.has(character.accountId)) {
      const list = charactersByAccount.get(character.accountId);
      if (list) list.push(character);
      else charactersByAccount.set(character.accountId, [character]);
    } else {
      unassigned.push(character);
    }
  }

  const groups = [...accounts]
    .sort((a, b) => a.order - b.order)
    .map((account) =>
      buildGroup(
        account.id,
        account,
        account.name,
        charactersByAccount.get(account.id) ?? [],
        tasksByCharacter,
        bossesByCharacter,
        now,
      ),
    );

  if (unassigned.length > 0) {
    groups.push(
      buildGroup(UNASSIGNED_GROUP_ID, null, UNASSIGNED_GROUP_NAME, unassigned, tasksByCharacter, bossesByCharacter, now),
    );
  }
  return groups;
}

/**
 * 判斷某個帳號區塊目前是否收合。
 * 預設規則:全部完成就收合,否則展開。使用者手動收合/展開後會留下覆寫,優先於預設規則,
 * 但覆寫只在「同一天」且「設定當下的 allDone 與現在相同」時有效,否則視為過期,回到預設規則:
 * - 跨日:每日重置一定跨日,不用靠任何 effect 去清除;若只比對 allDone,使用者沒開著看板時跨過重置,
 *   全部做完後 allDone 翻回原值,舊覆寫會復活。
 * - allDone 改變:使用者手動收合一個未完成的帳號後,當天多勾一個任務不該讓它自己展開,
 *   所以只比對 allDone 這一個 bit,不比對完整的任務進度。
 * @param override 使用者手動設定的覆寫;從未設定過為 undefined
 * @param allDone 該帳號目前是否全部完成
 * @param now 判斷「同一天」的基準時間,預設現在;測試用
 * @returns 是否收合
 */
export function resolveAccountCollapsed(
  override: CollapseOverride | undefined,
  allDone: boolean,
  now: Date = new Date(),
): boolean {
  if (override && override.allDoneWhenSet === allDone && override.dateWhenSet === toCollapseDateKey(now)) {
    return override.collapsed;
  }
  return allDone;
}
