import type { Tombstone } from '@/lib/tombstone';
import type { BossDifficulty } from '@/types';

/** 四把武器的種類 */
export type WeaponKind = 'soul' | 'genesis' | 'destiny' | 'astra';

/** 所有武器的固定順序(Tab、入口都依這個順序) */
export const WEAPON_KINDS: readonly WeaponKind[] = ['soul', 'genesis', 'destiny', 'astra'];

/**
 * 內部儲存素材量的單位:1 = 1/60 個素材(1~6 人的最小公倍數),組隊平分後的小數不會有誤差;
 * 畫面一律除以 UNIT 後無條件捨去
 */
export const UNIT = 60;

/** BOSS 擊破紀錄:id = `${characterId}:${bossCatalogId}:${'v'|'n'}:${cycleKey}` */
export interface BossClear {
  id: string;
  characterId: string;
  bossCatalogId: string;
  difficulty: BossDifficulty;
  partySize: number;
  isVip: boolean;
  /** 週期進行中跟著角色目前的設定;週期結束後固定,不再改變 */
  genesisPass: boolean;
  stormTraining: boolean;
  /** 第一次勾選的時間,寫入後不再改 */
  firstClearedAt: string;
  /** 這個週期的結束時間(下一次重置),用來判斷是否還能改動 */
  cycleEnd: string;
  active: boolean;
  updatedAt: string;
}

/** 每日紀錄:id = `${characterId}:d:${dayKey}` */
export interface DailyClear {
  id: string;
  characterId: string;
  /** 當天的開始時間(每日重置時間點) */
  day: string;
  /** 當天第一次勾選地區任務的時間,寫入後不再改;fold 以這個時間排序 */
  firstClearedAt: string;
  /** 當天完成的最高地區取得量;0 代表當天沒做 */
  topRegionShards: number;
  updatedAt: string;
}

/**
 * 初始設定 / 校正時使用者填的狀態(素材量為遊戲內的整數)。
 * includeClearIds:校正前已勾選、使用者選擇「填的值還沒包含」的擊破紀錄,校正後會再加上它們的素材
 * (靈魂一週只算一隻,只會帶本週給最多的那一筆)。
 * 靈魂的 autoLevel:碎片足夠時是否自動升級;沒帶時沿用目前的設定
 */
export type AdjustPayload =
  | { weapon: 'genesis'; stage: number; pool: number; includeClearIds?: string[] }
  | { weapon: 'soul'; level: number; gatePassed: boolean; pool: number; soloCleared: string[]; includeClearIds?: string[]; autoLevel?: boolean }
  | { weapon: 'destiny'; stage: number; pool: number; includeClearIds?: string[] }
  | { weapon: 'astra'; stage: number; trace: number; shard: number; includeClearIds?: string[] };

/** 升階事件附帶的資料:靈魂記錄單人擊破的是哪一隻 */
export interface UpgradePayload {
  fromStage: number;
  soulQuestKey?: string;
}

/** 靈魂自動升級開關事件附帶的資料:開啟時會立即用持有的碎片升級 */
export interface SoulAutoLevelPayload {
  enabled: boolean;
}

/** 靈魂手動升級事件附帶的資料:要升到的等級(碎片不夠或遇到升階關卡時停在能升到的等級) */
export interface SoulLevelUpPayload {
  toLevel: number;
}

/** 武器事件:升階 id = `${characterId}:${weapon}:up:${phase}:${fromStage}`,其他 = `${characterId}:${weapon}:${kind}:${uuid}` */
export interface WeaponEvent {
  id: string;
  characterId: string;
  weapon: WeaponKind;
  kind: 'adjust' | 'upgrade' | 'complete' | 'destinyPhase2' | 'soulAutoLevel' | 'soulLevelUp';
  payload?: AdjustPayload | UpgradePayload | SoulAutoLevelPayload | SoulLevelUpPayload;
  at: string;
  updatedAt: string;
}

/** 每角色的武器設定:創世通行證與暴風修練 */
export interface WeaponProfile {
  id: string;
  genesisPass: boolean;
  stormTraining: boolean;
  updatedAt: string;
}

