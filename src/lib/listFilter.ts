/** 完成狀態篩選值:全部 / 未完成 / 已完成 */
export type StatusFilter = 'all' | 'unchecked' | 'checked';

/**
 * 依完成狀態篩選清單項目
 * @param items 具有 checked 欄位的項目陣列
 * @param filter 篩選條件('all' 時原陣列直接回傳)
 * @returns 符合條件的項目陣列
 */
export function filterItemsByStatus<T extends { checked: boolean }>(items: T[], filter: StatusFilter): T[] {
  if (filter === 'all') return items;
  return items.filter((item) => (filter === 'checked' ? item.checked : !item.checked));
}
