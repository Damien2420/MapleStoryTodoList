import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleToken } from '../_lib/authHandlers.js';
import { authDepsFromEnv, sendAuthResponse, toAuthRequest } from '../_lib/vercelAdapter.js';

/** POST /api/auth/token：用 cookie 裡的 refresh token 換新的 access token */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  sendAuthResponse(res, await handleToken(toAuthRequest(req), authDepsFromEnv()));
}
