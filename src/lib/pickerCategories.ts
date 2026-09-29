/** 選擇清單中單一分類的狀態,用來決定預設要不要展開 */
export interface PickerCategoryState {
  key: string;
  /** 這個分類的項目是否全部已加入(沒有任何可以再選的項目) */
  done: boolean;
}

/**
 * 決定預設任務選擇清單各分類的預設展開狀態:全部展開,只收合全部已加入的分類。
 * (BOSS 選擇清單預設全部收合,不走這個規則)
 * @param categories 依顯示順序排列的分類狀態
 * @returns 預設展開的分類 key
 */
export function getInitialOpenCategories(categories: PickerCategoryState[]): Set<string> {
  return new Set(categories.filter((c) => !c.done).map((c) => c.key));
}
