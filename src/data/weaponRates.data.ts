import type { BossDifficulty } from '@/types';

/**
 * 四把武器的數值表:各 BOSS 取得量、階段需求、持有上限與升階任務。
 * 難度一律用 BOSS 目錄的寫法(官方表的「終極」= 目錄「極限」,瑪莉西亞例外維持「終極」;「混沌」= 渾沌)。
 * 數字都是遊戲內的整數單位,換算成內部 1/60 單位由 lib/weapon 負責。
 */

/** 單隻 BOSS 各難度的取得量 */
export type BossRateRow = Partial<Record<BossDifficulty, number>>;

/** 依 BOSS 目錄 id 查各難度取得量 */
export type BossRateTable = Record<string, BossRateRow>;

/** 靈魂碎片:每個遊戲週只取打過的週王中最高的一隻,不平分 */
export const SOUL_SHARD_RATES: BossRateTable = {
  cygnus: { 普通: 10 },
  zakum: { 渾沌: 10 },
  'von-bon': { 渾沌: 10 },
  pierre: { 渾沌: 10 },
  'crimson-queen': { 渾沌: 10 },
  vellum: { 渾沌: 10 },
  'princess-no': { 普通: 10 },
  magnus: { 困難: 10 },
  papulatus: { 渾沌: 10 },
  lotus: { 普通: 10, 困難: 45, 極限: 450 },
  damien: { 普通: 10, 困難: 50 },
  'guardian-angel-slime': { 普通: 10, 渾沌: 90 },
  lucid: { 簡單: 10, 普通: 35, 困難: 80 },
  will: { 簡單: 10, 普通: 35, 困難: 80 },
  gloom: { 普通: 40, 渾沌: 90 },
  darknell: { 普通: 40, 困難: 95 },
  'verus-hilla': { 普通: 70, 困難: 100 },
  seren: { 普通: 160, 困難: 250, 極限: 750 },
  malitia: { 普通: 170, 終極: 5000 },
  kalos: { 簡單: 180, 普通: 325, 渾沌: 550, 極限: 2600 },
  'first-adversary': { 簡單: 200, 普通: 350, 困難: 1000, 極限: 2800 },
  kaling: { 簡單: 300, 普通: 500, 困難: 900, 極限: 3000 },
  'radiant-ominous-star': { 普通: 480, 困難: 1500 },
  limbo: { 普通: 600, 困難: 1400 },
  baldrix: { 普通: 800, 困難: 2400 },
  yubitae: { 普通: 1200, 困難: 3500 },
};

/** 黑暗痕跡(創世):依人數平分,套用創世通行證時 x3 */
export const GENESIS_TRACE_RATES: BossRateTable = {
  lotus: { 普通: 10, 困難: 50, 極限: 50 },
  damien: { 普通: 10, 困難: 50 },
  lucid: { 簡單: 15, 普通: 20, 困難: 65 },
  will: { 簡單: 15, 普通: 25, 困難: 75 },
  gloom: { 普通: 20, 渾沌: 65 },
  darknell: { 普通: 25, 困難: 75 },
  'verus-hilla': { 普通: 45, 困難: 90 },
  'black-mage': { 困難: 600, 極限: 600 },
};

/** 敵對者的決心(命運):依人數平分 */
export const DESTINY_RESOLVE_RATES: BossRateTable = {
  seren: { 困難: 6, 極限: 80 },
  kalos: { 普通: 10, 渾沌: 70, 極限: 400 },
  'first-adversary': { 普通: 15, 困難: 120, 極限: 500 },
  'radiant-ominous-star': { 普通: 20, 困難: 380 },
  kaling: { 普通: 20, 困難: 160, 極限: 1200 },
  limbo: { 普通: 120, 困難: 360 },
  baldrix: { 普通: 150, 困難: 450 },
  yubitae: { 普通: 160, 困難: 500 },
};

/** 激戰的痕跡(阿斯特拉):依人數平分 */
export const ASTRA_TRACE_RATES: BossRateTable = {
  seren: { 普通: 6, 困難: 15, 極限: 180 },
  kalos: { 簡單: 6, 普通: 30, 渾沌: 100, 極限: 500 },
  'first-adversary': { 簡單: 10, 普通: 40, 困難: 180, 極限: 540 },
  kaling: { 簡單: 20, 普通: 80, 困難: 240, 極限: 1440 },
  'radiant-ominous-star': { 普通: 60, 困難: 240 },
  limbo: { 普通: 80, 困難: 240 },
  baldrix: { 普通: 80, 困難: 240 },
  yubitae: { 普通: 210, 困難: 630 },
};

