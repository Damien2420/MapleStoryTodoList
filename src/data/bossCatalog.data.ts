import type { BossCatalogEntry } from '@/lib/bossCatalog';

/**
 * BOSS 名單:內建常見週/日 BOSS,收益數字為參考值,套用後可在畫面上手動覆寫。
 * 若名單缺某隻王,需由開發端擴充此清單,使用者無法自行新增。
 */
export const BOSS_CATALOG: BossCatalogEntry[] = [
  {
    id: 'barlog',
    name: '巴洛古',
    difficulties: [
      { difficulty: '簡單', crystalValue: 120_000_000, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'zakum',
    name: '炎魔',
    difficulties: [
      { difficulty: '簡單', crystalValue: 115_800, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 384_000, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 7_059_750, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'magnus',
    name: '梅格耐斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 318_300, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 1_501_700, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 8_819_007, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'hilla',
    name: '希拉',
    difficulties: [
      { difficulty: '普通', crystalValue: 463_500, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 6_677_700, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'mori-ranmaru',
    name: '森蘭丸',
    difficulties: [
      { difficulty: '普通', crystalValue: 375_500, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 1_543_700, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'kawoong',
    name: '卡翁',
    difficulties: [
      { difficulty: '普通', crystalValue: 724_200, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'papulatus',
    name: '拉圖斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 396_500, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 1_543_700, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 20_088_150, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'crimson-queen',
    name: '血腥皇后',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 7_682_035, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'pierre',
    name: '比艾樂',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 7_313_306, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'von-bon',
    name: '斑斑',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 7_693_781, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'vellum',
    name: '貝倫',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_800, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 9_070_003, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'von-leon',
    name: '凡雷恩',
    difficulties: [
      { difficulty: '簡單', crystalValue: 612_900, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 814_700, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 1_419_500, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'horntail',
    name: '闇黑龍王',
    difficulties: [
      { difficulty: '簡單', crystalValue: 511_000, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 586_600, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 783_300, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'arkarium',
    name: '阿卡伊農',
    difficulties: [
      { difficulty: '簡單', crystalValue: 667_400, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 1_460_300, resetCycle: 'daily', maxPartySize: 6 },
    ],
  },
  {
    id: 'princess-no',
    name: '濃姬',
    difficulties: [{ difficulty: '普通', crystalValue: 18_500_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 }],
  },
  {
    id: 'pink-bean',
    name: '粉豆',
    difficulties: [
      { difficulty: '普通', crystalValue: 813_700, resetCycle: 'daily', maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 7_630_700, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'cygnus',
    name: '西格諾斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 5_307_400, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 8_709_400, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'lotus',
    name: '史烏',
    difficulties: [
      { difficulty: '普通', crystalValue: 27_207_040, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 91_900_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '極限', crystalValue: 323_500_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'damien',
    name: '戴米安',
    difficulties: [
      { difficulty: '普通', crystalValue: 28_843_452, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 85_700_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'lucid',
    name: '露希妲',
    difficulties: [
      { difficulty: '簡單', crystalValue: 53_800_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 64_300_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 102_400_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'will',
    name: '威爾',
    difficulties: [
      { difficulty: '簡單', crystalValue: 57_400_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 74_200_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 127_400_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'guardian-angel-slime',
    name: '守護天使綠水靈',
    difficulties: [
      { difficulty: '普通', crystalValue: 43_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 126_500_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'gloom',
    name: '戴斯克',
    difficulties: [
      { difficulty: '普通', crystalValue: 79_500_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 111_200_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'verus-hilla',
    name: '真希拉',
    difficulties: [
      { difficulty: '普通', crystalValue: 124_400_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 145_200_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'darknell',
    name: '頓凱爾',
    difficulties: [
      { difficulty: '普通', crystalValue: 84_700_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 126_200_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'malitia',
    name: '瑪莉西亞',
    difficulties: [
      { difficulty: '普通', crystalValue: 150_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '終極', crystalValue: 1_500_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'black-mage',
    name: '黑魔法師',
    difficulties: [
      { difficulty: '困難', crystalValue: 990_841_916, resetCycle: 'monthly', maxPartySize: 6 },
      { difficulty: '極限', crystalValue: 3_000_000_000, resetCycle: 'monthly', maxPartySize: 6 },
    ],
  },
  {
    id: 'seren',
    name: '賽蓮',
    difficulties: [
      { difficulty: '普通', crystalValue: 114_980_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 271_600_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '極限', crystalValue: 724_200_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'kalos',
    name: '卡洛斯',
    difficulties: [
      { difficulty: '簡單', crystalValue: 236_900_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 309_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '渾沌', crystalValue: 618_800_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '極限', crystalValue: 1_237_100_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'first-adversary',
    name: '最初的敵對者',
    difficulties: [
      { difficulty: '簡單', crystalValue: 252_700_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '普通', crystalValue: 371_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '困難', crystalValue: 682_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '極限', crystalValue: 1_344_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'kaling',
    name: '咖凌',
    difficulties: [
      { difficulty: '簡單', crystalValue: 258_300_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '普通', crystalValue: 361_700_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '困難', crystalValue: 721_100_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
      { difficulty: '極限', crystalValue: 1_443_300_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 6 },
    ],
  },
  {
    id: 'limbo',
    name: '林波',
    difficulties: [
      { difficulty: '普通', crystalValue: 420_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '困難', crystalValue: 749_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'baldrix',
    name: '巴德洛斯',
    difficulties: [
      { difficulty: '普通', crystalValue: 560_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '困難', crystalValue: 840_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'radiant-ominous-star',
    name: '燦爛的凶星',
    difficulties: [
      { difficulty: '普通', crystalValue: 355_320_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '困難', crystalValue: 817_510_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'yubitae',
    name: '尤比太',
    difficulties: [
      { difficulty: '普通', crystalValue: 705_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
      { difficulty: '困難', crystalValue: 1_368_000_000, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 3 },
    ],
  },
  {
    id: 'kai',
    name: '凱伊',
    category: 'season',
    expiresAt: '2026-10-20',
    difficulties: [
      { difficulty: '普通', crystalValue: 0, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 1 },
      { difficulty: '困難', crystalValue: 0, resetCycle: 'weekly', weeklyResetDay: 4, maxPartySize: 1 },
    ],
  },
];
