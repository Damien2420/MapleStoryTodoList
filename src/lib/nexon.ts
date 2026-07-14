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

/** 呼叫自家 /api/nexon-character proxy 查詢角色資料,非 200 時丟出可直接顯示給使用者看的中文錯誤訊息 */
export async function fetchCharacterByName(name: string): Promise<NexonCharacterInfo> {
  const res = await fetch(`/api/nexon-character?name=${encodeURIComponent(name)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as NexonErrorBody | undefined;
    throw new Error(body?.message ?? '查詢角色時發生未預期的錯誤');
  }
  return (await res.json()) as NexonCharacterInfo;
}

/**
 * NEXON TMS 回傳的 world_name 本來就是台服官方繁中伺服器名稱,跟 SERVERS 是同一份資料,
 * 這裡只做型別窄化(Character.server 型別是 literal union),不是翻譯對照表。
 */
export function isKnownServer(world: string): world is Server {
  return (SERVERS as readonly string[]).includes(world);
}
