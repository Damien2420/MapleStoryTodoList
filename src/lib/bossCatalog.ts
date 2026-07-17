import type { BossDifficulty, CharacterBossTrackList } from '@/types';

/** 單一難度的參考收益與重置週期,僅供套用時帶入初始值,非即時經濟數據 */
export interface BossDifficultyOption {
  difficulty: BossDifficulty;
  crystalValue: number;
  resetCycle: 'daily' | 'weekly' | 'monthly';
  /** 週重置的星期幾(0=日~6=六),僅 resetCycle === 'weekly' 時有意義 */
  weeklyResetDay?: number;
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

/**
 * BOSS 名單:內建常見週/日 BOSS,收益數字為參考值,套用後可在畫面上手動覆寫。
 * 若名單缺某隻王,需由開發端擴充此清單,使用者無法自行新增。
 */
export const BOSS_CATALOG: BossCatalogEntry[] = [
  {
    id: 'barlog',
    name: '巴洛古',
    difficulties: [
      { difficulty: '簡單', crystalValue: 120_000_000, resetCycle: 'daily' },
    ],
  },
  {
    id: 'zakum',
    name: '炎魔',
    difficulties: [
      { difficulty: '簡單', crystalValue: 115_800, resetCycle: 'daily' },
      { difficulty: '普通', crystalValue: 384_000, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 7_059_750, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'magnus',
    name: '梅格耐斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 318_300, resetCycle: 'daily' },
      { difficulty: '普通', crystalValue: 1_501_700, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 8_819_007, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'hilla',
    name: '希拉',
    difficulties: [
      { difficulty: '普通', crystalValue: 463_500, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 6_677_700, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'mori-ranmaru',
    name: '森蘭丸',
    difficulties: [
      { difficulty: '普通', crystalValue: 375_500, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 1_543_700, resetCycle: 'daily' },
    ],
  },
  {
    id: 'kawoong',
    name: '卡翁',
    difficulties: [
      { difficulty: '普通', crystalValue: 724_200, resetCycle: 'daily' },
    ],
  },
  {
    id: 'papulatus',
    name: '拉圖斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 396_500, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 1_543_700, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 20_088_150, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'crimson-queen',
    name: '血腥皇后',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 7_682_035, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'pierre',
    name: '比艾樂',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 7_313_306, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'von-bon',
    name: '斑斑',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 7_693_781, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'vellum',
    name: '貝倫',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 9_070_003, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'von-leon',
    name: '凡雷恩',
    difficulties: [
      { difficulty: '簡單', crystalValue: 612_900, resetCycle: 'daily' },
      { difficulty: '普通', crystalValue: 814_700, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 1_419_500, resetCycle: 'daily' },
    ],
  },
  {
    id: 'horntail',
    name: '闇黑龍王',
    difficulties: [
      { difficulty: '簡單', crystalValue: 511_000, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 586_600, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 783_300, resetCycle: 'daily' },
    ],
  },
  {
    id: 'arkarium',
    name: '阿卡伊農',
    difficulties: [
      { difficulty: '簡單', crystalValue: 667_400, resetCycle: 'daily' },
      { difficulty: '普通', crystalValue: 1_460_300, resetCycle: 'daily' },
    ],
  },
  {
    id: 'princess-no',
    name: '濃姬',
    difficulties: [{ difficulty: '普通', crystalValue: 18_500_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'pink-bean',
    name: '粉豆',
    difficulties: [
      { difficulty: '普通', crystalValue: 813_700, resetCycle: 'daily' },
      { difficulty: '渾沌', crystalValue: 7_630_700, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'cygnus',
    name: '西格諾斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 5_307_400, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 8_709_400, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'lotus',
    name: '史烏',
    difficulties: [
      { difficulty: '普通', crystalValue: 27_207_040, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 91_900_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '極限', crystalValue: 323_500_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'damien',
    name: '戴米安',
    difficulties: [
      { difficulty: '普通', crystalValue: 28_843_452, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 85_700_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'lucid',
    name: '露希妲',
    difficulties: [
      { difficulty: '簡單', crystalValue: 53_800_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 64_300_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 102_400_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'will',
    name: '威爾',
    difficulties: [
      { difficulty: '簡單', crystalValue: 57_400_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 74_200_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 127_400_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'guardian-angel-slime',
    name: '守護天使綠水靈',
    difficulties: [
      { difficulty: '普通', crystalValue: 43_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '渾沌', crystalValue: 126_500_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'gloom',
    name: '戴斯克',
    difficulties: [
      { difficulty: '普通', crystalValue: 79_500_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '渾沌', crystalValue: 111_200_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'verus-hilla',
    name: '真希拉',
    difficulties: [
      { difficulty: '普通', crystalValue: 124_400_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 145_200_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'darknell',
    name: '頓凱爾',
    difficulties: [
      { difficulty: '普通', crystalValue: 84_700_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 126_200_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'malitia',
    name: '瑪莉西亞',
    difficulties: [
      { difficulty: '普通', crystalValue: 150_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '終極', crystalValue: 1_500_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'black-mage',
    name: '黑魔法師',
    difficulties: [
      { difficulty: '困難', crystalValue: 990_841_916, resetCycle: 'monthly' },
      { difficulty: '極限', crystalValue: 3_000_000_000, resetCycle: 'monthly' },
    ],
  },
  {
    id: 'seren',
    name: '賽蓮',
    difficulties: [
      { difficulty: '普通', crystalValue: 114_980_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 271_600_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '極限', crystalValue: 724_200_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'kalos',
    name: '卡洛斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 236_900_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 309_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '渾沌', crystalValue: 618_800_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '極限', crystalValue: 1_237_100_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'first-adversary',
    name: '最初的敵對者',
    difficulties: [
      { difficulty: '簡單', crystalValue: 252_700_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 371_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 682_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '極限', crystalValue: 1_344_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'kaling',
    name: '咖凌',
    difficulties: [
      { difficulty: '簡單', crystalValue: 258_300_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '普通', crystalValue: 361_700_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 721_100_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '極限', crystalValue: 1_443_300_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'limbo',
    name: '林波',
    difficulties: [
      { difficulty: '普通', crystalValue: 420_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 749_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'baldrix',
    name: '巴德洛斯',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 840_000_000, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
  {
    id: 'kai',
    name: '凱伊',
    category: 'season',
    expiresAt: '2026-10-20',
    difficulties: [
      { difficulty: '普通', crystalValue: 0, resetCycle: 'weekly', weeklyResetDay: 4 },
      { difficulty: '困難', crystalValue: 0, resetCycle: 'weekly', weeklyResetDay: 4 },
    ],
  },
];

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
