import { create } from 'zustand';
import { toCollapseDateKey, type CollapseOverride } from '@/lib/characterBoard';

interface BoardState {
  /** 使用者對各帳號區塊手動收合/展開的覆寫,key 是帳號區塊 id(含未歸類的 sentinel id);沒有 entry 代表走自動預設 */
  collapseOverrides: Record<string, CollapseOverride>;
  /**
   * 記下使用者對某個帳號區塊的收合/展開選擇。
   * @param groupId 帳號區塊 id
   * @param collapsed 使用者選擇的結果(true=收合)
   * @param allDone 設定當下該區塊的 allDone
   * @param now 設定當下的時間,預設現在;測試用
   */
  setAccountCollapse: (groupId: string, collapsed: boolean, allDone: boolean, now?: Date) => void;
}

/**
 * 進度看板的帳號區塊收合覆寫。
 * 刻意不持久化(比照 useListFilterStore):重新整理即回到「全部完成就自動收合」的預設;
 * 放在 store 而非元件 state,是因為切到別頁再切回來時看板會重新掛載。
 * 覆寫不會主動清除:過期的 entry 由 characterBoard.ts 的 resolveAccountCollapsed 忽略,下次切換時被覆蓋。
 */
export const useBoardStore = create<BoardState>()((set) => ({
  collapseOverrides: {},
  setAccountCollapse: (groupId, collapsed, allDone, now = new Date()) =>
    set((state) => ({
      collapseOverrides: {
        ...state.collapseOverrides,
        [groupId]: { collapsed, allDoneWhenSet: allDone, dateWhenSet: toCollapseDateKey(now) },
      },
    })),
}));