/** 武器的狀態:unset 未設定、active 進行中、done 已完成;命運多一個 phase1done(第一階段完成、尚未開始第二階段) */
export type WeaponStatus = 'unset' | 'active' | 'done' | 'phase1done';

export interface GenesisState {
  status: WeaponStatus;
  /** 目前階段 1~8 */
  stage: number;
  /** 持有的黑暗痕跡(1/60 單位) */
  pool: number;
}

export interface SoulState {
  status: WeaponStatus;
  /** 目前等級 1~100 */
  level: number;
  /** 停在 Lv.10、20…90 時是否已完成升階任務 */
  gatePassed: boolean;
  /** 持有的靈魂碎片(1/60 單位) */
  pool: number;
  /** 曾經單人擊破的 BOSS,格式 `${bossCatalogId}|${difficulty}` */
  soloCleared: string[];
  /** 碎片足夠時是否自動升級;沒有這個欄位(舊資料)視為開啟 */
  autoLevel?: boolean;
}

export interface DestinyState {
  status: WeaponStatus;
  /** 目前階段 1~6(4~6 為第二階段) */
  stage: number;
  /** 持有的敵對者的決心(1/60 單位) */
  pool: number;
}

export interface AstraState {
  status: WeaponStatus;
  /** 目前階段 1~3 */
  stage: number;
  /** 持有的激戰的痕跡(1/60 單位) */
  trace: number;
  /** 持有的艾里溫碎片(1/60 單位) */
  shard: number;
}

/** 一個角色四把武器的完整狀態 */
export interface CharacterWeaponState {
  soul: SoulState;
  genesis: GenesisState;
  destiny: DestinyState;
  astra: AstraState;
}

/** 存檔點:每角色一筆,id = characterId */
export interface WeaponCheckpoint {
  id: string;
  /** 已折入的紀錄截止時間:時間早於這個點的紀錄與事件都已經包含在 state 裡 */
  watermark: string;
  state: CharacterWeaponState;
  /** 留給之後的數值表版本化 */
  rulesVersion: number;
  updatedAt: string;
}

/** 目前的數值表版本 */
export const RULES_VERSION = 1;

/** 還沒有任何設定時的初始狀態 */
export function emptyWeaponState(): CharacterWeaponState {
  return {
    soul: { status: 'unset', level: 1, gatePassed: false, pool: 0, soloCleared: [] },
    genesis: { status: 'unset', stage: 1, pool: 0 },
    destiny: { status: 'unset', stage: 1, pool: 0 },
    astra: { status: 'unset', stage: 1, trace: 0, shard: 0 },
  };
}

/** 靈魂已單人擊破清單的 key */
export function soloKey(bossCatalogId: string, difficulty: BossDifficulty): string {
  return `${bossCatalogId}|${difficulty}`;
}

/** 武器墓碑的種類：設定與存檔點的 id 都是 characterId，墓碑 id 加上種類前綴避免衝突 */
export type WeaponRecordKind = 'profile' | 'bossClear' | 'dailyClear' | 'event' | 'checkpoint';

/**
 * 武器墓碑的 id。
 * @param kind 紀錄種類
 * @param id 紀錄 id
 * @returns `${kind}:${id}`
 */
export function weaponTombstoneId(kind: WeaponRecordKind, id: string): string {
  return `${kind}:${id}`;
}

/** 快照裡的武器進度：武器 store 的五類資料加上武器墓碑 */
export interface WeaponSnapshot {
  profiles: WeaponProfile[];
  bossClears: BossClear[];
  dailyClears: DailyClear[];
  events: WeaponEvent[];
  checkpoints: WeaponCheckpoint[];
  /** id = weaponTombstoneId(kind, 紀錄 id)；只由還原產生 */
  tombstones: Tombstone[];
}

/** 沒有任何武器資料的快照 */
export function emptyWeaponSnapshot(): WeaponSnapshot {
  return { profiles: [], bossClears: [], dailyClears: [], events: [], checkpoints: [], tombstones: [] };
}
