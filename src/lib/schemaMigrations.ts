import type { Character, CharacterBossTrackList } from '@/types';

/**
 * 共用的 schema 升級邏輯:persist store 的 migrate 與 backupPayload 的 MIGRATIONS 都要呼叫同一份,
 * 避免兩邊各自寫一次容易後續改一邊漏改另一邊。
 */

/** Character v0 → v1:新增 source 欄位,舊資料查無來源紀錄一律視為手動建立(更新按鈕走手動編輯流程,不會誤打 API) */
export function migrateCharacterAddSource(character: Omit<Character, 'source'> & Partial<Pick<Character, 'source'>>): Character {
  return { ...character, source: character.source ?? 'manual' };
}

/**
 * CharacterBossTrackList v0 → v1:新增 partySize 欄位,舊資料查無攻略人數紀錄一律視為單人攻略,不影響既有 crystalValue。
 * 備份 JSON 可能被使用者手動編輯過,若 partySize 不是合法的正整數(0、負數、NaN、字串等)一律視為缺漏,回退為 1。
 */
export function migrateBossAddPartySize(
  boss: Omit<CharacterBossTrackList, 'partySize'> & Partial<Pick<CharacterBossTrackList, 'partySize'>>,
): CharacterBossTrackList {
  const partySize = Number(boss.partySize);
  return { ...boss, partySize: Number.isFinite(partySize) && partySize >= 1 ? Math.round(partySize) : 1 };
}