/** 艾里溫碎片(阿斯特拉)的 BOSS 掉落:交換券 1 張 = 1 個,不平分 */
export const ASTRA_SHARD_RATES: BossRateTable = {
  seren: { 極限: 30 },
  'first-adversary': { 困難: 30, 極限: 240 },
  kaling: { 困難: 60, 極限: 480 },
  limbo: { 困難: 60 },
  'radiant-ominous-star': { 困難: 90 },
  baldrix: { 困難: 120 },
  kalos: { 極限: 180 },
  yubitae: { 普通: 45, 困難: 360 },
};

/** 格蘭蒂斯地區每日任務:地區名稱(同任務名稱)對應每天的艾里溫碎片,每天只算完成的最高地區 */
export const GRANDIS_DAILY_SHARDS: Record<string, number> = {
  賽爾尼溫: 1,
  飯店阿爾克斯: 3,
  奧迪溫: 6,
  桃源境: 10,
  阿爾特利亞: 15,
  卡爾西溫: 25,
  塔拉哈特: 45,
};

/** 格蘭蒂斯地區每日任務的預設群組 id(任務的 presetId) */
export const GRANDIS_DAILY_PRESET_ID = 'grandis-daily';

/** 升階 BOSS 任務:任務名稱與對應的 BOSS(只用來顯示頭像) */
export interface WeaponQuest {
  name: string;
  bossCatalogId: string;
}

/** 創世武器:8 階的需求、任務與持有上限 */
export const GENESIS = {
  needs: [500, 500, 500, 1000, 1000, 1000, 1000, 1000],
  cap: 3000,
  quests: [
    { name: '獅子王凡雷恩的痕跡', bossCatalogId: 'von-leon' },
    { name: '時間的大神官阿卡伊農的痕跡', bossCatalogId: 'arkarium' },
    { name: '暴君梅格耐斯的痕跡', bossCatalogId: 'magnus' },
    { name: '翼之主史烏的痕跡', bossCatalogId: 'lotus' },
    { name: '破滅之劍戴米安的痕跡', bossCatalogId: 'damien' },
    { name: '蜘蛛王威爾的痕跡', bossCatalogId: 'will' },
    { name: '惡夢的主人的痕跡', bossCatalogId: 'lucid' },
    { name: '赤紅魔女真‧希拉的痕跡', bossCatalogId: 'verus-hilla' },
  ] satisfies WeaponQuest[],
} as const;

/**
 * 命運武器:決戰任務 = 階段,共 6 階,分兩個階段;
 * 第一階段 1~3 階(升級成命運武器)上限 3,000,第二階段 4~6 階(二次解放)上限 15,000
 */
export const DESTINY = {
  needs: [2000, 2500, 3000, 10000, 12500, 15000],
  phaseCaps: [3000, 15000],
  /** 角色等級門檻(只決定 UI 顯示未解鎖) */
  minLevel: 275,
  quests: [
    { name: '決戰，受選的賽蓮', bossCatalogId: 'seren' },
    { name: '決戰，監視者卡洛斯', bossCatalogId: 'kalos' },
    { name: '決戰，使者咖凌', bossCatalogId: 'kaling' },
    { name: '決戰，最初的敵對者', bossCatalogId: 'first-adversary' },
    { name: '決戰，使者林波', bossCatalogId: 'limbo' },
    { name: '決戰，使者巴德利斯', bossCatalogId: 'baldrix' },
  ] satisfies WeaponQuest[],
} as const;

/** 阿斯特拉輔助武器:3 階,每階需要激戰的痕跡與艾里溫碎片兩種素材 */
export const ASTRA = {
  traceNeeds: [600, 600, 800],
  shardNeeds: [3000, 3000, 4000],
  traceCap: 1000,
  minLevel: 265,
} as const;

/** 靈魂武器的持有上限 */
export const SOUL_CAP = 9_000_000;

/**
 * 靈魂武器每一級所需的碎片:index = 要升到的等級(SOUL_LEVEL_COSTS[2] = Lv.1 → Lv.2 需要 6);
 * index 0、1 不使用。每 10 級一階,各階總量 100 / 450 / 900 / 1,800 / 3,200 / 6,550 / 9,750 / 22,750 / 39,000 / 45,000
 */
