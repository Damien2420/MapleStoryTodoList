import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/dom';

/**
 * dnd-kit 的 Accessibility 外掛的 announcements 選項型別在 @dnd-kit/dom 沒有對外匯出(Announcements/Options
 * 都是套件內部型別),這裡照它的結構自己宣告一份等價的型別,靠結構相容讓 Accessibility.configure({ announcements })
 * 能接受;manager 參數用不到,依 TypeScript 對函式型別的相容規則可以省略。
 */
interface DndAnnouncements {
  dragstart: (event: DragStartEvent) => string | undefined;
  dragover: (event: DragOverEvent) => string | undefined;
  dragend: (event: DragEndEvent) => string | undefined;
}

/**
 * 產生 dnd-kit 的螢幕閱讀器播報文字(繁體中文),讓鍵盤與輔助科技使用者知道拖曳的狀態。
 * 回傳的物件直接傳給 Accessibility.configure({ announcements }),掛在 DragDropProvider 的 plugins 上。
 * @param getLabel 依拖曳項目的 id 取得要念出來的名稱(例如角色名稱、帳號名稱)
 * @param getContainerLabel 選填,依放置目標 id 取得容器名稱;有提供時跨容器搬移會念出目標容器
 * @returns 可直接傳給 Accessibility.configure 的 announcements 物件
 */
export function createDndAnnouncements(
  getLabel: (id: string | number) => string,
  getContainerLabel?: (id: string | number) => string | undefined,
): DndAnnouncements {
  return {
    dragstart: ({ operation: { source } }) => (source ? `已拿起「${getLabel(source.id)}」` : undefined),
    dragover: ({ operation: { source, target } }) => {
      if (!source) return undefined;
      if (!target) return `「${getLabel(source.id)}」已離開放置目標`;
      const container = getContainerLabel?.(target.id);
      return container
        ? `「${getLabel(source.id)}」移到「${container}」`
        : `「${getLabel(source.id)}」移到「${getLabel(target.id)}」的位置`;
    },
    dragend: ({ operation: { source, target }, canceled }) => {
      if (!source) return undefined;
      if (canceled) return `已取消移動「${getLabel(source.id)}」`;
      return target ? `已放下「${getLabel(source.id)}」` : `「${getLabel(source.id)}」已放回原位`;
    },
  };
}
