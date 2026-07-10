import type { Character, CharacterBossTrackList, CharacterTask } from '@/types';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';

/** 目前 app 支援的最新備份格式版本 */
export const CURRENT_VERSION = 1;

export interface DriveBackupPayload {
  /** 備份格式版本,供未來相容性判斷用 */
  version: 1;
  /** 備份建立時間(ISO 字串) */
  createdAt: string;
  characters: Character[];
  tasks: CharacterTask[];
  bosses: CharacterBossTrackList[];
}

/** 每次 version 破壞性升版時,才新增一個對應的 migrate 函式,例如: 1: (old) => migrateV1ToV2(old as DriveBackupPayloadV1) */
const MIGRATIONS: Record<number, (old: unknown) => DriveBackupPayload> = {};

/** 把任意版本的備份內容升級到 CURRENT_VERSION;版本較新、或缺少對應 migration 時中止並丟出錯誤 */
export function migrateToLatest(payload: { version: number }): DriveBackupPayload {
  if (payload.version > CURRENT_VERSION) {
    throw new Error('此備份由較新版本的 app 建立,請更新 app 後再還原');
  }
  let current: { version: number } = payload;
  while (current.version < CURRENT_VERSION) {
    const migrate = MIGRATIONS[current.version];
    if (!migrate) {
      throw new Error(`不支援從版本 ${current.version} 升級,請更新 app 或改用該版本的 app 還原`);
    }
    current = migrate(current);
  }
  return current as DriveBackupPayload;
}

export function buildBackupPayload(
  characters: Character[],
  tasks: CharacterTask[],
  bosses: CharacterBossTrackList[],
): DriveBackupPayload {
  return {
    version: CURRENT_VERSION,
    createdAt: new Date().toISOString(),
    characters,
    tasks,
    bosses,
  };
}

/** 把備份 JSON 字串解析並升級到 CURRENT_VERSION,Google Drive 還原與本機檔案匯入共用同一份邏輯 */
export function parseBackupPayload(content: string): DriveBackupPayload {
  return migrateToLatest(JSON.parse(content) as { version: number });
}

/** 讀取目前三個 store 的資料組成備份 JSON 字串,Google Drive 備份與本機檔案下載共用同一份內容 */
export function buildCurrentBackupPayloadJson(): string {
  const { characters } = useCharacterStore.getState();
  const { tasks } = useTaskStore.getState();
  const { bosses } = useBossStore.getState();
  return JSON.stringify(buildBackupPayload(characters, tasks, bosses), null, 2);
}
