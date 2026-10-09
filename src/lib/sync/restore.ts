import type { Tombstone } from '@/lib/tombstone';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { weaponTombstoneId, type WeaponEvent, type WeaponSnapshot } from '@/lib/weapon/types';

/** 可以被還原的資料：還原時換過 id 的，restoredFrom 記著最原始的 id */
type Restorable = { id: string; restoredFrom?: string };

/** 一筆資料最原始的 id：還原時換過 id 的取 restoredFrom，其他就是自己的 id */
function rootId(item: Restorable): string {
  return item.restoredFrom ?? item.id;
}

/**
 * 找出 target 裡「id 不在 current，但和 current 某一筆是同一筆資料」的對應：兩邊最原始的 id 相同。
 * 例如角色 A（id 1）被刪除後還原，換成 id X（restoredFrom = 1）；之後再拿含 id 1 的備份還原時，1 會對應回 X。
 * @param currentItems 目前的資料
 * @param targetItems 要比較或還原的資料
 * @returns target id → current id 的對應；id 本來就相同的不列入
 */
function matchRestoredIds(currentItems: Restorable[], targetItems: Restorable[]): Map<string, string> {
  const currentIds = new Set(currentItems.map((item) => item.id));
  const targetIds = new Set(targetItems.map((item) => item.id));
  const currentByRoot = new Map<string, string>();
  for (const item of currentItems) {
    // id 也出現在 target 的，會由 id 直接配對，不參與這裡的對應
    if (!targetIds.has(item.id)) currentByRoot.set(rootId(item), item.id);
  }
  const mapping = new Map<string, string>();
  for (const item of targetItems) {
    if (currentIds.has(item.id)) continue;
    const match = currentByRoot.get(rootId(item));
    if (match === undefined) continue;
    mapping.set(item.id, match);
    currentByRoot.delete(rootId(item));
  }
  return mapping;
}

/**
 * 決定要還原的紀錄用什麼 id：
 * 1. 與目前某一筆是同一筆資料（最原始 id 相同）的，沿用目前那筆的 id，不再換新 id
 * 2. 其他「目前有墓碑」的，各配一個新 id
 * 3. 其餘維持原 id
 */
function rekey(currentItems: Restorable[], targetItems: Restorable[], tombstones: Tombstone[], newId: () => string): Map<string, string> {
  const mapping = matchRestoredIds(currentItems, targetItems);
  const deleted = new Set(tombstones.map((t) => t.id));
  for (const item of targetItems) {
    if (!mapping.has(item.id) && deleted.has(item.id)) mapping.set(item.id, newId());
  }
  return mapping;
}

function mapId(mapping: Map<string, string>, id: string): string {
  return mapping.get(id) ?? id;
}

/** 換了 id 的資料記下最原始的 id（對回最原始 id 本身時不需要記）；沒換的保持原樣 */
function withRestoredId<T extends Restorable>(item: T, mapping: Map<string, string>): T {
  const id = mapping.get(item.id);
  if (id === undefined) return item;
  const { restoredFrom: _previous, ...rest } = item;
  void _previous;
  const root = rootId(item);
  return (root === id ? { ...rest, id } : { ...rest, id, restoredFrom: root }) as T;
}

/**
 * 還原後的墓碑：保留目前與要還原資料各自的墓碑（同 id 取較新的），
 * 再替「目前有、還原後沒有」的紀錄補上墓碑；還原後仍存在的 id 不能有墓碑。
 */
