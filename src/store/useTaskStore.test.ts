import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/store/useTaskStore';
import { LEGACY_TIMESTAMP } from '@/lib/timestamp';

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

  it('舊版(v1)persisted state 的任務沒有 updatedAt,migrate 後補上 LEGACY_TIMESTAMP', async () => {
    localStorage.setItem(
      'maplestory-todolist-tasks',
      JSON.stringify({
        state: {
          tasks: [
            {
              id: 't1',
              characterId: 'c1',
              name: '任務',
              category: '日常',
              resetCycle: 'daily',
              checked: false,
              lastResetAt: '2026-01-01T00:00:00.000Z',
              order: 0,
            },
          ],
          deletedIds: [],
        },
        version: 1,
      }),
    );
    const { useTaskStore: freshStore } = await import('@/store/useTaskStore');
    expect(freshStore.getState().tasks[0].updatedAt).toBe(LEGACY_TIMESTAMP);
  });
});

describe('useTaskStore 修改時間', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], deletedIds: [] });
  });

  it('toggleCategoryTasks 只更新勾選狀態真的有改變的任務', () => {
    useTaskStore.getState().addTask(baseInput);
    useTaskStore.getState().addTask({ ...baseInput, name: '另一個' });
    useTaskStore.getState().toggleTask(useTaskStore.getState().tasks[0].id);
    const [checkedBefore, uncheckedBefore] = useTaskStore.getState().tasks;

    useTaskStore.getState().toggleCategoryTasks('c1', '日常', true);

    const [checkedAfter, uncheckedAfter] = useTaskStore.getState().tasks;
    expect(checkedAfter).toBe(checkedBefore);
    expect(uncheckedAfter.checked).toBe(true);
    expect(Date.parse(uncheckedAfter.updatedAt)).toBeGreaterThan(Date.parse(uncheckedBefore.updatedAt));
  });

  it('runResetCheck 重置勾選不算使用者修改,不更新 updatedAt', () => {
    useTaskStore.getState().addTask(baseInput);
    useTaskStore.setState((s) => ({
      tasks: s.tasks.map((t) => ({ ...t, checked: true, lastResetAt: '2026-01-01T00:00:00.000Z' })),
    }));
    const before = useTaskStore.getState().tasks[0];

    useTaskStore.getState().runResetCheck({ dailyResetTime: '00:00', weeklyResetDay: 3, weeklyResetTime: '00:00' });

    const after = useTaskStore.getState().tasks[0];
    expect(after.checked).toBe(false);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('addTask 的 order 取同角色目前最大值 + 1', () => {
    useTaskStore.getState().addTask(baseInput);
    useTaskStore.setState((s) => ({ tasks: s.tasks.map((t) => ({ ...t, order: 5 })) }));
    useTaskStore.getState().addTask(baseInput);
    expect(useTaskStore.getState().tasks[1].order).toBe(6);
  });
});