export const SOUL_LEVEL_COSTS: readonly number[] = [
  0, 0,
  // Lv.2~10
  6, 7, 8, 9, 12, 13, 14, 15, 16,
  // Lv.11~20
  31, 34, 37, 41, 43, 47, 49, 53, 56, 59,
  // Lv.21~30
  62, 68, 74, 80, 87, 93, 100, 106, 112, 118,
  // Lv.31~40
  123, 135, 149, 161, 173, 187, 199, 211, 225, 237,
  // Lv.41~50
  206, 232, 257, 282, 308, 332, 358, 383, 408, 434,
  // Lv.51~60
  442, 490, 536, 584, 632, 678, 726, 774, 820, 868,
  // Lv.61~70
  667, 735, 804, 873, 941, 1009, 1077, 1146, 1215, 1283,
  // Lv.71~80
  1541, 1704, 1867, 2031, 2193, 2357, 2519, 2683, 2846, 3009,
  // Lv.81~90
  2763, 3015, 3269, 3521, 3773, 4027, 4279, 4531, 4785, 5037,
  // Lv.91~100
  3079, 3395, 3711, 4027, 4343, 4657, 4973, 5289, 5605, 5921,
];

/** 靈魂武器的升階任務(單人擊破任一隻):key 為「從第幾階升上去」,在每階最高等級(Lv.10、20…90)完成 */
export const SOUL_QUESTS: Record<number, { bossCatalogId: string; difficulty: BossDifficulty }[]> = {
  1: [
    { bossCatalogId: 'lucid', difficulty: '普通' },
    { bossCatalogId: 'will', difficulty: '普通' },
    { bossCatalogId: 'gloom', difficulty: '普通' },
    { bossCatalogId: 'darknell', difficulty: '普通' },
    { bossCatalogId: 'lotus', difficulty: '困難' },
    { bossCatalogId: 'damien', difficulty: '困難' },
    { bossCatalogId: 'verus-hilla', difficulty: '普通' },
  ],
  2: [
    { bossCatalogId: 'lucid', difficulty: '困難' },
    { bossCatalogId: 'will', difficulty: '困難' },
    { bossCatalogId: 'guardian-angel-slime', difficulty: '渾沌' },
    { bossCatalogId: 'gloom', difficulty: '渾沌' },
    { bossCatalogId: 'darknell', difficulty: '困難' },
    { bossCatalogId: 'verus-hilla', difficulty: '困難' },
  ],
  3: [
    { bossCatalogId: 'seren', difficulty: '普通' },
    { bossCatalogId: 'malitia', difficulty: '普通' },
    { bossCatalogId: 'kalos', difficulty: '簡單' },
    { bossCatalogId: 'first-adversary', difficulty: '簡單' },
  ],
  4: [
    { bossCatalogId: 'seren', difficulty: '困難' },
    { bossCatalogId: 'kaling', difficulty: '簡單' },
    { bossCatalogId: 'kalos', difficulty: '普通' },
    { bossCatalogId: 'first-adversary', difficulty: '普通' },
  ],
  5: [
    { bossCatalogId: 'lotus', difficulty: '極限' },
    { bossCatalogId: 'radiant-ominous-star', difficulty: '普通' },
    { bossCatalogId: 'kaling', difficulty: '普通' },
    { bossCatalogId: 'kalos', difficulty: '渾沌' },
    { bossCatalogId: 'limbo', difficulty: '普通' },
  ],
  6: [
    { bossCatalogId: 'seren', difficulty: '極限' },
    { bossCatalogId: 'baldrix', difficulty: '普通' },
    { bossCatalogId: 'kaling', difficulty: '困難' },
    { bossCatalogId: 'first-adversary', difficulty: '困難' },
  ],
  7: [
    { bossCatalogId: 'yubitae', difficulty: '普通' },
    { bossCatalogId: 'limbo', difficulty: '困難' },
    { bossCatalogId: 'radiant-ominous-star', difficulty: '困難' },
  ],
  8: [
    { bossCatalogId: 'baldrix', difficulty: '困難' },
    { bossCatalogId: 'kalos', difficulty: '極限' },
    { bossCatalogId: 'first-adversary', difficulty: '極限' },
    { bossCatalogId: 'kaling', difficulty: '極限' },
  ],
  9: [
    { bossCatalogId: 'yubitae', difficulty: '困難' },
    { bossCatalogId: 'malitia', difficulty: '終極' },
  ],
};
