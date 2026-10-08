import { createAuthClient, type AuthChannel, type AuthMessage } from '@/lib/auth/authClient';
import { requestAuthCode } from '@/lib/auth/gisCodeClient';
import { withWebLock } from '@/lib/webLocks';

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

/** 正式環境使用的授權用戶端（整個 App 共用一個實例） */
export const authClient = createAuthClient({
  fetch: (input, init) => window.fetch(input, init),
  requestCode: requestAuthCode,
  withLock: withWebLock,
  channel: createBroadcastChannel(),
  now: () => Date.now(),
});
