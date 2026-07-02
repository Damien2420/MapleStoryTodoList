import type { ResetCycle } from '@/types';

export interface PresetTask {
  id: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  /** 每週任務的重置星期幾(0=日 ~ 6=六),未設定則沿用全域設定 */
  weeklyResetDay?: number;
}

/** 奧術之河/格蘭蒂斯等地區內的單一區域,依角色等級決定是否解鎖 */
export interface PresetZone {
  /** 區域名稱,套用後會建立成一筆同名的每日任務 */
  name: string;
  /** 進入該區域所需的最低角色等級 */
  minLevel: number;
}

/** 依角色等級展開成多筆任務的預設任務群組,例如奧術之河/格蘭蒂斯地區每日任務 */
export interface PresetTaskGroup {
  id: string;
  /** 選取按鈕上顯示的文字 */
  label: string;
  /** 在預設任務挑選清單裡的分類分組 */
  pickerCategory: string;
  /** 套用後,建立出來的任務要歸類到哪個分類 */
  taskCategory: string;
  resetCycle: ResetCycle;
  /** 每週任務的重置星期幾(0=日 ~ 6=六),未設定則沿用全域設定 */
  weeklyResetDay?: number;
  /** 依所需等級由低到高排序的區域列表 */
  zones: PresetZone[];
}

/**
 * 預設任務清單:提供使用者在新增任務/建立角色時一鍵套用的常見楓之谷任務範本。
 */
export const PRESET_TASKS: PresetTask[] = [
  { id: 'guild-weekly', name: '公會任務(水道/旗幟)', category: '公會', resetCycle: 'weekly', weeklyResetDay: 4 },
  {
    id: 'battlefield-dragon-slaying',
    name: '戰地 - 滅龍任務',
    category: '每週任務',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
  },
  {
    id: 'challenger-s3-hunting',
    name: '挑戰者伺服器 - 狩獵任務',
    category: '挑戰者伺服器S3活動',
    resetCycle: 'daily',
  },
  {
    id: 'challenger-s3-happy-day-checkin',
    name: 'Happy Day簽到',
    category: '每日任務',
    resetCycle: 'daily',
  },
  {
    id: 'challenger-s3-suspicious-barrier',
    name: '可疑結界 - 解除結界',
    category: '挑戰者伺服器S3活動',
    resetCycle: 'daily',
  },
  {
    id: 'challenger-s3-burning-express',
    name: '燃燒特快車 - 簽到',
    category: '燃燒活動',
    resetCycle: 'daily',
  },
  {
    id: 'challenger-s3-mentor-rank-reward',
    name: '師徒排名獎勵領取',
    category: '師徒',
    resetCycle: 'weekly',
  },
  {
    id: 'challenger-s3-crown-upgrade',
    name: 'CROWN升級任務',
    category: 'CROWN活動',
    resetCycle: 'weekly',
  },
  {
    id: 'challenger-s3-momentum-pass',
    name: '動量通行證 - 每週任務',
    category: '燃燒活動',
    resetCycle: 'weekly',
  },
  {
    id: 'challenger-s3-mentor-weekly-progress',
    name: '師徒每週進度',
    category: '師徒',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
  },
  { id: 'phantom-night-trace-collect', name: '幻影的痕跡收集', category: '幻影降臨之夜', resetCycle: 'daily' },
  {
    id: 'phantom-night-elanos-chronicle',
    name: '艾拉諾斯編年史 - 調查任務',
    category: '幻影降臨之夜',
    resetCycle: 'weekly',
    weeklyResetDay: 3,
  },
  {
    id: 'phantom-night-trace',
    name: '幻影痕跡',
    category: '幻影降臨之夜',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
  },
];

