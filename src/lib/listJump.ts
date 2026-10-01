import type { CycleSummary } from '@/lib/characterSummary';
import { prefersReducedMotion } from '@/lib/media';
import type { BossCycleKey } from '@/store/useListFilterStore';

/** 可以跳轉的清單 */
export type JumpList = 'task' | 'boss';

/**
 * 該週期有項目的清單,順序固定任務在前。
 * @param cycle 週期的進度摘要
 * @returns 有項目的清單
 */
export function listsWithItems(cycle: CycleSummary): JumpList[] {
  const lists: JumpList[] = [];
  if (cycle.taskTotal > 0) lists.push('task');
  if (cycle.bossTotal > 0) lists.push('boss');
  return lists;
}

/**
 * 週期區塊上 data-jump-anchor 的值。
 * @param list 清單
 * @param cycle 週期
 * @returns 例如 'task-daily'
 */
export function jumpAnchorValue(list: JumpList, cycle: BossCycleKey): string {
  return `${list}-${cycle}`;
}

/**
 * 捲動到清單中指定週期的區塊。
 * container 模式捲動清單自己的捲動容器(寬螢幕兩欄並排時,避免整頁一起捲動);page 模式捲動整頁(窄螢幕)。
 * 目標區塊不存在(例如被完成狀態篩選隱藏)時,捲到該清單的開頭。
 * 減少動態效果時改為立即跳轉。
 * @param root 查找標記的範圍,通常是 document
 * @param list 目標清單
 * @param cycle 目標週期
 * @param mode 捲動清單容器或整頁
 */
export function scrollToCycle(root: ParentNode, list: JumpList, cycle: BossCycleKey, mode: 'container' | 'page'): void {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const target = root.querySelector<HTMLElement>(`[data-jump-anchor="${jumpAnchorValue(list, cycle)}"]`);

  if (mode === 'container') {
    const scroller = root.querySelector<HTMLElement>(`[data-jump-scroller="${list}"]`);
    if (!scroller) return;
    const top = target
      ? target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      : 0;
    scroller.scrollTo({ top, behavior });
  } else {
    const el = target ?? root.querySelector<HTMLElement>(`[data-jump-list="${list}"]`);
    el?.scrollIntoView({ block: 'start', behavior });
  }
}
