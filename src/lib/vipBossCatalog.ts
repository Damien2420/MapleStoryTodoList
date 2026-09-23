import type { BossDifficulty, CharacterBossTrackList, VipTicketLevel, VipTier } from '@/types';
import { VIP_BOSS_MAPPING } from '@/data/vipBossCatalog.data';

export { VIP_BOSS_MAPPING };

/** VIP會員等級對應的顯示名稱 */
export const VIP_TIER_LABELS: Record<VipTier, string> = {
  silver: 'VIP銀牌',
  gold: 'VIP金牌',
  diamond: 'VIP鑽石',
  royal: 'VIP皇家',
  royalBlack: 'VIP皇家黑',
};

/** VIP會員等級徽章的底色/文字色 class,各等級指定色,不隨淺/深主題調整 */
export const VIP_TIER_BADGE_CLASSES: Record<VipTier, string> = {
  silver: 'border-transparent bg-vip-silver text-vip-silver-foreground',
  gold: 'border-transparent bg-vip-gold text-vip-gold-foreground',
  diamond: 'border-transparent bg-vip-diamond text-vip-diamond-foreground',
  royal: 'border-transparent bg-vip-royal text-vip-royal-foreground',
  royalBlack: 'border-transparent bg-vip-royal-black text-vip-royal-black-foreground',
};

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

/** 各VIP等級每週(終極/每月除外)可用的重置券張數配置,累加制;銀牌與黃金沒有任何配額,皇家黑比照皇家、不額外增加 */
export const VIP_TIER_ALLOCATIONS: Record<VipTier, Record<VipTicketLevel, number>> = {
  silver: { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 },
  gold: { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 },
  diamond: { 下: 1, 中: 1, 上: 1, 終極: 0, 每月: 0 },
  royal: { 下: 1, 中: 3, 上: 1, 終極: 1, 每月: 1 },
  royalBlack: { 下: 1, 中: 3, 上: 1, 終極: 1, 每月: 1 },
};

/** 依角色目前的VIP等級查詢各券等級的可用張數;未設定VIP時全部為0 */
export function getVipAllocation(tier: VipTier | undefined): Record<VipTicketLevel, number> {
  if (!tier) return { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 };
  return VIP_TIER_ALLOCATIONS[tier];
}

/** 判斷指定VIP等級是否有任何重置券配額(黃金等級全部為0,用來決定要不要顯示「新增VIP重置BOSS」入口) */
export function hasVipTicketAllocation(tier: VipTier | undefined): boolean {
  if (!tier) return false;
  return Object.values(VIP_TIER_ALLOCATIONS[tier]).some((n) => n > 0);
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

/**
 * 計算一組角色「已追蹤中」的VIP BOSS,依券等級分組計數。
 * VIP重置券配額屬於整個帳號、由帳號底下所有角色共用,所以帳號層的用量要傳入帳號內全部角色的 id。
 * @param bosses 所有 BOSS 追蹤紀錄
 * @param characterIds 要納入統計的角色 id
 * @returns 各券等級目前已被使用的張數
 */
export function countTrackedVipBossesByLevelForCharacters(
  bosses: CharacterBossTrackList[],
  characterIds: ReadonlySet<string>,
): Record<VipTicketLevel, number> {
  const counts: Record<VipTicketLevel, number> = { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 };
  for (const boss of bosses) {
    if (!characterIds.has(boss.characterId) || boss.category !== 'vip' || !boss.vipTicketLevel) continue;
    counts[boss.vipTicketLevel]++;
  }
  return counts;
}

/** 計算單一角色「已追蹤中」的VIP BOSS,依券等級分組計數(單一角色的用量,用於帳號總覽的逐角色明細) */
export function countTrackedVipBossesByLevel(
  bosses: CharacterBossTrackList[],
  characterId: string,
): Record<VipTicketLevel, number> {
  return countTrackedVipBossesByLevelForCharacters(bosses, new Set([characterId]));
}

/**
 * 把各券等級的用量與配額各自加總,得到「VIP 重置券 已用/總數」。
 * @param tier 帳號的VIP等級;未設定時配額為 0
 * @param countsByLevel 各券等級目前的用量
 * @returns used 為已用張數合計,cap 為配額合計
 */
export function summarizeVipQuota(
  tier: VipTier | undefined,
  countsByLevel: Record<VipTicketLevel, number>,
): { used: number; cap: number } {
  const allocation = getVipAllocation(tier);
  let used = 0;
  let cap = 0;
  for (const level of VIP_TICKET_LEVELS) {
    used += countsByLevel[level];
    cap += allocation[level];
  }
  return { used, cap };
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
