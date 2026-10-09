import type { Server } from '@/lib/servers';

/** 任務重置週期:每日 / 每週 / 每月 / 雙週週末活動(週五~週日開放) / 單次(不自動重置) / 賽季(不自動重置,顯示為獨立賽季分類) */
export type ResetCycle = 'daily' | 'weekly' | 'monthly' | 'biweekly-weekend' | 'once' | 'season';

/** 角色名稱最大長度 */
export const CHARACTER_NAME_MAX_LENGTH = 20;
/** 帳號名稱最大長度 */
export const ACCOUNT_NAME_MAX_LENGTH = 20;
/** 任務名稱最大長度 */
export const TASK_NAME_MAX_LENGTH = 20;
/** 任務分類名稱最大長度 */
export const TASK_CATEGORY_MAX_LENGTH = 10;

/** 角色資料建立來源:api = 透過 NEXON API 查詢帶入,manual = 使用者手動輸入;決定「更新角色」按鈕的行為 */
export type CharacterSource = 'api' | 'manual';

/** 遊戲角色 */
export interface Character {
  id: string;
  /** 還原時因舊 id 已被刪除而換了新 id,記下最原始的 id;之後再還原同一份資料時用來對回這筆 */
  restoredFrom?: string;
  name: string;
  server: Server;
  level: number;
  job: string;
  /** 角色外觀圖網址(NEXON Open API 查詢角色時取得的公開靜態圖片連結),手動建立的角色不會有這個欄位 */
  imageUrl?: string;
  order: number;
  source: CharacterSource;
  /** 所屬帳號 id,null 代表尚未歸類到任何帳號(未歸類) */
  accountId: string | null;
  /** 角色資料(名稱、伺服器、等級、職業、外觀圖、來源)最後修改時間,同步合併時較新者勝 */
  updatedAt: string;
  /** 角色位置(所屬帳號、排序)最後修改時間;與 updatedAt 分開,讓「A 裝置改等級、B 裝置搬帳號」兩邊的修改都能保留 */
  placementUpdatedAt: string;
}

/** 使用者自訂的角色分組,對應現實中的一個 MapleStory 帳號(一個帳號底下可以有多個角色) */
export interface Account {
  id: string;
  /** 還原時因舊 id 已被刪除而換了新 id,記下最原始的 id;之後再還原同一份資料時用來對回這筆 */
  restoredFrom?: string;
  name: string;
  order: number;
  /** VIP會員等級,未設定代表這個帳號沒有VIP資格;VIP資格屬於整個帳號,而非個別角色 */
  vipTier?: VipTier;
  /** 最後修改時間,同步合併時較新者勝 */
  updatedAt: string;
}

/** 角色底下的實際任務(勾選狀態、重置時間都是角色獨立的) */
export interface CharacterTask {
  id: string;
  /** 還原時因舊 id 已被刪除而換了新 id,記下最原始的 id;之後再還原同一份資料時用來對回這筆 */
  restoredFrom?: string;
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
  /** 使用者最後修改時間(勾選、改名、排序等),同步合併時較新者勝;自動重置不算修改 */
  updatedAt: string;
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

/** BOSS 難度 */
export type BossDifficulty = '簡單' | '普通' | '困難' | '渾沌' | '極限' | '終極';

/** VIP 會員等級,未設定代表沒有VIP資格 */
export type VipTier = 'silver' | 'gold' | 'diamond' | 'royal' | 'royalBlack';

/** VIP重置券等級:下/中/上/終極為每週重置,每月為每月重置 */
export type VipTicketLevel = '下' | '中' | '上' | '終極' | '每月';

/** 角色底下實際追蹤的 BOSS 討伐記錄,獨立於任務系統之外 */
export interface CharacterBossTrackList {
  id: string;
  /** 還原時因舊 id 已被刪除而換了新 id,記下最原始的 id;之後再還原同一份資料時用來對回這筆 */
  restoredFrom?: string;
  characterId: string;
  bossName: string;
  difficulty: BossDifficulty;
  resetCycle: 'daily' | 'weekly' | 'monthly';
  /** 週王的重置星期幾(0=日~6=六),未設定則沿用全域設定 */
  weeklyResetDay?: number;
  /** 顯示分類:賽季王/VIP重置王會歸類到獨立區塊,但實際重置週期仍依 resetCycle 判斷 */
  category?: 'season' | 'vip';
  /** 建立當下對應的目錄 id,用來之後查目錄判斷是否已下架;上線前建立的舊紀錄可能沒有此欄位 */
  bossCatalogId?: string;
  /** 用哪個VIP重置券等級加入的,只有 category === 'vip' 才會有值 */
  vipTicketLevel?: VipTicketLevel;
  /** 預估收益,套用時帶入參考值,使用者可事後手動覆寫 */
  crystalValue: number;
  /** 本次攻略的實際人數,用於平分結晶收益;預設 1(單人) */
  partySize: number;
  checked: boolean;
  lastResetAt: string;
  /** 使用者最後修改時間(勾選、攻略人數等),同步合併時較新者勝;自動重置不算修改 */
  updatedAt: string;
}
