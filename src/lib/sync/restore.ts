import type { Tombstone } from '@/lib/tombstone';
import type { DataSnapshot } from '@/lib/sync/snapshot';

/** 找出要還原的紀錄裡「目前有墓碑」的，各配一個新 id；其他紀錄維持原 id */
function rekey(items: Array<{ id: string }>, tombstones: Tombstone[], newId: () => string): Map<string, string> {
  const deleted = new Set(tombstones.map((t) => t.id));
  const mapping = new Map<string, string>();
  for (const item of items) {
    if (deleted.has(item.id)) mapping.set(item.id, newId());
  }
  return mapping;
}

function mapId(mapping: Map<string, string>, id: string): string {
  return mapping.get(id) ?? id;
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

/**
 * 還原 = 以 target 完全取代 current（不是合併），結果要能在同步到其他裝置後維持不變：
 * 1. target 的每一筆都改成 now 的修改時間，其他裝置的舊版本合併時一定輸給它
 * 2. current 有、target 沒有的紀錄寫上墓碑，其他裝置合併時一併刪除
 * 3. target 裡先前被刪除過（current 有墓碑）的紀錄改用新 id：合併規則是刪除優先，
 *    其他裝置還留著舊 id 的墓碑，沿用舊 id 會被再刪一次
 * @param current 目前的資料（已登入時等於雲端最新版本，或 3-3 的雲端資料）
 * @param target 要還原成的資料
 * @param now 還原時間
 * @param newId 產生新 id
 * @returns 還原後的完整快照
 */
export function restoreSnapshot(current: DataSnapshot, target: DataSnapshot, now: Date, newId: () => string): DataSnapshot {
  const stamp = now.toISOString();
  const accountIds = rekey(target.accounts, current.accountTombstones, newId);
  const characterIds = rekey(target.characters, current.characterTombstones, newId);
  const taskIds = rekey(target.tasks, current.taskTombstones, newId);
  const bossIds = rekey(target.bosses, current.bossTombstones, newId);

  const accounts = target.accounts.map((account) => ({ ...account, id: mapId(accountIds, account.id), updatedAt: stamp }));
  const characters = target.characters.map((c) => ({
    ...c,
    id: mapId(characterIds, c.id),
    accountId: c.accountId ? mapId(accountIds, c.accountId) : c.accountId,
    updatedAt: stamp,
    placementUpdatedAt: stamp,
  }));
  const tasks = target.tasks.map((t) => ({
    ...t,
    id: mapId(taskIds, t.id),
    characterId: mapId(characterIds, t.characterId),
    updatedAt: stamp,
  }));
  const bosses = target.bosses.map((b) => ({
    ...b,
    id: mapId(bossIds, b.id),
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
  };
}
