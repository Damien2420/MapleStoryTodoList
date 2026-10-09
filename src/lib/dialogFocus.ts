/**
 * 給 DialogContent 的 onOpenAutoFocus 用:取消 Radix 預設「聚焦第一個可操作元素」,改成聚焦 Dialog 容器本身。
 * 用在第一個可操作元素是清單項目的 Dialog(例如新增任務/BOSS 的分類標題),避免一打開就在清單上出現焦點框;
 * 容器有 tabIndex=-1 與 outline-none,不會顯示框線,鍵盤使用者按 Tab 即進入第一個元素,讀螢幕軟體仍會先念出 Dialog 標題。
 * @param event Radix 在 Dialog 容器上觸發的自動聚焦事件
 */
export function focusDialogContainer(event: Event): void {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
}
