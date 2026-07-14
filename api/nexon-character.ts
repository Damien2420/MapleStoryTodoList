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

/** NEXON 資料為每日快照,只能查前一天(含以前)的資料,以台北時區為準計算「前一天」 */
function yesterdayInTaipei(): string {
  const taipeiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  taipeiNow.setDate(taipeiNow.getDate() - 1);
  const yyyy = taipeiNow.getFullYear();
  const mm = String(taipeiNow.getMonth() + 1).padStart(2, '0');
  const dd = String(taipeiNow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

    if (idRes.status === 400 || idRes.status === 404) {
      res.status(404).json(errorBody('CHARACTER_NOT_FOUND', '查無此角色，請確認名稱是否正確'));
      return;
    }
    if (idRes.status === 429) {
      res.status(429).json(errorBody('RATE_LIMITED', '查詢過於頻繁，請稍後再試'));
      return;
    }
    if (idRes.status === 401 || idRes.status === 403) {
      console.error(`[nexon-character] NEXON rejected API key on id lookup, status ${idRes.status}`);
      res.status(500).json(errorBody('SERVER_ERROR', '查詢服務暫時無法使用，請改用手動輸入'));
      return;
    }
    if (!idRes.ok) {
      console.error(`[nexon-character] unexpected id lookup status ${idRes.status}`);
      res.status(502).json(errorBody('UPSTREAM_ERROR', '無法連線至查詢服務，請稍後再試'));
      return;
    }

    const idData = (await idRes.json()) as NexonIdResponse;
    if (!idData.ocid) {
      res.status(404).json(errorBody('CHARACTER_NOT_FOUND', '查無此角色，請確認名稱是否正確'));
      return;
    }

    const basicRes = await fetch(
      `${NEXON_BASE_URL}/character/basic?ocid=${encodeURIComponent(idData.ocid)}&date=${yesterdayInTaipei()}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    );

    if (basicRes.status === 429) {
      res.status(429).json(errorBody('RATE_LIMITED', '查詢過於頻繁，請稍後再試'));
      return;
    }
    if (basicRes.status === 401 || basicRes.status === 403) {
      console.error(`[nexon-character] NEXON rejected API key on basic lookup, status ${basicRes.status}`);
      res.status(500).json(errorBody('SERVER_ERROR', '查詢服務暫時無法使用，請改用手動輸入'));
      return;
    }
    if (!basicRes.ok) {
      console.error(`[nexon-character] unexpected character/basic status ${basicRes.status}`);
      res.status(502).json(errorBody('UPSTREAM_ERROR', '無法連線至查詢服務，請稍後再試'));
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
