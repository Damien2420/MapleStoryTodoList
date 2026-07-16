import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character } from '@/types';
import type { Server } from '@/lib/servers';
import { trackLocalChange } from '@/lib/trackLocalChange';

export interface NewCharacterInput {
  name: string;
  server: Server;
  level: number;
  job: string;
  imageUrl?: string;
}

interface CharacterState {
  characters: Character[];
  activeCharacterId: string | null;
  /** 新增角色,回傳新角色的 id,方便呼叫端接著套用預設任務 */
  addCharacter: (input: NewCharacterInput) => string;
  removeCharacter: (id: string) => void;
  setActiveCharacter: (id: string) => void;
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [],
      activeCharacterId: null,
      addCharacter: (input) => {
        const trimmed = input.name.trim();
        if (!trimmed) return '';
        const character: Character = {
          id: crypto.randomUUID(),
          name: trimmed,
          server: input.server,
          level: input.level,
          job: input.job,
          imageUrl: input.imageUrl,
          order: get().characters.length,
        };
        set((state) => ({
          characters: [...state.characters, character],
          activeCharacterId: state.activeCharacterId ?? character.id,
        }));
        return character.id;
      },
      removeCharacter: (id) => {
        set((state) => {
          const characters = state.characters.filter((c) => c.id !== id);
          const activeCharacterId =
            state.activeCharacterId === id ? (characters[0]?.id ?? null) : state.activeCharacterId;
          return { characters, activeCharacterId };
        });
      },
      setActiveCharacter: (id) => set({ activeCharacterId: id }),
    }),
    {
      name: 'maplestory-todolist-characters',
      // schema 版本:改動 Character 持久化結構(改名/刪除/改語意)時 version +1 並補 migrate,
      // 且需同步檢查 backupPayload.ts 的 CURRENT_VERSION/MIGRATIONS 是否也要升版
      version: 0,
    },
  ),
);

trackLocalChange(useCharacterStore, (s) => s.characters);
