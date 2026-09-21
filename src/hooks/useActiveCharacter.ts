import { useCharacterStore } from '@/store/useCharacterStore';
import type { Character } from '@/types';

/**
 * 目前檢視的角色。以 activeCharacterId 為準;它失效(null、或指向已被刪除/合併掉的角色)時退回第一隻角色,
 * 這裡只衍生不回寫,使用者實際切換角色時才會透過 setActiveCharacter 寫入。
 * @returns 目前角色;完全沒有角色時回傳 undefined
 */
export function useActiveCharacter(): Character | undefined {
  return useCharacterStore((s) => s.characters.find((c) => c.id === s.activeCharacterId) ?? s.characters[0]);
}
