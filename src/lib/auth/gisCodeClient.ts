import { AuthError } from '@/lib/auth/authClient';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
/** drive.appdata 讀寫 App 專屬資料夾；openid email profile 用來取得帳號 ID、email 與大頭照 */
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';

interface CodeResponse {
  code?: string;
  error?: string;
}

interface CodeClientError {
  type: string;
}

interface CodeClient {
  requestCode(): void;
}

interface GisOAuth2 {
  initCodeClient(config: {
    client_id: string;
    scope: string;
    ux_mode: 'popup';
    select_account: boolean;
    callback: (response: CodeResponse) => void;
    error_callback: (error: CodeClientError) => void;
  }): CodeClient;
}

/** 不擴充全域 Window 型別：舊的 googleDrive.ts 已經宣告了另一種形狀的 window.google，兩者併存會型別衝突 */
function getOAuth2(): GisOAuth2 | undefined {
  return (window as unknown as { google?: { accounts?: { oauth2?: GisOAuth2 } } }).google?.accounts?.oauth2;
}

let scriptPromise: Promise<void> | undefined;

/** 動態載入 GIS 腳本，只在實際要登入時下載；載入失敗後允許下次重試 */
function loadGis(): Promise<void> {
  if (getOAuth2()) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new AuthError('network', 'Google 登入元件載入失敗，請確認網路連線後重試'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * 開啟 Google 登入彈窗（GIS code model、popup 模式），取得一次性的授權碼。
 * popup 模式下 GIS 以 postMessage 回傳授權碼，後端換 token 時的 redirect_uri 固定為 `postmessage`。
 * @returns 授權碼
 * @throws AuthError：彈窗被封鎖為 popupBlocked，使用者關閉或拒絕為 popupClosed，腳本載入失敗為 network
 */
export async function requestAuthCode(): Promise<string> {
  await loadGis();
  const oauth2 = getOAuth2();
  if (!oauth2) throw new AuthError('network', 'Google 登入元件載入失敗，請確認網路連線後重試');
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initCodeClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPE,
      ux_mode: 'popup',
      select_account: true,
      callback: (response) => {
        if (response.code) resolve(response.code);
        else reject(new AuthError('popupClosed', 'Google 授權失敗或已取消'));
      },
      error_callback: (error) => {
        reject(
          error.type === 'popup_failed_to_open'
            ? new AuthError('popupBlocked', '無法開啟 Google 登入視窗，請確認瀏覽器未封鎖彈出視窗後再試一次')
            : new AuthError('popupClosed', '登入視窗已關閉，登入失敗'),
        );
      },
    });
    client.requestCode();
  });
}
