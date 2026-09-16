import type { BossDifficulty, Character, CharacterBossTrackList, CharacterSource, CharacterTask, ResetCycle } from '@/types';
import type { Server } from '@/lib/servers';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { migrateBossAddPartySize, migrateBossRemoveOrder, migrateCharacterAddSource } from '@/lib/schemaMigrations';
import type { Tombstone } from '@/lib/tombstone';

/** 目前 app 支援的最新備份格式版本 */
export const CURRENT_VERSION = 5;

export interface DriveBackupPayload {
  /** 備份格式版本,供未來相容性判斷用 */
  version: 5;
  /** 備份建立時間(ISO 字串) */
  createdAt: string;
  characters: Character[];
  characterTombstones: Tombstone[];
  tasks: CharacterTask[];
  taskTombstones: Tombstone[];
  bosses: CharacterBossTrackList[];
  bossTombstones: Tombstone[];
}

/**
 * 以下是備份格式歷史版本的欄位快照,故意完全不引用 @/types 目前的即時定義(不用 Omit<Character, ...> 這種寫法)。
 * 原因:避免更動到實際使用的型別的屬性時，造成這裡屬性無法比對需要調整 (例如調整 CharacterBossTrackList、CharacterTask... 等等的型別時),
 */
interface CharacterSnapshotV1 {
  id: string;
  name: string;
  server: Server;
  level: number;
  job: string;
  imageUrl?: string;
  order: number;
}

interface CharacterSnapshotV2 extends CharacterSnapshotV1 {
  source: CharacterSource;
}

interface TaskSnapshotV1 {
  id: string;
  characterId: string;
  presetId?: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  weeklyResetDay?: number;
  dueDate?: string;
  checked: boolean;
  lastResetAt: string;
  order: number;
}

interface BossSnapshotV1 {
  id: string;
  characterId: string;
  bossName: string;
  difficulty: BossDifficulty;
  resetCycle: 'daily' | 'weekly' | 'monthly';
  weeklyResetDay?: number;
  category?: 'season';
  bossCatalogId?: string;
  crystalValue: number;
  checked: boolean;
  lastResetAt: string;
  order: number;
}

interface BossSnapshotV3 extends BossSnapshotV1 {
  partySize: number;
}

interface DriveBackupPayloadV1 {
  version: 1;
  createdAt: string;
  characters: CharacterSnapshotV1[];
  tasks: TaskSnapshotV1[];
  bosses: BossSnapshotV1[];
}

interface DriveBackupPayloadV2 {
  version: 2;
  createdAt: string;
  characters: CharacterSnapshotV2[];
  tasks: TaskSnapshotV1[];
  bosses: BossSnapshotV1[];
}

interface DriveBackupPayloadV3 {
  version: 3;
  createdAt: string;
  characters: CharacterSnapshotV2[];
  tasks: TaskSnapshotV1[];
  bosses: BossSnapshotV3[];
}

interface DriveBackupPayloadV4 {
  version: 4;
  createdAt: string;
  characters: CharacterSnapshotV2[];
  characterTombstones: Tombstone[];
  tasks: TaskSnapshotV1[];
  taskTombstones: Tombstone[];
  bosses: BossSnapshotV3[];
  bossTombstones: Tombstone[];
}

/**
 * 每次 version 破壞性升版時,才新增一個對應的 migrate 函式,例如: 1: (old) => migrateV1ToV2(old as DriveBackupPayloadV1)
 * 若該實體(characters/tasks/bosses)在對應的 persist store(src/store/use*Store.ts)也需要同步升版,
 * 轉換邏輯統一放在 src/lib/schemaMigrations.ts(首次遷移時才建立),兩側各自 .map() 呼叫共用函式,
 * 不得各自內聯撰寫重複的轉換邏輯。
 */
const MIGRATIONS: Record<
  number,
  (old: unknown) => DriveBackupPayload | DriveBackupPayloadV2 | DriveBackupPayloadV3 | DriveBackupPayloadV4
> = {
  1: (old) => {
    const payload = old as DriveBackupPayloadV1;
    return { ...payload, version: 2, characters: payload.characters.map(migrateCharacterAddSource) };
  },
  2: (old) => {
    const payload = old as DriveBackupPayloadV2;
    // migrateBossAddPartySize 的宣告回傳型別是 CharacterBossTrackList,
    // 但實際上是把輸入物件原封不動展開再補 partySize,order 仍會保留在執行期的結果裡,故在此明確標注型別
    return { ...payload, version: 3, bosses: payload.bosses.map(migrateBossAddPartySize) as BossSnapshotV3[] };
  },
  3: (old) => {
    const payload = old as DriveBackupPayloadV3;
    return { ...payload, version: 4, characterTombstones: [], taskTombstones: [], bossTombstones: [] };
  },
  4: (old) => {
    const payload = old as DriveBackupPayloadV4;
    return { ...payload, version: 5, bosses: payload.bosses.map(migrateBossRemoveOrder) };
  },
};

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

export interface BuildBackupPayloadInput {
  characters: Character[];
  characterTombstones: Tombstone[];
  tasks: CharacterTask[];
  taskTombstones: Tombstone[];
  bosses: CharacterBossTrackList[];
  bossTombstones: Tombstone[];
}

export function buildBackupPayload(input: BuildBackupPayloadInput): DriveBackupPayload {
  return {
    version: CURRENT_VERSION,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

/** 把備份 JSON 字串解析並升級到 CURRENT_VERSION,Google Drive 還原與本機檔案匯入共用同一份邏輯 */
export function parseBackupPayload(content: string): DriveBackupPayload {
  return migrateToLatest(JSON.parse(content) as { version: number });
}

/** 讀取目前三個 store 的資料組成備份 JSON 字串,Google Drive 備份與本機檔案下載共用同一份內容 */
export function buildCurrentBackupPayloadJson(): string {
  const { characters, deletedIds: characterTombstones } = useCharacterStore.getState();
  const { tasks, deletedIds: taskTombstones } = useTaskStore.getState();
  const { bosses, deletedIds: bossTombstones } = useBossStore.getState();
  return JSON.stringify(
    buildBackupPayload({
      characters,
      characterTombstones,
      tasks,
      taskTombstones,
      bosses,
      bossTombstones,
    }),
    null,
    2,
  );
}
