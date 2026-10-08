import { authClient } from '@/lib/auth/browserAuthClient';
import { startSync, stopSync, syncActionDeps, syncEngine, syncState } from '@/lib/sync/browserSync';
import * as deleteActions from '@/lib/sync/deleteActions';
import * as restoreActions from '@/lib/sync/restoreActions';
import * as signInActions from '@/lib/sync/signInActions';

// 開發模式專用：在主控台手動驗證登入（window.__mstdAuth）與同步（window.__mstdSync）。
// 正式的登入介面完成後，移除這個檔案與 main.tsx 裡的載入。
const devWindow = window as unknown as { __mstdAuth?: unknown; __mstdSync?: unknown };
devWindow.__mstdAuth = authClient;
devWindow.__mstdSync = {
  engine: syncEngine,
  state: syncState,
  start: () =>
    startSync({
      onStatus: (status) => console.info('[sync] status', status),
      onApplied: (result) => console.info('[sync] applied', result),
    }),
  stop: stopSync,
  /** 例：await __mstdSync.actions.inspectSignIn(__mstdSync.actions.deps) */
  actions: { deps: syncActionDeps, ...signInActions, ...restoreActions, ...deleteActions },
};
