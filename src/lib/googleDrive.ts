const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const SCOPE = `${DRIVE_SCOPE} ${EMAIL_SCOPE}`;
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const UPLOAD_BOUNDARY = 'maplestory-todolist-backup-boundary';

interface TokenResponse {
  access_token?: string;
  /** 使用者實際同意的 scope,空白分隔;使用者若取消勾選某個 scope,這裡就不會包含它 */
  scope?: string;
  error?: string;
}

interface TokenClient {
  callback: (resp: TokenResponse) => void;
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | undefined;
let tokenClient: TokenClient | undefined;
let accessToken: string | undefined;
let signedInEmail: string | undefined;

/** 動態載入 GIS 腳本,只有實際要用到 Google 登入時才下載,且只載入一次 */
function loadGisScript(): Promise<void> {
  if (!gisScriptPromise) {
    gisScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google 登入元件載入失敗,請確認網路連線後重試'));
      document.head.appendChild(script);
    });
  }
  return gisScriptPromise;
}

async function getTokenClient(): Promise<TokenClient> {
  await loadGisScript();
  if (!tokenClient) {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => {},
    });
  }
  return tokenClient;
}

export function isSignedIn(): boolean {
  return accessToken !== undefined;
}

/** 目前登入的 Google 帳號 email,尚未登入或查詢失敗時回傳 undefined */
export function getSignedInEmail(): string | undefined {
  return signedInEmail;
}

/** 觸發 Google 登入彈窗,取得 access token(生命週期約 1 小時,過期後需再次呼叫此函式) */
export async function requestAccessToken(): Promise<void> {
  const client = await getTokenClient();
  await new Promise<void>((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error('Google 授權失敗或已取消'));
        return;
      }
      if (!resp.scope?.includes(DRIVE_SCOPE)) {
        reject(new Error('尚未取得 Google Drive 存取權限，請重新登入並在同意畫面中勾選 Google Drive 才能使用備份功能'));
        return;
      }
      accessToken = resp.access_token;
      resolve();
    };
    client.requestAccessToken();
  });

  try {
    const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = (await res.json()) as { email?: string };
    signedInEmail = data.email;
  } catch {
    signedInEmail = undefined;
  }
}

/**
 * 只清除本機的登入狀態,不撤銷 Google 端的授權紀錄。
 */
export function signOut(): void {
  accessToken = undefined;
  signedInEmail = undefined;
}

function requireAccessToken(): string {
  if (!accessToken) throw new Error('尚未登入 Google');
  return accessToken;
}

async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = requireAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Google Drive API 呼叫失敗(狀態碼 ${res.status})`);
  }
  return res;
}

/** 在 appDataFolder 裡依檔名查詢 fileId,查無回傳 undefined */
export async function findFileId(name: string): Promise<string | undefined> {
  const query = encodeURIComponent(`name='${name}'`);
  const res = await driveFetch(`${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=files(id)`);
  const data = (await res.json()) as { files: { id: string }[] };
  return data.files[0]?.id;
}

/** 下載指定 fileId 的檔案內容(純文字) */
export async function downloadFile(fileId: string): Promise<string> {
  const res = await driveFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`);
  return res.text();
}

/** 把內容寫入 appDataFolder 底下的指定檔名:查到既有 fileId 就更新,查不到就新增 */
export async function uploadFile(name: string, content: string): Promise<void> {
  const existingId = await findFileId(name);
  const metadata = existingId ? {} : { name, parents: ['appDataFolder'] };
  const body =
    `--${UPLOAD_BOUNDARY}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${UPLOAD_BOUNDARY}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${UPLOAD_BOUNDARY}--`;

  const url = existingId
    ? `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  await driveFetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${UPLOAD_BOUNDARY}` },
    body,
  });
}
