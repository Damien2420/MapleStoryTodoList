import type { BossDifficulty, CharacterBossTrackList, VipTicketLevel, VipTier } from '@/types';
import { VIP_BOSS_MAPPING } from '@/data/vipBossCatalog.data';

export { VIP_BOSS_MAPPING };

/** VIP重置券的等級,依序為下/中/上/終極/每月 */
export const VIP_TICKET_LEVELS: VipTicketLevel[] = ['下', '中', '上', '終極', '每月'];

/** 各券等級對應的完整票券名稱,顯示用;內部邏輯一律用短代碼(下/中/上/終極/每月)當key */
export const VIP_TICKET_LEVEL_LABELS: Record<VipTicketLevel, string> = {
  下: '每周BOSS攻略次數初始化票卷(下級)',
  中: '每周BOSS攻略次數初始化票卷(中級)',
  上: '每周BOSS攻略次數初始化票卷(上級)',
  終極: '終極每周BOSS攻略次數初始化票卷',
  每月: '每月BOSS攻略次數初始化票卷',
};

/** VIP重置券對照表項目:只記錄「這張券可以重置哪隻既有目錄王的哪些難度」,名稱/收益/人數上限一律查 BOSS_CATALOG */
export interface VipBossMapping {
  bossCatalogId: string;
  difficulties: BossDifficulty[];
}

/** 各VIP等級每週(終極/每月除外)可用的重置券張數配置,累加制 */
export const VIP_TIER_ALLOCATIONS: Record<VipTier, Record<VipTicketLevel, number>> = {
  diamond: { 下: 1, 中: 1, 上: 1, 終極: 0, 每月: 0 },
  royal: { 下: 1, 中: 3, 上: 1, 終極: 1, 每月: 1 },
};

/** 依角色目前的VIP等級查詢各券等級的可用張數;未設定VIP時全部為0 */
export function getVipAllocation(tier: VipTier | undefined): Record<VipTicketLevel, number> {
  if (!tier) return { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 };
  return VIP_TIER_ALLOCATIONS[tier];
}

/** 券等級對應的重置週期:每月券為月重置,其餘為週重置 */
export function getVipTicketLevelResetCycle(level: VipTicketLevel): 'weekly' | 'monthly' {
  return level === '每月' ? 'monthly' : 'weekly';
}

/** 在對照表中查找指定券等級是否能重置某隻王的某個難度 */
export function findVipMapping(
  level: VipTicketLevel,
  bossCatalogId: string,
  difficulty: BossDifficulty,
): VipBossMapping | undefined {
  return VIP_BOSS_MAPPING[level].find((m) => m.bossCatalogId === bossCatalogId && m.difficulties.includes(difficulty));
}

/** 組出VIP選取狀態用的唯一鍵 */
export function buildVipSelectionKey(level: VipTicketLevel, bossCatalogId: string, difficulty: BossDifficulty): string {
  return `${level}:${bossCatalogId}:${difficulty}`;
}

/** 將 buildVipSelectionKey 組出的鍵反向解析回三個欄位 */
export function parseVipSelectionKey(key: string): { ticketLevel: VipTicketLevel; bossCatalogId: string; difficulty: BossDifficulty } {
  const [ticketLevel, bossCatalogId, difficulty] = key.split(':');
  return { ticketLevel: ticketLevel as VipTicketLevel, bossCatalogId, difficulty: difficulty as BossDifficulty };
}

/** 計算選取狀態中屬於指定券等級的已選筆數 */
export function countVipSelectionsForLevel(selections: Set<string>, level: VipTicketLevel): number {
  let count = 0;
  for (const key of selections) {
    if (parseVipSelectionKey(key).ticketLevel === level) count++;
  }
  return count;
}

/** 計算指定角色「已追蹤中」的VIP BOSS,依券等級分組計數 */
export function countTrackedVipBossesByLevel(
  bosses: CharacterBossTrackList[],
  characterId: string,
): Record<VipTicketLevel, number> {
  const counts: Record<VipTicketLevel, number> = { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 };
  for (const boss of bosses) {
    if (boss.characterId !== characterId || boss.category !== 'vip' || !boss.vipTicketLevel) continue;
    counts[boss.vipTicketLevel]++;
  }
  return counts;
}

/** 蒐集指定角色「追蹤中」的VIP群組鍵,用於在新增BOSS對話框中鎖住已追蹤的VIP項目 */
export function buildTrackedVipGroupKeys(bosses: CharacterBossTrackList[], characterId: string): Set<string> {
  const keys = new Set<string>();
  for (const boss of bosses) {
    if (boss.characterId !== characterId || boss.category !== 'vip' || !boss.vipTicketLevel || !boss.bossCatalogId) continue;
    keys.add(buildVipSelectionKey(boss.vipTicketLevel, boss.bossCatalogId, boss.difficulty));
  }
  return keys;
}
