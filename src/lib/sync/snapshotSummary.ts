import { stableStringify } from '@/lib/recordMerge';
import { alignRestoredIds } from '@/lib/sync/restore';
import { toMillis } from '@/lib/timestamp';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import type { WeaponCheckpoint, WeaponSnapshot } from '@/lib/weapon/types';

/** 版本卡片上的資料概況 */
export interface SnapshotSummary {
  accounts: number;
  characters: number;
  tasks: number;
  bosses: number;
  /** 所有資料的修改時間與刪除時間裡最晚的一個；沒有任何紀錄時為 undefined */
  lastModifiedAt?: string;
}

/**
 * 計算版本卡片顯示的筆數與最後修改時間。
 * @param snapshot 要描述的資料
 * @returns 各類筆數與最後修改時間
 */
export function summarizeSnapshot(snapshot: DataSnapshot): SnapshotSummary {
  const times = [
    ...snapshot.accounts.map((a) => a.updatedAt),
    ...snapshot.characters.flatMap((c) => [c.updatedAt, c.placementUpdatedAt]),
    ...snapshot.tasks.map((t) => t.updatedAt),
    ...snapshot.bosses.map((b) => b.updatedAt),
    ...[
      ...snapshot.weapons.profiles,
      ...snapshot.weapons.bossClears,
      ...snapshot.weapons.dailyClears,
      ...snapshot.weapons.events,
      ...snapshot.weapons.checkpoints,
    ].map((item) => item.updatedAt),
    ...[
      ...snapshot.accountTombstones,
      ...snapshot.characterTombstones,
      ...snapshot.taskTombstones,
      ...snapshot.bossTombstones,
      ...snapshot.weapons.tombstones,
    ].map((t) => t.deletedAt),
  ]
    .map((value) => toMillis(value))
    .filter((ms) => ms > 0);
  return {
    accounts: snapshot.accounts.length,
    characters: snapshot.characters.length,
    tasks: snapshot.tasks.length,
    bosses: snapshot.bosses.length,
    lastModifiedAt: times.length > 0 ? new Date(Math.max(...times)).toISOString() : undefined,
  };
}

/**
 * 以一份資料取代另一份時會發生什麼，供選項卡寫出「會加入「阿月」；「白砂」的進度會改成雲端的狀態」。
 * 使用者記不得自己勾過幾格，所以只列角色名稱不列筆數；被加入或移除的角色，其任務與 BOSS 紀錄跟著角色一起算，不另外列出。
 */
export interface OverwriteImpact {
  /** 取代後新增（或還原回來）的角色名稱 */
  addedCharacterNames: string[];
  /** 取代後被刪除的角色名稱 */
  removedCharacterNames: string[];
  /** 兩邊都有、但角色本身或其任務、BOSS 紀錄不同的角色名稱 */
  changedCharacterNames: string[];
  /** changedCharacterNames 之中，被取代的一方有較新修改的角色；取代後這些修改會被蓋掉 */
  newerCharacterNames: string[];
  /** 兩邊都有的帳號設定不同，或有帳號會被移除；新增帳號不算 */
  accountsChanged: boolean;
}

// 修改時間不算內容；lastResetAt 由各裝置自動重置時各自寫入，只差在它不代表使用者的進度不同
// restoredFrom 是還原時記下的來源 id，不是使用者的進度
const IGNORED_KEYS = new Set(['updatedAt', 'placementUpdatedAt', 'lastResetAt', 'restoredFrom']);

