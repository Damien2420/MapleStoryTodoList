import type { CharacterTask, ResetCycle } from '@/types';
import { PRESET_TASKS } from '@/data/presetTasks.data';
import { PRESET_TASK_GROUPS } from '@/data/presetTaskGroups.data';

export { PRESET_TASKS, PRESET_TASK_GROUPS };

export interface PresetTask {
  id: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  /** 每週任務的重置星期幾(0=日 ~ 6=六),未設定則沿用全域設定 */
  weeklyResetDay?: number;
  /** 是否仍可在「新增任務」流程中選取,預設 true;設為 false 代表已下架但保留歷史資料 */
  active?: boolean;
  /** 活動/限時任務的最後一天(YYYY-MM-DD),當天結束後自動視為已下架;未設定代表無期限 */
  expiresAt?: string;
  /** 來源 id,用於建立任務時回填 CharacterTask.presetId;群組展開出的任務會設成群組 id,未設定則視為自己的 id */
  sourceId?: string;
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
  /** 是否仍可在「新增任務」流程中選取,預設 true;設為 false 代表整個群組(所有區域)已下架但保留歷史資料 */
  active?: boolean;
  /** 活動/限時群組的最後一天(YYYY-MM-DD),當天結束後自動視為已下架;未設定代表無期限 */
  expiresAt?: string;
}

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
    sourceId: group.id,
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

/** 計算單一已建立任務在預設任務目錄中的排序權重:一般任務用 PRESET_TASKS 的位置,群組展開出的任務用「群組位置 + 區域位置」;查無來源(手動建立/已被移除)回傳 Infinity */
function presetTaskRank(task: Pick<CharacterTask, 'presetId' | 'name'>): number {
  if (!task.presetId) return Infinity;
  const taskIndex = PRESET_TASKS.findIndex((t) => t.id === task.presetId);
  if (taskIndex !== -1) return taskIndex;
  const groupIndex = PRESET_TASK_GROUPS.findIndex((g) => g.id === task.presetId);
  if (groupIndex === -1) return Infinity;
  const zoneIndex = PRESET_TASK_GROUPS[groupIndex].zones.findIndex((zone) => zone.name === task.name);
  return PRESET_TASKS.length + groupIndex * 1000 + (zoneIndex === -1 ? 0 : zoneIndex);
}

/**
 * 依預設任務目錄的順序排序「已建立」的任務,不論分幾次套用都會得到同一個順序;
 * 查無對應來源(手動建立的任務、或來源已被移除)的排到最後,彼此保持原本的相對順序。
 */
export function sortTasksByPresetOrder(tasks: CharacterTask[]): CharacterTask[] {
  return [...tasks].sort((a, b) => presetTaskRank(a) - presetTaskRank(b));
}

/** 判斷 expiresAt(YYYY-MM-DD)是否已超過當天結束(23:59:59.999) */
function isDateExpired(expiresAt: string, now: Date): boolean {
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  return now.getTime() > end.getTime();
}

/** 依 presetId(單筆任務或群組的 id)查找對應來源是否已過期(下架):手動 active === false,或已超過 expiresAt 當天;查無來源視為未過期 */
export function isPresetExpired(presetId: string, now: Date = new Date()): boolean {
  const task = PRESET_TASKS.find((t) => t.id === presetId);
  if (task) return task.active === false || (task.expiresAt !== undefined && isDateExpired(task.expiresAt, now));
  const group = PRESET_TASK_GROUPS.find((g) => g.id === presetId);
  if (group) return group.active === false || (group.expiresAt !== undefined && isDateExpired(group.expiresAt, now));
  return false;
}

/** 依 presetId(單筆任務或群組的 id)查找對應來源的 expiresAt;查無來源或未設定回傳 undefined */
export function findPresetExpiresAt(presetId: string): string | undefined {
  const task = PRESET_TASKS.find((t) => t.id === presetId);
  if (task) return task.expiresAt;
  const group = PRESET_TASK_GROUPS.find((g) => g.id === presetId);
  if (group) return group.expiresAt;
  return undefined;
}
