import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleLogout } from '../_lib/authHandlers.js';
import { sendAuthResponse, toAuthRequest } from '../_lib/vercelAdapter.js';

/** POST /api/auth/logout：清除 refresh token cookie，不撤銷 Google 授權 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  sendAuthResponse(res, handleLogout(toAuthRequest(req)));
}
