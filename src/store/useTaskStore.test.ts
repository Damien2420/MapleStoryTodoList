import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/store/useTaskStore';

const baseInput = {
  characterId: 'c1',
  name: '測試任務',
  category: '日常',
  resetCycle: 'daily' as const,
};

describe('useTaskStore 墓碑相關行為', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], deletedIds: [] });
  });

  it('removeTask 寫入墓碑', () => {
    useTaskStore.getState().addTask(baseInput);
    const id = useTaskStore.getState().tasks[0].id;
    useTaskStore.getState().removeTask(id);
    expect(useTaskStore.getState().deletedIds.map((t) => t.id)).toEqual([id]);
  });

  it('restoreTask(undo)會清掉剛才寫入的墓碑', () => {
    useTaskStore.getState().addTask(baseInput);
    const task = useTaskStore.getState().tasks[0];
    useTaskStore.getState().removeTask(task.id);
    expect(useTaskStore.getState().deletedIds).toHaveLength(1);

    useTaskStore.getState().restoreTask(task);
    expect(useTaskStore.getState().deletedIds).toEqual([]);
    expect(useTaskStore.getState().tasks).toEqual([task]);
  });

  it('removeCategoryTasks 對每一筆被刪除的任務都寫入墓碑', () => {
    useTaskStore.getState().addTask(baseInput);
    useTaskStore.getState().addTask({ ...baseInput, name: '測試任務2' });
    useTaskStore.getState().removeCategoryTasks('c1', '日常');
    expect(useTaskStore.getState().deletedIds).toHaveLength(2);
    expect(useTaskStore.getState().tasks).toEqual([]);
  });

  it('removeTasksForCharacter 對每一筆被刪除的任務都寫入墓碑', () => {
    useTaskStore.getState().addTask(baseInput);
    useTaskStore.getState().removeTasksForCharacter('c1');
    expect(useTaskStore.getState().deletedIds).toHaveLength(1);
  });
});

describe('useTaskStore migration v0 -> v1', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('舊版(v0)persisted state 沒有 deletedIds,migrate 後補上空陣列', async () => {
    localStorage.setItem(
      'maplestory-todolist-tasks',
      JSON.stringify({
        state: { tasks: [] },
        version: 0,
      }),
    );
    const { useTaskStore: freshStore } = await import('@/store/useTaskStore');
    expect(freshStore.getState().deletedIds).toEqual([]);
  });
});
