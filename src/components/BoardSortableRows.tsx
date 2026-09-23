import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Accessibility, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { GripVertical } from 'lucide-react';
import { BoardCharacterRow } from '@/components/BoardCharacterRow';
import { createDndAnnouncements } from '@/lib/dndAnnouncements';
import type { BoardCharacterRow as BoardCharacterRowData } from '@/lib/characterBoard';
import { cn } from '@/lib/utils';

/** 排序模式下的單列:左側是拖曳握把(可用鍵盤 Space 拿起、方向鍵移動),右側是不可點擊的角色列 */
function SortableRow({ row, index }: { row: BoardCharacterRowData; index: number }) {
  const { ref, handleRef, isDragging } = useSortable({ id: row.character.id, index });

  return (
    <div ref={ref} className={cn('flex items-stretch gap-1.5', isDragging && 'relative z-10 opacity-80 shadow-lg')}>
      <button
        type="button"
        ref={handleRef}
        aria-label={`拖曳排序:${row.character.name}`}
        className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <BoardCharacterRow row={row} sorting />
      </div>
    </div>
  );
}

interface BoardSortableRowsProps {
  rows: BoardCharacterRowData[];
  /** 放開後新的角色 id 順序;順序沒變時不會呼叫 */
  onReorder: (orderedIds: string[]) => void;
}

/**
 * 看板帳號區塊的「排序角色」模式:垂直排序清單,支援滑鼠/觸控拖曳與鍵盤操作。
 * 拖曳過程由 dnd-kit 自己樂觀地重排 DOM(OptimisticSortingPlugin),放開後才透過 onReorder 一次寫回 store,
 * 取消(Esc)不會呼叫 onReorder,不會改到資料。
 * @param props.rows 目前的角色列(依現有順序)
 * @param props.onReorder 放開後新的 id 順序
 */
export function BoardSortableRows({ rows, onReorder }: BoardSortableRowsProps) {
  const ids = rows.map((r) => r.character.id);

  return (
    <DragDropProvider
      sensors={(defaults) => [
        // 預設的 PointerSensor 沒有位移門檻,換成 6px 才啟動,避免手指輕點握把就被當成拖曳;
        // KeyboardSensor 維持預設(Space/Enter 拿起、方向鍵移動、Escape 取消),跟現在行為一致不用改
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 6 })],
        }),
      ]}
      plugins={(defaults) => [
        ...defaults.filter((plugin) => plugin !== Accessibility),
        Accessibility.configure({
          announcements: createDndAnnouncements(
            (id) => rows.find((r) => r.character.id === id)?.character.name ?? String(id),
          ),
        }),
      ]}
      onDragEnd={(event) => {
        if (event.canceled) return;
        onReorder(move(ids, event));
      }}
    >
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <SortableRow key={row.character.id} row={row} index={index} />
        ))}
      </div>
    </DragDropProvider>
  );
}
