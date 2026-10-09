import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthDeps, AuthRequest, AuthResponse } from './authHandlers.js';

/** Vercel 部署時的獨立型別檢查環境未必能解析到 @types/node，故在此自行宣告，與 nexon-character.ts 相同 */
declare const process: { env: Record<string, string | undefined> };

/** 把 VercelRequest 轉成與框架無關的 AuthRequest（Vercel 已依 Content-Type 解析好 JSON body） */
export function toAuthRequest(req: VercelRequest): AuthRequest {
  return { method: req.method, headers: req.headers, body: req.body };
}

/** 從環境變數組出處理函式的依賴；client id 與前端共用 VITE_GOOGLE_CLIENT_ID */
export function authDepsFromEnv(): AuthDeps {
  return {
    fetch,
    env: {
      clientId: process.env.VITE_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      encryptionKeys: process.env.TOKEN_ENC_KEY,
    },
  };
}

/** 把處理結果寫回 VercelResponse；token 回應一律禁止快取 */
export function sendAuthResponse(res: VercelResponse, result: AuthResponse): void {
  res.setHeader('Cache-Control', 'no-store');
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  if (result.body === undefined) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.body);
}
