/** 任務重置週期:每日 / 每週 / 一次性(不自動重置) */
export type ResetCycle = 'daily' | 'weekly' | 'once';

/** 角色名稱最大長度 */
export const CHARACTER_NAME_MAX_LENGTH = 20;
/** 任務名稱最大長度 */
export const TASK_NAME_MAX_LENGTH = 50;

/** 伺服器列表(組隊/世界頻道分區) */
export const SERVERS = ['艾麗亞', '普力特', '琉德', '優依娜', '愛麗西亞', '殺人鯨', '挑戰者'] as const;
export type Server = (typeof SERVERS)[number];

/** 職業群與其底下的職業列表 */
export const JOB_GROUPS = [
  { group: '冒險家-劍士', jobs: ['英雄', '聖騎士', '黑騎士'] },
  { group: '冒險家-法師', jobs: ['主教', '大魔導士(冰、雷)', '大魔導士(火、毒)'] },
  { group: '冒險家-弓箭手', jobs: ['箭神', '神射手', '開拓者'] },
  { group: '冒險家-盜賊', jobs: ['夜使者', '暗影神偷', '影武者'] },
  { group: '冒險家-海盜', jobs: ['槍神', '拳霸', '重砲指揮官'] },
  {
    group: '皇家騎士團',
    jobs: ['聖魂劍士', '烈焰巫師', '破風使者', '暗夜行者', '閃雷悍將', '米哈逸(團長)'],
  },
  { group: '英雄團', jobs: ['狂狼勇士', '龍魔導士', '精靈遊俠', '幻影俠盜', '隱月', '夜光'] },
  {
    group: '末日反抗軍',
    jobs: ['爆拳槍神', '煉獄巫師', '狂豹獵人', '機甲戰神', '傑諾', '惡魔殺手', '惡魔復仇者'],
  },
  { group: '超新星', jobs: ['凱撒', '凱殷', '卡蒂娜', '天使破壞者'] },
  { group: '雷普', jobs: ['阿戴爾', '伊利恩', '卡莉', '亞克'] },
  { group: '阿尼瑪', jobs: ['蓮', '菈菈', '虎影'] },
  { group: '魔族', jobs: ['蕾媞'] },
  { group: '朋友世界', jobs: ['凱內西斯'] },
  { group: '超越者', jobs: ['神之子'] },
  { group: '海外職業-曉之陣', jobs: ['劍豪', '陰陽師'] },
  { group: '海外職業-江湖', jobs: ['琳恩', '墨玄'] },
] as const;
export type JobGroup = (typeof JOB_GROUPS)[number]['group'];

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

/** 任務模板:跨角色共用的任務範本,套用到角色時會複製成 CharacterTask */
export interface TaskTemplate {
  id: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  order: number;
}

/** 角色底下的實際任務(勾選狀態、重置時間都是角色獨立的) */
export interface CharacterTask {
  id: string;
  characterId: string;
  templateId?: string;
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
