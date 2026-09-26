/** 有顯示順序的資料(帳號、角色、任務) */
interface Ordered {
  id: string;
  order: number;
}

/**
 * 依 order 排序的比較函式;order 相同時再比 id。
 * 兩台裝置各自新增資料後合併,order 可能撞號,只比 order 會讓不同裝置排出不同順序,加上 id 才固定。
 */
export function compareByOrder(a: Ordered, b: Ordered): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 新資料的 order:目前最大值 + 1,沒有資料時為 0。
 * 不用筆數,因為刪除過資料或合併過其他裝置的資料後,筆數可能與既有的 order 撞號。
 * @param records 同一個排序範圍內的既有資料
 */
export function nextOrder(records: Pick<Ordered, 'order'>[]): number {
  return records.reduce((max, r) => Math.max(max, r.order + 1), 0);
}
