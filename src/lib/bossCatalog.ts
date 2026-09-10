import type { BossDifficulty, CharacterBossTrackList } from '@/types';
import { BOSS_CATALOG } from '@/data/bossCatalog.data';

export { BOSS_CATALOG };

/** 單一難度的參考收益與重置週期,僅供套用時帶入初始值,非即時經濟數據 */
export interface BossDifficultyOption {
  difficulty: BossDifficulty;
  crystalValue: number;
  resetCycle: 'daily' | 'weekly' | 'monthly';
  /** 週重置的星期幾(0=日~6=六),僅 resetCycle === 'weekly' 時有意義 */
  weeklyResetDay?: number;
  /** 該難度可組隊攻略的最大人數上限,用於「依攻略人數平分收益」功能夾住輸入範圍 */
  maxPartySize: number;
}

/** BOSS 名單項目:唯一來源,沒有預設/自訂之分。每隻王支援的難度組合不同,不同難度可能有不同的重置週期 */
export interface BossCatalogEntry {
  id: string;
  name: string;
  /** 顯示分類:賽季王會歸類到獨立的「賽季」區塊,實際重置週期仍依各難度的 resetCycle 判斷 */
  category?: 'season';
  /** 是否仍可在「新增BOSS」流程中選取,預設 true;設為 false 代表已下架但保留歷史資料 */
  active?: boolean;
  /** 活動/賽季 BOSS 的最後一天(YYYY-MM-DD),當天結束後自動視為已下架;未設定代表無期限 */
  expiresAt?: string;
  /** 依簡單→極限排序的難度清單 */
  difficulties: BossDifficultyOption[];
}

/** 使用者在新增/建立流程中勾選的單筆 BOSS + 難度 */
export interface BossSelection {
  bossId: string;
  difficulty: BossDifficulty;
}

/** 單一角色可勾選的每週 BOSS(不含賽季王)上限,對應遊戲內一週可販售的結晶數 */
export const WEEKLY_BOSS_LIMIT = 12;

/**
 * 計算選取狀態中「每週重置且非賽季王」的已勾選難度筆數。
 *
 * @param selections UI 上「王 id -> 已選難度集合」的選取狀態
 * @returns 計入每週上限的勾選筆數(同一隻王勾多個週期難度會分別計數)
 */
export function countWeeklyBossSelections(selections: Map<string, Set<BossDifficulty>>): number {
  let count = 0;
  for (const [bossId, difficulties] of selections) {
    const entry = findBossCatalogEntry(bossId);
    if (!entry || entry.category === 'season') continue;
    for (const difficulty of difficulties) {
      if (findDifficultyOption(entry, difficulty)?.resetCycle === 'weekly') count++;
    }
  }
  return count;
}

/**
 * 計算指定角色「已追蹤中」計入每週上限的 BOSS 筆數(每週重置且非賽季王)。
 *
 * 與 countWeeklyBossSelections 相加即為該角色本週實際占用的上限額度。
 * 目錄項目已下架者不再顯示於清單,故不計;沒有 bossCatalogId 的舊紀錄無法對應目錄,一律計入。
 *
 * @param bosses 全部角色的 BOSS 追蹤紀錄(呼叫端不需預先過濾角色)
 * @param characterId 要計算的角色 id
 * @returns 已追蹤且計入每週上限的筆數
 */
export function countTrackedWeeklyBosses(bosses: CharacterBossTrackList[], characterId: string): number {
  let count = 0;
  for (const boss of bosses) {
    if (boss.characterId !== characterId || boss.resetCycle !== 'weekly' || boss.category === 'season') continue;
    if (boss.bossCatalogId) {
      const entry = findBossCatalogEntry(boss.bossCatalogId);
      if (entry && isCatalogEntryExpired(entry)) continue;
    }
    count++;
  }
  return count;
}

/** 將 UI 上「王 id -> 已選難度集合」的選取狀態,攤平成送出用的 BossSelection[] */
export function flattenBossSelections(selections: Map<string, Set<BossDifficulty>>): BossSelection[] {
  return Array.from(selections.entries()).flatMap(([bossId, difficulties]) =>
    Array.from(difficulties).map((difficulty) => ({ bossId, difficulty })),
  );
}

/** 計算某隻王+難度在 BOSS_CATALOG 中的排序權重;查無對應目錄項目回傳 Infinity */
function bossCatalogRank(bossId: string, difficulty: BossDifficulty): number {
  const entryIndex = BOSS_CATALOG.findIndex((entry) => entry.id === bossId);
  if (entryIndex === -1) return Infinity;
  const difficultyIndex = BOSS_CATALOG[entryIndex].difficulties.findIndex((option) => option.difficulty === difficulty);
  return entryIndex * 100 + (difficultyIndex === -1 ? 0 : difficultyIndex);
}

