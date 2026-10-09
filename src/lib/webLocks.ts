/**
 * 用 Web Locks 實作跨分頁互斥；瀏覽器不支援時直接執行。
 * 鎖的 callback 回傳 task 完成的 Promise，鎖會一直持有到 task 結束；結果另外用外層 Promise 傳回，避開 locks.request 的泛型推導。
 * @param name 鎖名稱，同名的鎖在同一個來源的所有分頁之間互斥
 * @param task 取得鎖之後執行的工作
 * @returns task 的結果
 */
export function withWebLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if (!('locks' in navigator)) return task();
  return new Promise<T>((resolve, reject) => {
    navigator.locks.request(name, () => task().then(resolve, reject)).catch(reject);
  });
}
