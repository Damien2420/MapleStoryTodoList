/** 授權用戶端對外的錯誤代碼，呼叫端依此決定顯示的狀態或訊息 */
export type AuthErrorCode =
  | 'signedOut'
  | 'reconnectRequired'
  | 'popupClosed'
  | 'popupBlocked'
  | 'missingDriveScope'
  | 'network'
  | 'server';

/** 授權相關錯誤；message 是可直接顯示給使用者的中文訊息 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** 目前登入的 Google 帳號；sub 是穩定不變的帳號 ID，用來判斷本機資料綁定的是不是同一個帳號 */
export interface AuthUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/** 分頁之間廣播的訊息：某個分頁換到新 token，或某個分頁已登出 */
export type AuthMessage = { type: 'token'; accessToken: string; expiresAt: number } | { type: 'signedOut' };

/** 分頁間的廣播頻道；正式環境是 BroadcastChannel（不會收到自己送出的訊息） */
export interface AuthChannel {
  post(message: AuthMessage): void;
  subscribe(listener: (message: AuthMessage) => void): void;
}

/** createAuthClient 的外部依賴，測試時全部替換成可控的假實作 */
export interface AuthClientDeps {
  fetch: typeof fetch;
  /** 開啟 Google 登入彈窗並回傳授權碼；使用者取消時丟出 AuthError */
  requestCode: () => Promise<string>;
  /** 跨分頁互斥鎖；正式環境是 navigator.locks.request */
  withLock: <T>(name: string, task: () => Promise<T>) => Promise<T>;
  channel: AuthChannel;
  now: () => number;
}

/** 授權用戶端：登入、取得 access token、取得帳號資料、登出 */
export interface AuthClient {
  /** 開啟 Google 登入彈窗，完成後回傳登入的帳號 */
  signIn(): Promise<AuthUser>;
  /** 取得有效的 access token；需要時自動向後端換新，多個分頁同時需要時只換一次 */
  getAccessToken(): Promise<string>;
  /** Drive API 回 401 時呼叫，讓這個 token 失效；只影響與參數相同的快取 token */
  invalidateAccessToken(token: string): void;
  /** 取得目前登入的帳號資料（同一個分頁只查一次） */
  getUser(): Promise<AuthUser>;
  /** 清除後端 cookie 並通知所有分頁；失敗時丟出錯誤並保留登入狀態 */
  signOut(): Promise<void>;
}

const TOKEN_LOCK = 'mstd-auth-token';
/** 剩餘效期低於這個值就提前換新，避免拿到即將過期的 token 去做較久的上傳 */
const REFRESH_MARGIN_MS = 60_000;
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenBody {
  accessToken: string;
  expiresIn: number;
}

interface ErrorBody {
  error?: string;
  message?: string;
}

/**
 * 建立授權用戶端。
 * access token 只存在記憶體；refresh token 由後端放在 HttpOnly cookie，這裡完全接觸不到。
 * 換 token 時先取得跨分頁鎖，拿到鎖後再檢查一次快取（等待期間其他分頁可能已經換好並廣播過來），
 * 確保多個分頁同時需要 token 時只呼叫一次後端。
 * @param deps 外部依賴
 * @returns AuthClient 實例
 */
export function createAuthClient(deps: AuthClientDeps): AuthClient {
  let cached: CachedToken | undefined;
  let user: AuthUser | undefined;
  let inflight: Promise<string> | undefined;

  const isFresh = (token: CachedToken | undefined): token is CachedToken =>
    token !== undefined && token.expiresAt - deps.now() > REFRESH_MARGIN_MS;

  const clearSession = () => {
    cached = undefined;
    user = undefined;
  };

  deps.channel.subscribe((message) => {
    if (message.type === 'signedOut') {
      clearSession();
      return;
    }
    if (!cached || message.expiresAt > cached.expiresAt) {
      cached = { accessToken: message.accessToken, expiresAt: message.expiresAt };
    }
  });

  async function postAuth(path: string, body?: unknown): Promise<Response> {
    try {
      return await deps.fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AuthError('network', '無法連線，請確認網路後再試');
    }
  }

  async function toAuthError(res: Response): Promise<AuthError> {
    const data = (await res.json().catch(() => ({}))) as ErrorBody;
    const message = data.message ?? 'Google 登入服務暫時無法使用，請稍後再試';
    if (data.error === 'NOT_SIGNED_IN') return new AuthError('signedOut', message);
    if (data.error === 'RECONNECT_REQUIRED') return new AuthError('reconnectRequired', message);
    if (data.error === 'MISSING_DRIVE_SCOPE') return new AuthError('missingDriveScope', message);
    return new AuthError('server', message);
  }

  function storeToken(body: TokenBody): string {
    const token = { accessToken: body.accessToken, expiresAt: deps.now() + body.expiresIn * 1000 };
    cached = token;
    deps.channel.post({ type: 'token', ...token });
    return token.accessToken;
  }

  function refreshToken(): Promise<string> {
    return deps.withLock(TOKEN_LOCK, async () => {
      // 等鎖期間其他分頁可能已經換好 token 並廣播過來
      const current = cached;
      if (isFresh(current)) return current.accessToken;
      const res = await postAuth('/api/auth/token');
      if (!res.ok) {
        const error = await toAuthError(res);
        if (error.code === 'signedOut' || error.code === 'reconnectRequired') clearSession();
        throw error;
      }
      return storeToken((await res.json()) as TokenBody);
    });
  }

  async function getAccessToken(): Promise<string> {
    const current = cached;
    if (isFresh(current)) return current.accessToken;
    inflight ??= refreshToken().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  async function getUser(): Promise<AuthUser> {
    if (user) return user;
    const token = await getAccessToken();
    let res: Response;
    try {
      res = await deps.fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new AuthError('network', '無法連線，請確認網路後再試');
    }
    if (!res.ok) throw new AuthError('server', '無法取得 Google 帳號資料，請稍後再試');
    const data = (await res.json()) as Partial<AuthUser>;
    if (!data.sub || !data.email) throw new AuthError('server', '無法取得 Google 帳號資料，請稍後再試');
    user = { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
    return user;
  }

  async function signIn(): Promise<AuthUser> {
    const code = await deps.requestCode();
    const res = await postAuth('/api/auth/exchange', { code });
    if (!res.ok) throw await toAuthError(res);
    user = undefined;
    storeToken((await res.json()) as TokenBody);
    return getUser();
  }

  async function signOut(): Promise<void> {
    const res = await postAuth('/api/auth/logout');
    if (!res.ok) throw await toAuthError(res);
    clearSession();
    deps.channel.post({ type: 'signedOut' });
  }

  function invalidateAccessToken(token: string): void {
    if (cached?.accessToken === token) cached = undefined;
  }

  return { signIn, getAccessToken, invalidateAccessToken, getUser, signOut };
}