/** 依 BOSS_CATALOG 的順序排序選取結果;查無對應目錄項目的選取(理論上不會發生)排到最後,保持穩定排序 */
export function sortBossSelectionsByCatalogOrder(selections: BossSelection[]): BossSelection[] {
  return [...selections].sort(
    (a, b) => bossCatalogRank(a.bossId, a.difficulty) - bossCatalogRank(b.bossId, b.difficulty),
  );
}

/**
 * 依 BOSS_CATALOG 的順序排序「已建立」的 BOSS 追蹤紀錄,不論分幾次加入都會得到同一個順序;
 * 查無對應目錄項目(舊資料/來源已下架)的排到最後,彼此保持原本的相對順序。
 */
export function sortTrackedBossesByCatalogOrder(bosses: CharacterBossTrackList[]): CharacterBossTrackList[] {
  return [...bosses].sort((a, b) => {
    const rankA = a.bossCatalogId ? bossCatalogRank(a.bossCatalogId, a.difficulty) : Infinity;
    const rankB = b.bossCatalogId ? bossCatalogRank(b.bossCatalogId, b.difficulty) : Infinity;
    return rankA - rankB;
  });
}

/** 依 id 查找 BOSS 名單項目 */
export function findBossCatalogEntry(bossId: string): BossCatalogEntry | undefined {
  return BOSS_CATALOG.find((entry) => entry.id === bossId);
}

/** 在指定的 BOSS 名單項目底下,依難度查找對應的參考收益與重置週期設定 */
export function findDifficultyOption(
  entry: BossCatalogEntry,
  difficulty: BossDifficulty,
): BossDifficultyOption | undefined {
  return entry.difficulties.find((option) => option.difficulty === difficulty);
}

/** 依攻略人數平分後的實際結晶收益(四捨五入到整數);賽季王也可呼叫,但呼叫端目前不會顯示其結果 */
export function getEffectiveCrystalValue(boss: Pick<CharacterBossTrackList, 'crystalValue' | 'partySize'>): number {
  return Math.round(boss.crystalValue / boss.partySize);
}

/** 查詢指定 BOSS 追蹤紀錄可設定的最大攻略人數;查無對應目錄項目(舊資料或已下架)時 fallback 為 6 */
export function getMaxPartySize(boss: Pick<CharacterBossTrackList, 'bossCatalogId' | 'difficulty'>): number {
  if (!boss.bossCatalogId) return 6;
  const entry = findBossCatalogEntry(boss.bossCatalogId);
  if (!entry) return 6;
  return findDifficultyOption(entry, boss.difficulty)?.maxPartySize ?? 6;
}

/** 判斷目錄項目是否已下架:手動 active === false,或已超過 expiresAt 當天(23:59:59.999) */
export function isCatalogEntryExpired(entry: BossCatalogEntry, now: Date = new Date()): boolean {
  if (entry.active === false) return true;
  if (!entry.expiresAt) return false;
  const end = new Date(entry.expiresAt);
  end.setHours(23, 59, 59, 999);
  return now.getTime() > end.getTime();
}

/**
 * 蒐集指定角色「追蹤中且未下架」的 BOSS 互斥群組鍵。
 *
 * 同一隻王在同一個重置週期內只能討伐一個難度,群組鍵用於在新增BOSS對話框中鎖住已追蹤的群組。
 * 沒有 bossCatalogId 的舊紀錄無法對應回目錄,略過不鎖;目錄項目已下架者同樣略過。
 *
 * @param bosses 全部角色的 BOSS 追蹤紀錄(呼叫端不需預先過濾角色)
 * @param characterId 要計算的角色 id
 * @returns 群組鍵集合,元素格式為 `${bossCatalogId}|${resetCycle}`
 */
export function buildTrackedGroupKeys(bosses: CharacterBossTrackList[], characterId: string): Set<string> {
  const keys = new Set<string>();
  for (const boss of bosses) {
    if (boss.characterId !== characterId || !boss.bossCatalogId) continue;
    const entry = findBossCatalogEntry(boss.bossCatalogId);
    if (!entry || isCatalogEntryExpired(entry)) continue;
    keys.add(`${boss.bossCatalogId}|${boss.resetCycle}`);
  }
  return keys;
}
