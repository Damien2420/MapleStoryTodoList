import { authClient } from '@/lib/auth/browserAuthClient';

// 開發模式專用：在主控台用 window.__mstdAuth 手動驗證登入、換 token、登出。
// 正式的登入介面完成後，移除這個檔案與 main.tsx 裡的載入。
(window as unknown as { __mstdAuth?: typeof authClient }).__mstdAuth = authClient;