/** 去掉修改時間後的內容，用來判斷兩個版本是否真的不同 */
function comparableContent(item: object): string {
  return JSON.stringify(
    Object.entries(item)
      .filter(([key]) => !IGNORED_KEYS.has(key))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** 一筆資料最後被使用者修改的時間（毫秒） */
function modifiedAt(item: { updatedAt: string; placementUpdatedAt?: string }): number {
  return Math.max(toMillis(item.updatedAt), item.placementUpdatedAt ? toMillis(item.placementUpdatedAt) : 0);
}

type Comparable = { id: string; updatedAt: string; placementUpdatedAt?: string };

/**
 * 比較同一筆資料在兩邊的版本。
 * @returns 'same' 內容相同；'newer' 不同且被取代的一方較新（或只有被取代的一方有）；'older' 其他不同的情況
 */
function compareItem(before: Comparable | undefined, after: Comparable | undefined): 'same' | 'newer' | 'older' {
  if (!before) return after ? 'older' : 'same';
  if (!after) return 'newer';
  if (comparableContent(before) === comparableContent(after)) return 'same';
  return modifiedAt(before) > modifiedAt(after) ? 'newer' : 'older';
}

/**
 * 描述「以 target 取代 current」的影響。只比較內容，修改時間不同不算變更。
 * 武器資料也算進角色的進度；比較前先用兩邊較新的 watermark 過濾，另一台壓縮掉的舊紀錄不算差異。
 * 還原時換過 id 的資料（restoredFrom）先對齊回同一筆，同一個角色不會顯示成「失去再找回」。
 * @param current 會被取代的資料
 * @param rawTarget 取代後的資料
 * @returns 加入、移除、進度不同、較新的角色名稱，以及帳號設定是否不同
 */
export function describeOverwrite(current: DataSnapshot, rawTarget: DataSnapshot): OverwriteImpact {
  const target = alignRestoredIds(current, rawTarget);
  const currentCharacterIds = new Set(current.characters.map((c) => c.id));
  const targetCharacters = new Map(target.characters.map((c) => [c.id, c]));

  // 兩邊都有的角色，依角色收集角色本身、任務與 BOSS 紀錄的比較結果
  const results = new Map<string, Set<'same' | 'newer' | 'older'>>();
  const record = (characterId: string, result: 'same' | 'newer' | 'older') => {
    results.get(characterId)?.add(result);
  };
  for (const character of current.characters) {
    if (targetCharacters.has(character.id)) results.set(character.id, new Set([compareItem(character, targetCharacters.get(character.id))]));
  }
  for (const [before, after] of [
    [current.tasks, target.tasks],
    [current.bosses, target.bosses],
  ] as const) {
    const afterById = new Map<string, Comparable & { characterId: string }>(after.map((item) => [item.id, item]));
    for (const item of before) record(item.characterId, compareItem(item, afterById.get(item.id)));
    const beforeIds = new Set(before.map((item) => item.id));
    for (const item of after) if (!beforeIds.has(item.id)) record(item.characterId, 'older');
  }

  // 武器：依角色找出兩邊較新的 watermark，早於它的紀錄已經（或即將）折入存檔點，不算差異
  const watermarkOf = (weapons: WeaponSnapshot) => new Map(weapons.checkpoints.map((c) => [c.id, c.watermark]));
  const currentWatermarks = watermarkOf(current.weapons);
  const targetWatermarks = watermarkOf(target.weapons);
  const cutoff = (characterId: string) => {
    const a = currentWatermarks.get(characterId) ?? '';
    const b = targetWatermarks.get(characterId) ?? '';
    return a > b ? a : b;
  };
  const live = <T extends { characterId: string }>(items: T[], time: (item: T) => string) =>
    items.filter((item) => time(item) >= cutoff(item.characterId));
  for (const [before, after] of [
    [live(current.weapons.bossClears, (c) => c.firstClearedAt), live(target.weapons.bossClears, (c) => c.firstClearedAt)],
    [live(current.weapons.dailyClears, (d) => d.firstClearedAt), live(target.weapons.dailyClears, (d) => d.firstClearedAt)],
    [live(current.weapons.events, (e) => e.at), live(target.weapons.events, (e) => e.at)],
  ] as const) {
    const afterById = new Map<string, Comparable & { characterId: string }>(after.map((item) => [item.id, item]));
    for (const item of before) record(item.characterId, compareItem(item, afterById.get(item.id)));
    const beforeIds = new Set(before.map((item) => item.id));
    for (const item of after) if (!beforeIds.has(item.id)) record(item.characterId, 'older');
  }
  // 設定與存檔點的 id 就是角色 id；存檔點只在狀態不同時算不同（watermark 不同代表壓縮進度不同，不是進度不同）
  const compareCheckpoint = (before?: WeaponCheckpoint, after?: WeaponCheckpoint) =>
    before && after && stableStringify(before.state) === stableStringify(after.state) ? 'same' : compareItem(before, after);
  const targetProfiles = new Map(target.weapons.profiles.map((p) => [p.id, p]));
  const targetCheckpoints = new Map(target.weapons.checkpoints.map((c) => [c.id, c]));
  for (const p of current.weapons.profiles) record(p.id, compareItem(p, targetProfiles.get(p.id)));
  for (const p of target.weapons.profiles) if (!current.weapons.profiles.some((x) => x.id === p.id)) record(p.id, 'older');
  for (const c of current.weapons.checkpoints) record(c.id, compareCheckpoint(c, targetCheckpoints.get(c.id)));
  for (const c of target.weapons.checkpoints) if (!current.weapons.checkpoints.some((x) => x.id === c.id)) record(c.id, 'older');

  const sharedCharacters = current.characters.filter((c) => results.has(c.id));
  const targetAccounts = new Map(target.accounts.map((a) => [a.id, a]));
  return {
    addedCharacterNames: target.characters.filter((c) => !currentCharacterIds.has(c.id)).map((c) => c.name),
    removedCharacterNames: current.characters.filter((c) => !targetCharacters.has(c.id)).map((c) => c.name),
    changedCharacterNames: sharedCharacters
      .filter((c) => results.get(c.id)!.has('newer') || results.get(c.id)!.has('older'))
      .map((c) => c.name),
    newerCharacterNames: sharedCharacters.filter((c) => results.get(c.id)!.has('newer')).map((c) => c.name),
    accountsChanged: current.accounts.some((a) => compareItem(a, targetAccounts.get(a.id)) !== 'same'),
  };
}
