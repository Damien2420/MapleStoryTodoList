import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterTask, ResetCycle, Settings } from '@/types';
import { needsReset, isWeekendEventOpen } from '@/lib/reset';
import { renumberByPresetOrder, type PresetTask } from '@/lib/presetTasks';
import { nextOrder } from '@/lib/order';
import { trackLocalChange } from '@/lib/trackLocalChange';
import { syncAcrossTabs } from '@/lib/crossTabSync';
import { clearTombstone, recordTombstone, type Tombstone } from '@/lib/tombstone';
import { migrateTaskAddUpdatedAt, type TaskBeforeUpdatedAt } from '@/lib/schemaMigrations';
import { nextTimestamp } from '@/lib/timestamp';

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
  deletedIds: Tombstone[];
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
      deletedIds: [],
      addTask: (input) => {
        const name = input.name.trim();
        const category = input.category.trim() || '未分類';
        if (!name) return;
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
          order: nextOrder(get().tasks.filter((t) => t.characterId === input.characterId)),
          updatedAt: nextTimestamp(),
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
      },
      addPresetTasks: (characterId, presets) => {
        if (presets.length === 0) return;
        const now = new Date().toISOString();
        set((state) => {
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
            order: 0,
            updatedAt: now,
          }));
          const otherCharacters = state.tasks.filter((t) => t.characterId !== characterId);
          const ownExisting = state.tasks.filter((t) => t.characterId === characterId);
          // 每次套用都把「這個角色現有的 + 新增的」preset 任務依目錄順序重新排一次,
          // 不管分幾批加入都會得到同一個順序;非 preset 的手動任務排到最後,彼此保持原本相對順序。
          // 既有任務的 order 被重新編號不算使用者修改,不更新 updatedAt:
          // 這個順序可以由目錄重新算出來,同步合併後也會再排一次(見 backupMerge 的 renumberPresetTasks)
          return { tasks: [...otherCharacters, ...renumberByPresetOrder([...ownExisting, ...newTasks])] };
        });
      },
      toggleTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  checked: !t.checked,
                  lastResetAt: !t.checked ? new Date().toISOString() : t.lastResetAt,
                  updatedAt: nextTimestamp(t.updatedAt),
                }
              : t,
          ),
        }));
      },
      toggleCategoryTasks: (characterId, category, checked) => {
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const weekendOpen = isWeekendEventOpen(nowDate);
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.characterId !== characterId || t.category !== category) return t;
            // 週末活動視窗關閉時,批次操作不可繞過個別任務的鎖定(與 TaskItem 的鎖定方向一致,勾選/取消勾選皆鎖)
            if (t.resetCycle === 'biweekly-weekend' && !weekendOpen) return t;
            // 已經是目標狀態的任務不動,不然會被當成新的修改而在同步時蓋掉其他裝置的變更
            if (t.checked === checked) return t;
            return { ...t, checked, lastResetAt: checked ? now : t.lastResetAt, updatedAt: nextTimestamp(t.updatedAt, nowDate) };
          }),
        }));
      },
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          deletedIds: recordTombstone(state.deletedIds, id),
        }));
      },
      restoreTask: (task) => {
        set((state) =>
          state.tasks.some((t) => t.id === task.id)
            ? state
            : { tasks: [...state.tasks, task], deletedIds: clearTombstone(state.deletedIds, task.id) },
        );
      },
      removeCategoryTasks: (characterId, category) => {
        const removed = get().tasks.filter((t) => t.characterId === characterId && t.category === category);
        set((state) => ({
          tasks: state.tasks.filter((t) => !(t.characterId === characterId && t.category === category)),
          deletedIds: removed.reduce((acc, t) => recordTombstone(acc, t.id), state.deletedIds),
        }));
        return removed;
      },
      removeTasksForCharacter: (characterId) => {
        const removed = get().tasks.filter((t) => t.characterId === characterId);
        set((state) => ({
          tasks: state.tasks.filter((t) => t.characterId !== characterId),
          deletedIds: removed.reduce((acc, t) => recordTombstone(acc, t.id), state.deletedIds),
        }));
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
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Omit<TaskState, 'tasks'> & { tasks: TaskBeforeUpdatedAt[] };
        return {
          ...state,
          deletedIds: state.deletedIds ?? [],
          tasks: version <= 1 ? state.tasks.map(migrateTaskAddUpdatedAt) : (state.tasks as CharacterTask[]),
        };
      },
    },
  ),
);

trackLocalChange(useTaskStore, (s) => s.tasks);
syncAcrossTabs(useTaskStore, 'maplestory-todolist-tasks');
