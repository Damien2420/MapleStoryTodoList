import type { VercelRequest, VercelResponse } from '@vercel/node';

const NEXON_BASE_URL = 'https://open.api.nexon.com/maplestorytw/v1';

interface NexonIdResponse {
  ocid?: string;
}

interface NexonCharacterBasicResponse {
  character_name?: string;
  character_level?: number;
  character_class?: string;
  world_name?: string;
  character_image?: string;
}

interface ErrorBody {
  error: string;
  message: string;
}

function errorBody(error: string, message: string): ErrorBody {
  return { error, message };
}

/** 幫角色外觀圖網址加上指定尺寸,網址本身格式不明確時原樣回傳,不讓圖片尺寸問題擋住整個查詢結果 */
function withImageSize(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    url.searchParams.set('width', '170');
    url.searchParams.set('height', '170');
    return url.toString();
  } catch {
    return imageUrl;
  }
}

/** 把上游(NEXON)非預期回應的狀態碼與 body 一併記錄,方便事後從 log 判斷實際錯誤原因 */
async function logUpstreamError(context: string, res: Response): Promise<void> {
  const body = await res.text();
  console.error(`[nexon-character] ${context}, status ${res.status}: ${body}`);
}

type UpstreamOutcome = { ok: true } | { ok: false; status: number; error: string; message: string };

/**
 * 統一分類 NEXON 回應的非預期狀態碼,id 查詢與 basic 查詢共用同一套判斷,避免兩處各寫一份規則、
 * 在某個上游狀態碼上出現不一致。429 直接轉發給前端;401/403 視為我方金鑰設定異常;
 * 其餘非 2xx 一律視為上游異常並記錄 body。
 */
async function classifyUpstreamStatus(res: Response, context: string): Promise<UpstreamOutcome> {
  if (res.ok) return { ok: true };

  if (res.status === 429) {
    return { ok: false, status: 429, error: 'RATE_LIMITED', message: '查詢過於頻繁，請稍後再試' };
  }
  if (res.status === 401 || res.status === 403) {
    await logUpstreamError(`${context}: NEXON rejected API key`, res);
    return { ok: false, status: 500, error: 'SERVER_ERROR', message: '查詢服務暫時無法使用，請改用手動輸入' };
  }
  await logUpstreamError(`${context}: unexpected status`, res);
  return { ok: false, status: 502, error: 'UPSTREAM_ERROR', message: '無法連線至查詢服務，請稍後再試' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json(errorBody('METHOD_NOT_ALLOWED', '不支援的請求方法'));
    return;
  }

  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (!name) {
    res.status(400).json(errorBody('INVALID_NAME', '請輸入角色名稱'));
    return;
  }

  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) {
    console.error('[nexon-character] NEXON_API_KEY is not configured');
    res.status(500).json(errorBody('SERVER_ERROR', '查詢服務暫時無法使用，請改用手動輸入'));
    return;
  }

  try {
    const idRes = await fetch(`${NEXON_BASE_URL}/id?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-nxopen-api-key': apiKey },
    });

    // id 查詢的 400/404 是唯一需要特殊解讀成「查無此角色」的情況,其餘狀態碼交給共用分類邏輯
    if (idRes.status === 400 || idRes.status === 404) {
      res.status(404).json(errorBody('CHARACTER_NOT_FOUND', '查無此角色，請確認名稱是否正確'));
      return;
    }
    const idOutcome = await classifyUpstreamStatus(idRes, 'id lookup');
    if (!idOutcome.ok) {
      res.status(idOutcome.status).json(errorBody(idOutcome.error, idOutcome.message));
      return;
    }

    const idData = (await idRes.json()) as NexonIdResponse;
    if (!idData.ocid) {
      res.status(404).json(errorBody('CHARACTER_NOT_FOUND', '查無此角色，請確認名稱是否正確'));
      return;
    }

    const basicRes = await fetch(`${NEXON_BASE_URL}/character/basic?ocid=${encodeURIComponent(idData.ocid)}`, {
      headers: { 'x-nxopen-api-key': apiKey },
    });

    const basicOutcome = await classifyUpstreamStatus(basicRes, 'character/basic lookup');
    if (!basicOutcome.ok) {
      res.status(basicOutcome.status).json(errorBody(basicOutcome.error, basicOutcome.message));
      return;
    }

    const basicData = (await basicRes.json()) as NexonCharacterBasicResponse;
    if (
      !basicData.character_name ||
      !basicData.world_name ||
      !basicData.character_class ||
      basicData.character_level == null
    ) {
      console.error('[nexon-character] unexpected character/basic response shape', basicData);
      res.status(502).json(errorBody('UPSTREAM_ERROR', '無法連線至查詢服務，請稍後再試'));
      return;
    }

    res.status(200).json({
      name: basicData.character_name,
      level: basicData.character_level,
      job: basicData.character_class,
      world: basicData.world_name,
      imageUrl: basicData.character_image ? withImageSize(basicData.character_image) : undefined,
    });
  } catch (err) {
    console.error('[nexon-character] request failed', err);
    res.status(502).json(errorBody('UPSTREAM_ERROR', '無法連線至查詢服務，請稍後再試'));
  }
}
