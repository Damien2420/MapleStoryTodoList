import { createAuthClient, type AuthChannel, type AuthMessage } from '@/lib/auth/authClient';
import { requestAuthCode } from '@/lib/auth/gisCodeClient';

const CHANNEL_NAME = 'mstd-auth';

/** 用 BroadcastChannel 實作分頁間廣播；瀏覽器不支援時退化成不廣播（各分頁各自換 token，功能仍正常） */
function createBroadcastChannel(): AuthChannel {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, subscribe: () => {} };
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (message) => channel.postMessage(message),
    subscribe: (listener) => {
      channel.addEventListener('message', (event: MessageEvent<AuthMessage>) => listener(event.data));
    },
  };
}

/**
 * 用 Web Locks 實作跨分頁互斥；瀏覽器不支援時直接執行（最壞情況是多換一次 token）。
 * 鎖的 callback 回傳 task 完成的 Promise，鎖會一直持有到 task 結束；結果另外用外層 Promise 傳回，避開 locks.request 的泛型推導。
 */
function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if (!('locks' in navigator)) return task();
  return new Promise<T>((resolve, reject) => {
    navigator.locks.request(name, () => task().then(resolve, reject)).catch(reject);
  });
}

/** 正式環境使用的授權用戶端（整個 App 共用一個實例） */
export const authClient = createAuthClient({
  fetch: (input, init) => window.fetch(input, init),
  requestCode: requestAuthCode,
  withLock,
  channel: createBroadcastChannel(),
  now: () => Date.now(),
});