/** 依角色等級展開成多筆區域每日任務的預設任務群組 */
export const PRESET_TASK_GROUPS: PresetTaskGroup[] = [
  {
    id: 'challenger-s3-primal-instinct',
    label: '原始直覺',
    pickerCategory: '職業 Re-Master 簽到',
    taskCategory: '職業 Re-Master 簽到',
    resetCycle: 'daily',
    zones: [
      { name: '原始直覺 - 凱內西斯', minLevel: 1 },
      { name: '原始直覺 - 狂豹獵人', minLevel: 1 },
    ],
  },
  {
    id: 'arcane-river-daily',
    label: '奧術之河地區每日任務',
    pickerCategory: '每日任務',
    taskCategory: '奧術之河',
    resetCycle: 'daily',
    zones: [
      { name: '消逝的旅途', minLevel: 200 },
      { name: '啾啾愛爾蘭', minLevel: 210 },
      { name: '拉契爾恩', minLevel: 220 },
      { name: '阿爾卡娜', minLevel: 225 },
      { name: '魔菈斯', minLevel: 230 },
      { name: '艾斯佩拉', minLevel: 235 },
      { name: '月之橋', minLevel: 245 },
      { name: '苦痛迷宮', minLevel: 250 },
      { name: '利曼', minLevel: 255 },
    ],
  },
  {
    id: 'grandis-daily',
    label: '格蘭蒂斯地區每日任務',
    pickerCategory: '每日任務',
    taskCategory: '格蘭蒂斯',
    resetCycle: 'daily',
    zones: [
      { name: '賽爾尼溫', minLevel: 260 },
      { name: '飯店阿爾克斯', minLevel: 265 },
      { name: '奧迪溫', minLevel: 270 },
      { name: '桃源境', minLevel: 275 },
      { name: '阿爾特利亞', minLevel: 280 },
      { name: '卡爾西溫', minLevel: 285 },
      { name: '塔拉哈特', minLevel: 290 },
    ],
  },
  {
    id: 'epic-quests-weekly',
    label: '史詩副本',
    pickerCategory: '每週任務',
    taskCategory: '每週任務',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
    zones: [
      { name: '史詩副本 - 高山', minLevel: 260 },
      { name: '史詩副本 - 安格洛公司', minLevel: 270 },
      { name: '史詩副本 - 噩夢仙境', minLevel: 280 },
    ],
  },
  {
    id: 'crimson-queens-garden',
    label: '紅月之森',
    pickerCategory: '每週任務',
    taskCategory: '每週任務',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
    zones: [
      { name: '紅月之森', minLevel: 250 },
      { name: '紅月之森 公告欄', minLevel: 250 },
    ],
  },
  {
    id: 'eldath-request',
    label: '艾爾達斯的請求(六轉素材)',
    pickerCategory: '每週任務',
    taskCategory: '每週任務',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
    zones: [{ name: '艾爾達斯的請求(六轉素材)', minLevel: 260 }],
  },
];

/** 分類顯示順序:每日 -> 每週 -> 公會,未列出的分類排在最後 */
const CATEGORY_DISPLAY_ORDER = ['每日任務', '每週任務', '公會'];

/** 依 CATEGORY_DISPLAY_ORDER 排序分類清單,用於預設任務挑選/預覽畫面 */
export function sortByCategoryOrder<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort(([a], [b]) => {
    const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a);
    const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b);
    const orderA = indexA === -1 ? CATEGORY_DISPLAY_ORDER.length : indexA;
    const orderB = indexB === -1 ? CATEGORY_DISPLAY_ORDER.length : indexB;
    return orderA - orderB;
  });
}

/** 群組內角色等級可進入的區域(依 minLevel 由低到高) */
export function getUnlockedZones(group: PresetTaskGroup, characterLevel: number): PresetZone[] {
  return group.zones.filter((zone) => characterLevel >= zone.minLevel);
}

/** 角色等級是否已達群組最低門檻(第一個區域的需求等級) */
export function isPresetGroupUnlocked(group: PresetTaskGroup, characterLevel: number): boolean {
  return group.zones.length > 0 && characterLevel >= group.zones[0].minLevel;
}

/** 將群組依角色等級展開成實際要建立的任務清單 */
export function expandPresetGroup(group: PresetTaskGroup, characterLevel: number): PresetTask[] {
  return getUnlockedZones(group, characterLevel).map((zone) => ({
    id: `${group.id}:${zone.name}`,
    name: zone.name,
    category: group.taskCategory,
    resetCycle: group.resetCycle,
    weeklyResetDay: group.weeklyResetDay,
  }));
}

/** 依照已選取的預設任務 id(含一般任務與地區群組)與角色等級,解析出最終要建立的任務清單 */
export function resolveSelectedPresetTasks(selectedIds: Set<string>, characterLevel: number): PresetTask[] {
  const tasks = PRESET_TASKS.filter((task) => selectedIds.has(task.id));
  for (const group of PRESET_TASK_GROUPS) {
    if (selectedIds.has(group.id)) {
      tasks.push(...expandPresetGroup(group, characterLevel));
    }
  }
  return tasks;
}
