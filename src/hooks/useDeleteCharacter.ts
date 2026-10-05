import { useCallback } from 'react';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeaponStore } from '@/store/useWeaponStore';

/**
 * 刪除角色的唯一入口:連同該角色的任務、BOSS 紀錄與武器進度一起刪除。
 * 看板的管理角色模式與角色頁都呼叫這裡,刪除規則改變時只需要改一個地方。
 * 先刪任務與 BOSS 再刪角色,避免中間有一瞬間出現「角色已不存在、紀錄還在」的孤兒資料。
 * @returns 刪除函式,參數為要刪除的角色 id
 */
export function useDeleteCharacter(): (characterId: string) => void {
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const removeBossesForCharacter = useBossStore((s) => s.removeBossesForCharacter);
  const removeWeaponData = useWeaponStore((s) => s.removeCharacter);

  return useCallback(
    (characterId: string) => {
      removeTasksForCharacter(characterId);
      removeBossesForCharacter(characterId);
      removeWeaponData(characterId);
      removeCharacter(characterId);
    },
    [removeCharacter, removeTasksForCharacter, removeBossesForCharacter, removeWeaponData],
  );
}
