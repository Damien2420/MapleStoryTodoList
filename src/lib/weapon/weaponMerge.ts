import { stableStringify } from '@/lib/recordMerge';
import { toMillis } from '@/lib/timestamp';
import type { Tombstone } from '@/lib/tombstone';
import { weaponTombstoneId, type WeaponCheckpoint, type WeaponRecordKind, type WeaponSnapshot } from './types';

/** 兩筆同 id 資料依 updatedAt 取較新者；時間相同時比較內容，讓兩台裝置各自合併時挑到同一筆 */
function pickNewer<T extends { updatedAt: string }>(a: T, b: T): T {
  const diff = toMillis(a.updatedAt) - toMillis(b.updatedAt);
  if (diff !== 0) return diff > 0 ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

/** 存檔點是否合理：壓縮產生的存檔點 watermark 一定早於 updatedAt；晚於代表資料損毀或時鐘嚴重偏差 */
function isSaneCheckpoint(c: WeaponCheckpoint): boolean {
  return toMillis(c.watermark) <= toMillis(c.updatedAt);
}

/**
 * 同一角色兩份存檔點的取捨，結果與比較順序無關：
 * 合理的優先 → updatedAt 較新 → watermark 較新 → 內容比較。
 * 還原時存檔點的 updatedAt 會改成還原時間，所以還原的那份會勝過其他裝置較晚壓縮的存檔點。
 * @param a 一邊的存檔點
 * @param b 另一邊的存檔點
 * @returns 勝出的存檔點
 */
export function pickCheckpoint(a: WeaponCheckpoint, b: WeaponCheckpoint): WeaponCheckpoint {
  const saneA = isSaneCheckpoint(a);
  if (saneA !== isSaneCheckpoint(b)) return saneA ? a : b;
  const byUpdated = toMillis(a.updatedAt) - toMillis(b.updatedAt);
  if (byUpdated !== 0) return byUpdated > 0 ? a : b;
  const byWatermark = toMillis(a.watermark) - toMillis(b.watermark);
  if (byWatermark !== 0) return byWatermark > 0 ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

/** 依 id 合併，兩邊都有時交給 pick 決定；沒有變化時回傳本機原本的陣列 */
function mergeById<T extends { id: string }>(local: T[], remote: T[], pick: (a: T, b: T) => T): T[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  let changed = false;
  for (const item of remote) {
    const mine = byId.get(item.id);
    const chosen = mine ? pick(mine, item) : item;
    if (chosen !== mine) {
      byId.set(item.id, chosen);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : local;
}

/** 墓碑依 id 合併，同 id 取 deletedAt 較新者；沒有變化時回傳本機原本的陣列 */
function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
  const byId = new Map(local.map((t) => [t.id, t]));
  let changed = false;
  for (const t of remote) {
    const mine = byId.get(t.id);
    if (!mine || toMillis(t.deletedAt) > toMillis(mine.deletedAt)) {
      byId.set(t.id, t);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : local;
}

/** filter 但沒有移除任何項目時回傳原本的陣列 */
function keep<T>(items: T[], predicate: (item: T) => boolean): T[] {
  const kept = items.filter(predicate);
  return kept.length === items.length ? items : kept;
}

/**
 * 合併兩邊的武器資料（規則見規格第 4 段），不修改傳入的物件：
 * 1. 逐筆合併：一般資料依 updatedAt 取較新，存檔點用 pickCheckpoint
 * 2. 武器墓碑：紀錄 updatedAt 晚於墓碑 deletedAt 時保留紀錄並移除該墓碑，否則移除紀錄
 * 3. watermark 過濾：早於該角色存檔點 watermark 的紀錄與事件已折入存檔點，丟棄；
 *    被尚未壓縮的校正事件 includeClearIds 引用的擊破紀錄保留（與 compactCharacter 一致）
 * 4. 角色墓碑過濾：已刪除角色的武器資料全部移除
 * @param local 本機的武器資料
 * @param remote 遠端的武器資料
 * @param deletedCharacterIds 合併後所有被刪除角色的 id
 * @returns 合併結果；沒有任何變化時回傳 local 本身
 */
export function mergeWeaponSnapshots(
  local: WeaponSnapshot,
  remote: WeaponSnapshot,
  deletedCharacterIds: ReadonlySet<string>,
): WeaponSnapshot {
  let profiles = mergeById(local.profiles, remote.profiles, pickNewer);
  let bossClears = mergeById(local.bossClears, remote.bossClears, pickNewer);
  let dailyClears = mergeById(local.dailyClears, remote.dailyClears, pickNewer);
  let events = mergeById(local.events, remote.events, pickNewer);
  let checkpoints = mergeById(local.checkpoints, remote.checkpoints, pickCheckpoint);
  let tombstones = mergeTombstones(local.tombstones, remote.tombstones);

  if (tombstones.length > 0) {
    const tombstoneById = new Map(tombstones.map((t) => [t.id, t]));
    const beaten = new Set<string>();
    const survives =
      (kind: WeaponRecordKind) =>
      (item: { id: string; updatedAt: string }): boolean => {
        const key = weaponTombstoneId(kind, item.id);
        const tombstone = tombstoneById.get(key);
        if (!tombstone) return true;
        // 較新的勝出：還原後重新產生的同 id 紀錄（例如本週再勾同一隻 BOSS）不會被舊墓碑刪掉
        if (toMillis(item.updatedAt) > toMillis(tombstone.deletedAt)) {
          beaten.add(key);
          return true;
        }
        return false;
      };
    profiles = keep(profiles, survives('profile'));
    bossClears = keep(bossClears, survives('bossClear'));
    dailyClears = keep(dailyClears, survives('dailyClear'));
    events = keep(events, survives('event'));
    checkpoints = keep(checkpoints, survives('checkpoint'));
    if (beaten.size > 0) tombstones = tombstones.filter((t) => !beaten.has(t.id));
  }

  if (checkpoints.length > 0) {
    const watermarks = new Map(checkpoints.map((c) => [c.id, c.watermark]));
    // 與 compactCharacter 相同，用 ISO 字串比較時間
    const folded = (characterId: string, time: string) => {
      const watermark = watermarks.get(characterId);
      return watermark !== undefined && time < watermark;
    };
    events = keep(events, (e) => !folded(e.characterId, e.at));
    const referenced = new Set(events.flatMap((e) => (e.payload as { includeClearIds?: string[] } | undefined)?.includeClearIds ?? []));
    bossClears = keep(bossClears, (c) => !folded(c.characterId, c.firstClearedAt) || referenced.has(c.id));
    dailyClears = keep(dailyClears, (d) => !folded(d.characterId, d.firstClearedAt));
  }

  if (deletedCharacterIds.size > 0) {
    const alive = (characterId: string) => !deletedCharacterIds.has(characterId);
    profiles = keep(profiles, (p) => alive(p.id));
    checkpoints = keep(checkpoints, (c) => alive(c.id));
    bossClears = keep(bossClears, (c) => alive(c.characterId));
    dailyClears = keep(dailyClears, (d) => alive(d.characterId));
    events = keep(events, (e) => alive(e.characterId));
  }

  const unchanged =
    profiles === local.profiles &&
    bossClears === local.bossClears &&
    dailyClears === local.dailyClears &&
    events === local.events &&
    checkpoints === local.checkpoints &&
    tombstones === local.tombstones;
  return unchanged ? local : { profiles, bossClears, dailyClears, events, checkpoints, tombstones };
}
