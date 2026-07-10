import type { JobGroup } from '@/lib/jobs';
import type { Server } from '@/lib/servers';

/** 任務重置週期:每日 / 每週 / 一次性(不自動重置) */
export type ResetCycle = 'daily' | 'weekly' | 'once';

/** 角色名稱最大長度 */
export const CHARACTER_NAME_MAX_LENGTH = 20;
/** 任務名稱最大長度 */
export const TASK_NAME_MAX_LENGTH = 50;

/** 遊戲角色 */
export interface Character {
  id: string;
  name: string;
  server: Server;
  level: number;
  jobGroup: JobGroup;
  job: string;
  order: number;
}

/** 角色底下的實際任務(勾選狀態、重置時間都是角色獨立的) */
export interface CharacterTask {
  id: string;
  characterId: string;
  /** 建立當下對應的預設任務/群組 id,用來之後查目錄判斷是否已下架;上線前建立的舊紀錄或手動新增的任務可能沒有此欄位 */
  presetId?: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  /** 每週任務的重置星期幾(0=日 ~ 6=六),未設定則沿用全域設定 */
  weeklyResetDay?: number;
  dueDate?: string;
  checked: boolean;
  /** 上次重置勾選狀態的時間(ISO string),用來判斷是否已跨越下一次重置點 */
  lastResetAt: string;
  order: number;
}

/** 重置時間設定 */
export interface Settings {
  /** 每日重置時間,24 小時制 "HH:mm" */
  dailyResetTime: string;
  /** 每週重置星期幾,0(日)-6(六) */
  weeklyResetDay: number;
  /** 每週重置時間,24 小時制 "HH:mm" */
  weeklyResetTime: string;
}
