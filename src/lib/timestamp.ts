/**
 * 同步合併用的「最後修改時間」工具。
 * 帳號、角色、任務、BOSS 的 updatedAt 只在使用者操作真的改變資料時才更新,
 * 合併備份時兩邊都有同一筆資料,就比較 updatedAt 決定採用哪一邊(較新者勝)。
 */

/** 沒有修改紀錄的舊資料(升級前就存在、或舊版備份)一律視為最舊,平手時保留本機,行為與升級前一致 */
export const LEGACY_TIMESTAMP = '1970-01-01T00:00:00.000Z';

/**
 * 把 ISO 時間字串轉成毫秒數;缺值或格式錯誤一律當成最舊(0),不丟錯。
 * 一律用數值比較,不用字串比較,避免時區寫法(例如 +08:00)或少了毫秒時比錯。
 */
export function toMillis(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 產生一筆資料新的修改時間:取「現在」與「這筆資料原本的時間 + 1 毫秒」兩者中較大的。
 * 保證修改後的時間一定晚於修改前看到的版本,即使另一台裝置的時鐘比較快、帶來了「未來」的時間,
 * 或本機時鐘被校正回去,在看過某個版本之後做的修改仍然會贏過那個版本。
 * @param previous 這筆資料目前的修改時間;新資料不傳
 * @param now 現在時間,預設為當下;測試用
 * @returns 新的 ISO 時間字串
 */
export function nextTimestamp(previous?: string, now: Date = new Date()): string {
  return new Date(Math.max(now.getTime(), toMillis(previous) + 1)).toISOString();
}
