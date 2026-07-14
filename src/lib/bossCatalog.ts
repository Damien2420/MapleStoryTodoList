import type { BossDifficulty } from '@/types';

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
    id: 'yan-mo',
    name: '炎魔',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'mei-ge-nai-si',
    name: '梅格耐斯',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'xi-la',
    name: '希拉',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'la-tu-si',
    name: '拉圖斯',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'xue-xing-huang-hou',
    name: '血腥皇后',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'bi-ai-le',
    name: '比艾樂',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'ban-ban',
    name: '斑斑',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'bei-lun',
    name: '貝倫',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'fen-dou',
    name: '粉豆',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'xi-ge-nuo-si',
    name: '西格諾斯',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'shi-wu',
    name: '史烏',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'dai-mi-an',
    name: '戴米安',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'lu-xi-da',
    name: '露希妲',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'wei-er',
    name: '威爾',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'shou-hu-tian-shi-lv-shui-ling',
    name: '守護天使綠水靈',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'dai-si-ke',
    name: '戴斯克',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'zhen-xi-la',
    name: '真希拉',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'dun-kai-er',
    name: '頓凱爾',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'sai-lian',
    name: '賽蓮',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'ka-luo-si',
    name: '卡洛斯',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'zui-chu-de-di-dui-zhe',
    name: '最初的敵對者',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'ka-ling',
    name: '咖凌',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'lin-bo',
    name: '林波',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'ba-de-luo-si',
    name: '巴德洛斯',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'ma-li-xi-ya',
    name: '瑪莉西亞',
    difficulties: [{ difficulty: '困難', crystalValue: 10_000_000, resetCycle: 'weekly', weeklyResetDay: 4 }],
  },
  {
    id: 'black-mage',
    name: '黑魔法師',
    difficulties: [{ difficulty: '極限', crystalValue: 120_000_000, resetCycle: 'monthly' }],
  },
  {
    id: 'papulatus',
    name: '巨魔隊長',
    difficulties: [
      { difficulty: '簡單', crystalValue: 50_000, resetCycle: 'daily' },
      { difficulty: '普通', crystalValue: 150_000, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 400_000, resetCycle: 'daily' },
    ],
  },
  {
    id: 'pink-bean',
    name: '惡魔特工王',
    difficulties: [
      { difficulty: '普通', crystalValue: 100_000, resetCycle: 'daily' },
      { difficulty: '困難', crystalValue: 300_000, resetCycle: 'daily' },
      { difficulty: '極限', crystalValue: 600_000, resetCycle: 'daily' },
    ],
  },
  {
    id: 'kai-yi',
    name: '凱伊',
    category: 'season',
    expiresAt: '2026-10-20',
    difficulties: [{ difficulty: '困難', crystalValue: 0, resetCycle: 'weekly', weeklyResetDay: 4 }],
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
