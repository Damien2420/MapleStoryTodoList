import type { BossDifficulty, CharacterBossTrackList, CharacterSource, VipTicketLevel } from '@/types';
import type { Server } from '@/lib/servers';

/**
 * 共用的 schema 升級邏輯:persist store 的 migrate 與 backupPayload 的 MIGRATIONS 都要呼叫同一份,
 * 避免兩邊各自寫一次容易後續改一邊漏改另一邊。
 *
 * 以下所有遷移函式的參數/回傳型別都獨立宣告成該次遷移前後的實際形狀,不要用 Omit<Character, ...>、
 * Omit<CharacterBossTrackList, ...> 等從目前即時的型別衍生,原因與 backupPayload.ts 歷史快照型別的
 * 註解相同:避免 Character/CharacterBossTrackList 未來新增欄位時,波及到更早、與該欄位無關的遷移函式。
 */

/** Character 新增 source 欄位之前的舊資料形狀 */
export interface CharacterBeforeSource {
  id: string;
  name: string;
  server: Server;
  level: number;
  job: string;
  imageUrl?: string;
  order: number;
}

/** Character 新增 source 之後的形狀 */
export interface CharacterWithSource extends CharacterBeforeSource {
  source: CharacterSource;
}

/** Character v0 → v1:新增 source 欄位,舊資料查無來源紀錄一律視為手動建立(更新按鈕走手動編輯流程,不會誤打 API) */
export function migrateCharacterAddSource(
  character: CharacterBeforeSource & Partial<Pick<CharacterWithSource, 'source'>>,
): CharacterWithSource {
  return { ...character, source: character.source ?? 'manual' };
}

/** CharacterBossTrackList v0 : 新增 partySize 欄位之前的舊資料形狀(此時仍保留後來才移除的 order 欄位) */
export interface BossBeforePartySize {
  id: string;
  characterId: string;
  bossName: string;
  difficulty: BossDifficulty;
  resetCycle: 'daily' | 'weekly' | 'monthly';
  weeklyResetDay?: number;
  category?: 'season' | 'vip';
  bossCatalogId?: string;
  vipTicketLevel?: VipTicketLevel;
  crystalValue: number;
  checked: boolean;
  lastResetAt: string;
  order: number;
}

/** CharacterBossTrackList v1 : 新增 partySize 之後、移除 order 之前的形狀 */
export interface BossWithPartySize extends BossBeforePartySize {
  partySize: number;
}

/**
 * CharacterBossTrackList v0 → v1:新增 partySize 欄位,舊資料查無攻略人數紀錄一律視為單人攻略,不影響既有 crystalValue。
 * 備份 JSON 可能被使用者手動編輯過,若 partySize 不是合法的正整數(0、負數、NaN、字串等)一律視為缺漏,回退為 1。
 */
export function migrateBossAddPartySize(
  boss: BossBeforePartySize & Partial<Pick<BossWithPartySize, 'partySize'>>,
): BossWithPartySize {
  const partySize = Number(boss.partySize);
  return { ...boss, partySize: Number.isFinite(partySize) && partySize >= 1 ? Math.round(partySize) : 1 };
}

/**
 * CharacterBossTrackList v1 → v2:移除 order 欄位,顯示順序改為每次讀取時依 BOSS_CATALOG 目錄順序即時計算
 * (見 lib/bossCatalog.ts 的 sortTrackedBossesByCatalogOrder),不再需要持久化的排序快取值。
 */
export function migrateBossRemoveOrder(boss: BossWithPartySize): CharacterBossTrackList {
  const { order, ...rest } = boss;
  void order;
  return rest;
}