function tombstonesAfterRestore(
  currentItems: Array<{ id: string }>,
  currentTombstones: Tombstone[],
  targetTombstones: Tombstone[],
  resultItems: Array<{ id: string }>,
  deletedAt: string,
): Tombstone[] {
  const kept = new Set(resultItems.map((item) => item.id));
  const byId = new Map<string, Tombstone>();
  for (const tombstone of [...currentTombstones, ...targetTombstones]) {
    if (kept.has(tombstone.id)) continue;
    const existing = byId.get(tombstone.id);
    if (!existing || new Date(tombstone.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      byId.set(tombstone.id, tombstone);
    }
  }
  for (const item of currentItems) {
    if (!kept.has(item.id)) byId.set(item.id, { id: item.id, deletedAt });
  }
  return [...byId.values()];
}

/** 以 `${角色 id}:` 開頭的武器紀錄 id，角色換了新 id 時一併換前綴 */
function remapWeaponId(id: string, characterIds: Map<string, string>): string {
  const separator = id.indexOf(':');
  if (separator < 0) return id;
  const mapped = characterIds.get(id.slice(0, separator));
  return mapped ? `${mapped}${id.slice(separator)}` : id;
}

/**
 * 角色換了 id 時，武器資料的 characterId、紀錄 id 前綴、設定與存檔點 id、校正事件引用的擊破 id 一併換掉。
 * 武器墓碑不處理，由呼叫端決定。
 */
function remapWeapons(weapons: WeaponSnapshot, characterIds: Map<string, string>): Omit<WeaponSnapshot, 'tombstones'> {
  const character = (id: string) => mapId(characterIds, id);
  const record = (id: string) => remapWeaponId(id, characterIds);
  const remapPayload = (payload: WeaponEvent['payload']): WeaponEvent['payload'] =>
    payload && 'includeClearIds' in payload && payload.includeClearIds
      ? { ...payload, includeClearIds: payload.includeClearIds.map(record) }
      : payload;
  return {
    profiles: weapons.profiles.map((p) => ({ ...p, id: character(p.id) })),
    bossClears: weapons.bossClears.map((c) => ({ ...c, id: record(c.id), characterId: character(c.characterId) })),
    dailyClears: weapons.dailyClears.map((d) => ({ ...d, id: record(d.id), characterId: character(d.characterId) })),
    events: weapons.events.map((e) => ({ ...e, id: record(e.id), characterId: character(e.characterId), payload: remapPayload(e.payload) })),
    checkpoints: weapons.checkpoints.map((c) => ({ ...c, id: character(c.id) })),
  };
}

/** 武器快照裡每一筆資料對應的墓碑 id（帶種類前綴） */
function weaponKeys(weapons: Omit<WeaponSnapshot, 'tombstones'>): Array<{ id: string }> {
  return [
    ...weapons.profiles.map((p) => ({ id: weaponTombstoneId('profile', p.id) })),
    ...weapons.bossClears.map((c) => ({ id: weaponTombstoneId('bossClear', c.id) })),
    ...weapons.dailyClears.map((d) => ({ id: weaponTombstoneId('dailyClear', d.id) })),
    ...weapons.events.map((e) => ({ id: weaponTombstoneId('event', e.id) })),
    ...weapons.checkpoints.map((c) => ({ id: weaponTombstoneId('checkpoint', c.id) })),
  ];
}

/**
 * 還原的武器資料：與其他資料相同，改成還原時間、目前有而還原後沒有的寫上墓碑；角色換了 id 時武器資料跟著換。
 */
function restoreWeapons(current: WeaponSnapshot, target: WeaponSnapshot, characterIds: Map<string, string>, stamp: string): WeaponSnapshot {
  const remapped = remapWeapons(target, characterIds);
  const restored = {
    profiles: remapped.profiles.map((p) => ({ ...p, updatedAt: stamp })),
    bossClears: remapped.bossClears.map((c) => ({ ...c, updatedAt: stamp })),
    dailyClears: remapped.dailyClears.map((d) => ({ ...d, updatedAt: stamp })),
    events: remapped.events.map((e) => ({ ...e, updatedAt: stamp })),
    checkpoints: remapped.checkpoints.map((c) => ({ ...c, updatedAt: stamp })),
  };
  return {
    ...restored,
    tombstones: tombstonesAfterRestore(weaponKeys(current), current.tombstones, target.tombstones, weaponKeys(restored), stamp),
  };
}

/**
 * 把 target 裡「和 current 是同一筆、只是還原時換過 id」的資料換成 current 的 id，其他內容不變。
 * 比較兩份資料的差異時使用，避免把同一個角色顯示成「失去再找回」。
 * @param current 目前的資料
 * @param target 要比較的資料
 * @returns id 對齊 current 的 target；沒有需要對齊的資料時回傳 target 本身
 */
export function alignRestoredIds(current: DataSnapshot, target: DataSnapshot): DataSnapshot {
  const accountIds = matchRestoredIds(current.accounts, target.accounts);
  const characterIds = matchRestoredIds(current.characters, target.characters);
  const taskIds = matchRestoredIds(current.tasks, target.tasks);
  const bossIds = matchRestoredIds(current.bosses, target.bosses);
  if (accountIds.size + characterIds.size + taskIds.size + bossIds.size === 0) return target;
  return {
    ...target,
    accounts: target.accounts.map((a) => ({ ...a, id: mapId(accountIds, a.id) })),
    characters: target.characters.map((c) => ({
      ...c,
      id: mapId(characterIds, c.id),
      accountId: c.accountId ? mapId(accountIds, c.accountId) : c.accountId,
    })),
    tasks: target.tasks.map((t) => ({ ...t, id: mapId(taskIds, t.id), characterId: mapId(characterIds, t.characterId) })),
    bosses: target.bosses.map((b) => ({ ...b, id: mapId(bossIds, b.id), characterId: mapId(characterIds, b.characterId) })),
    weapons: { ...remapWeapons(target.weapons, characterIds), tombstones: target.weapons.tombstones },
  };
}

/**
 * 還原 = 以 target 完全取代 current（不是合併），結果要能在同步到其他裝置後維持不變：
 * 1. target 的每一筆都改成 now 的修改時間，其他裝置的舊版本合併時一定輸給它
 * 2. current 有、target 沒有的紀錄寫上墓碑，其他裝置合併時一併刪除
 * 3. target 裡先前被刪除過（current 有墓碑）的紀錄改用新 id，並在 restoredFrom 記下最原始的 id：
 *    合併規則是刪除優先，其他裝置還留著舊 id 的墓碑，沿用舊 id 會被再刪一次
 * 4. target 裡與 current 某一筆是同一筆資料（最原始 id 相同，之前還原時換過 id）的，沿用 current 的 id，
 *    重複還原同一份資料時不會一直換 id、累積墓碑
 * 武器資料同樣處理（見 restoreWeapons），角色換 id 時武器資料跟著換。
 * @param current 目前的資料（已登入時等於雲端最新版本，或 3-3 的雲端資料）
 * @param target 要還原成的資料
 * @param now 還原時間
 * @param newId 產生新 id
 * @returns 還原後的完整快照
 */
export function restoreSnapshot(current: DataSnapshot, target: DataSnapshot, now: Date, newId: () => string): DataSnapshot {
  const stamp = now.toISOString();
  const accountIds = rekey(current.accounts, target.accounts, current.accountTombstones, newId);
  const characterIds = rekey(current.characters, target.characters, current.characterTombstones, newId);
  const taskIds = rekey(current.tasks, target.tasks, current.taskTombstones, newId);
  const bossIds = rekey(current.bosses, target.bosses, current.bossTombstones, newId);

  const accounts = target.accounts.map((account) => ({ ...withRestoredId(account, accountIds), updatedAt: stamp }));
  const characters = target.characters.map((c) => ({
    ...withRestoredId(c, characterIds),
    accountId: c.accountId ? mapId(accountIds, c.accountId) : c.accountId,
    updatedAt: stamp,
    placementUpdatedAt: stamp,
  }));
  const tasks = target.tasks.map((t) => ({
    ...withRestoredId(t, taskIds),
    characterId: mapId(characterIds, t.characterId),
    updatedAt: stamp,
  }));
  const bosses = target.bosses.map((b) => ({
    ...withRestoredId(b, bossIds),
    characterId: mapId(characterIds, b.characterId),
    updatedAt: stamp,
  }));

  return {
    accounts,
    accountTombstones: tombstonesAfterRestore(current.accounts, current.accountTombstones, target.accountTombstones, accounts, stamp),
    characters,
    characterTombstones: tombstonesAfterRestore(
      current.characters,
      current.characterTombstones,
      target.characterTombstones,
      characters,
      stamp,
    ),
    tasks,
    taskTombstones: tombstonesAfterRestore(current.tasks, current.taskTombstones, target.taskTombstones, tasks, stamp),
    bosses,
    bossTombstones: tombstonesAfterRestore(current.bosses, current.bossTombstones, target.bossTombstones, bosses, stamp),
    weapons: restoreWeapons(current.weapons, target.weapons, characterIds, stamp),
  };
}
