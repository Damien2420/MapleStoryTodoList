import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterTask, ResetCycle, Settings } from '@/types';
import { needsReset } from '@/lib/reset';
import type { PresetTask } from '@/lib/presetTasks';
import { trackLocalChange } from '@/lib/trackLocalChange';

export interface NewTaskInput {
  characterId: string;
  name: string;
  category: string;
  resetCycle: ResetCycle;
  weeklyResetDay?: number;
  dueDate?: string;
}

interface TaskState {
  tasks: CharacterTask[];
  addTask: (input: NewTaskInput) => void;
  addPresetTasks: (characterId: string, presets: PresetTask[]) => void;
  toggleTask: (id: string) => void;
  /** 將指定角色底下某分類的所有任務一次設為同一個勾選狀態 */
  toggleCategoryTasks: (characterId: string, category: string, checked: boolean) => void;
  removeTask: (id: string) => void;
  /** 還原被刪除的任務(用於刪除後的 toast 還原按鈕) */
  restoreTask: (task: CharacterTask) => void;
  /** 刪除指定角色底下某分類的所有任務,回傳被刪除的任務清單以供還原 */
  removeCategoryTasks: (characterId: string, category: string) => CharacterTask[];
  removeTasksForCharacter: (characterId: string) => void;
  runResetCheck: (settings: Settings) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (input) => {
        const name = input.name.trim();
        const category = input.category.trim() || '未分類';
        if (!name) return;
        const orderInCharacter = get().tasks.filter((t) => t.characterId === input.characterId).length;
        const task: CharacterTask = {
          id: crypto.randomUUID(),
          characterId: input.characterId,
          name,
          category,
          resetCycle: input.resetCycle,
          weeklyResetDay: input.resetCycle === 'weekly' ? input.weeklyResetDay : undefined,
          dueDate: input.dueDate,
          checked: false,
          lastResetAt: new Date().toISOString(),
          order: orderInCharacter,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
      },
      addPresetTasks: (characterId, presets) => {
        if (presets.length === 0) return;
        const now = new Date().toISOString();
        set((state) => {
          let order = state.tasks.filter((t) => t.characterId === characterId).length;
          const newTasks: CharacterTask[] = presets.map((preset) => ({
            id: crypto.randomUUID(),
            characterId,
            presetId: preset.sourceId ?? preset.id,
            name: preset.name,
            category: preset.category,
            resetCycle: preset.resetCycle,
            weeklyResetDay: preset.weeklyResetDay,
            checked: false,
            lastResetAt: now,
            order: order++,
          }));
          return { tasks: [...state.tasks, ...newTasks] };
        });
      },
      toggleTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, checked: !t.checked, lastResetAt: !t.checked ? new Date().toISOString() : t.lastResetAt }
              : t,
          ),
        }));
      },
      toggleCategoryTasks: (characterId, category, checked) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.characterId === characterId && t.category === category
              ? { ...t, checked, lastResetAt: checked ? now : t.lastResetAt }
              : t,
          ),
        }));
      },
      removeTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      },
      restoreTask: (task) => {
        set((state) => (state.tasks.some((t) => t.id === task.id) ? state : { tasks: [...state.tasks, task] }));
      },
      removeCategoryTasks: (characterId, category) => {
        const removed = get().tasks.filter((t) => t.characterId === characterId && t.category === category);
        set((state) => ({
          tasks: state.tasks.filter((t) => !(t.characterId === characterId && t.category === category)),
        }));
        return removed;
      },
      removeTasksForCharacter: (characterId) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.characterId !== characterId) }));
      },
      runResetCheck: (settings) => {
        const now = new Date();
        set((state) => {
          let changed = false;
          const tasks = state.tasks.map((task) => {
            if (needsReset(task, settings, now)) {
              changed = true;
              return { ...task, checked: false, lastResetAt: now.toISOString() };
            }
            return task;
          });
          return changed ? { tasks } : state;
        });
      },
    }),
    {
      name: 'maplestory-todolist-tasks',
      // schema 版本:改動 CharacterTask 持久化結構(改名/刪除/改語意)時 version +1 並補 migrate,
      // 且需同步檢查 backupPayload.ts 的 CURRENT_VERSION/MIGRATIONS 是否也要升版
      version: 0,
    },
  ),
);

trackLocalChange(useTaskStore, (s) => s.tasks);
