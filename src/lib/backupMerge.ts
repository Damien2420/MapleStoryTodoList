import type { DriveBackupPayload } from '@/lib/backupPayload';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';

export interface MergeResult {
  addedCharacters: number;
  addedTasks: number;
  addedBosses: number;
}

/**
 * 把備份內容合併進本機 store:角色/任務/BOSS 各自只新增本機不存在的 id,
 * 本機已存在的紀錄一律保留原狀、不覆寫(id 皆為 crypto.randomUUID() 產生,不會跨備份重複)。
 */
export function mergeBackupPayload(payload: DriveBackupPayload): MergeResult {
  const localCharacterIds = new Set(useCharacterStore.getState().characters.map((c) => c.id));
  const localTaskIds = new Set(useTaskStore.getState().tasks.map((t) => t.id));
  const localBossIds = new Set(useBossStore.getState().bosses.map((b) => b.id));

  const newCharacters = payload.characters.filter((c) => !localCharacterIds.has(c.id));
  const newTasks = payload.tasks.filter((t) => !localTaskIds.has(t.id));
  const newBosses = payload.bosses.filter((b) => !localBossIds.has(b.id));

  if (newCharacters.length > 0) {
    useCharacterStore.setState((state) => ({
      characters: [...state.characters, ...newCharacters],
      // 本機原本沒有任何角色時,還原後要有一個預設選中的角色,不然畫面會一直卡在「建立第一個角色」的引導畫面
      activeCharacterId: state.activeCharacterId ?? newCharacters[0].id,
    }));
  }
  if (newTasks.length > 0) {
    useTaskStore.setState((state) => ({ tasks: [...state.tasks, ...newTasks] }));
  }
  if (newBosses.length > 0) {
    useBossStore.setState((state) => ({ bosses: [...state.bosses, ...newBosses] }));
  }

  return {
    addedCharacters: newCharacters.length,
    addedTasks: newTasks.length,
    addedBosses: newBosses.length,
  };
}
