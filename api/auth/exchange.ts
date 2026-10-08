import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleExchange } from '../_lib/authHandlers.js';
import { authDepsFromEnv, sendAuthResponse, toAuthRequest } from '../_lib/vercelAdapter.js';

/** POST /api/auth/exchange：授權碼換 token，refresh token 加密存進 cookie */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  sendAuthResponse(res, await handleExchange(toAuthRequest(req), authDepsFromEnv()));
}
