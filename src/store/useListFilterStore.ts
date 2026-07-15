import { create } from 'zustand';
import type { StatusFilter } from '@/lib/listFilter';

/** BOSS 清單的週期分組鍵(賽季是顯示分類,非實際重置週期) */
export type BossCycleKey = 'daily' | 'weekly' | 'monthly' | 'season';

interface ListFilterState {
  /** 任務清單:完成狀態篩選 */
  taskStatusFilter: StatusFilter;
  /** 任務清單:被收合的分類區塊鍵(格式:characterId|週期|分類名稱) */
  collapsedTaskSections: Set<string>;
  /** BOSS 清單:完成狀態篩選 */
  bossStatusFilter: StatusFilter;
  /** BOSS 清單:被收合的週期區塊 */
  collapsedBossSections: Set<BossCycleKey>;
  setTaskStatusFilter: (filter: StatusFilter) => void;
  toggleTaskSection: (key: string) => void;
  setBossStatusFilter: (filter: StatusFilter) => void;
  toggleBossSection: (cycle: BossCycleKey) => void;
}

/** 回傳一個切換了指定值的新 Set(不改動原 Set) */
function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * 清單篩選狀態:任務/BOSS 清單各自獨立的完成狀態篩選與區塊收合狀態。
 * 刻意不持久化:重新整理即回到預設(顯示全部、全部展開);因狀態在 store 而非元件內,切換角色分頁不會重置。
 */
export const useListFilterStore = create<ListFilterState>()((set) => ({
  taskStatusFilter: 'all',
  collapsedTaskSections: new Set<string>(),
  bossStatusFilter: 'all',
  collapsedBossSections: new Set<BossCycleKey>(),
  setTaskStatusFilter: (filter) => set({ taskStatusFilter: filter }),
  toggleTaskSection: (key) => set((s) => ({ collapsedTaskSections: toggled(s.collapsedTaskSections, key) })),
  setBossStatusFilter: (filter) => set({ bossStatusFilter: filter }),
  toggleBossSection: (cycle) => set((s) => ({ collapsedBossSections: toggled(s.collapsedBossSections, cycle) })),
}));
