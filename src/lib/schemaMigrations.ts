import type { Character } from '@/types';

/**
 * 共用的 schema 升級邏輯:persist store 的 migrate 與 backupPayload 的 MIGRATIONS 都要呼叫同一份,
 * 避免兩邊各自寫一次容易後續改一邊漏改另一邊。
 */

/** Character v0 → v1:新增 source 欄位,舊資料查無來源紀錄一律視為手動建立(更新按鈕走手動編輯流程,不會誤打 API) */
export function migrateCharacterAddSource(character: Omit<Character, 'source'> & Partial<Pick<Character, 'source'>>): Character {
  return { ...character, source: character.source ?? 'manual' };
}