import { SERVERS, type Server } from '@/lib/servers';

export interface NexonCharacterInfo {
  name: string;
  level: number;
  job: string;
  world: string;
  imageUrl?: string;
}

interface NexonErrorBody {
  error: string;
  message: string;
}

/** 查詢角色失敗時丟出的錯誤,保留 API 回傳的 error 代碼(例如 CHARACTER_NOT_FOUND),讓呼叫端可以依代碼分流處理 */
export class NexonApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** 呼叫自家 /api/nexon-character proxy 查詢角色資料,非 200 時丟出可直接顯示給使用者看的中文錯誤訊息 */
export async function fetchCharacterByName(name: string): Promise<NexonCharacterInfo> {
  const res = await fetch(`/api/nexon-character?name=${encodeURIComponent(name)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as NexonErrorBody | undefined;
    throw new NexonApiError(body?.error ?? 'UNKNOWN_ERROR', body?.message ?? '查詢角色時發生未預期的錯誤');
  }
  return (await res.json()) as NexonCharacterInfo;
}

/**
 * NEXON TMS 回傳的 world_name，跟 SERVERS 是同一份資料，
 * 這裡只做型別窄化(Character.server 型別是 literal union)。
 */
export function isKnownServer(world: string): world is Server {
  return (SERVERS as readonly string[]).includes(world);
}
