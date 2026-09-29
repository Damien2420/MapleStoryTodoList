import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Accessibility, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { BoardCharacterRow } from '@/components/BoardCharacterRow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { createDndAnnouncements } from '@/lib/dndAnnouncements';
import type { BoardCharacterRow as BoardCharacterRowData } from '@/lib/characterBoard';
import { useDeleteCharacter } from '@/hooks/useDeleteCharacter';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';

/**
 * 刪除角色按鈕(含確認對話框),只出現在管理角色模式。
 * 這個模式下角色列是一般的 div 而不是連結,確認對話框關閉的那一下即使穿透到底下,也不會誤觸導覽。
 * 可點範圍 44px,放在角色列卡片內的右端(透過 BoardCharacterRow 的 action),與左側握把分在兩端,避免拖曳時誤按。
 */
function DeleteCharacterButton({ character }: { character: Character }) {
  const deleteCharacter = useDeleteCharacter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleDelete() {
    deleteCharacter(character.id);
    setConfirmOpen(false);
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`刪除角色:${character.name}`}
        className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // 對話框用 state 開啟、沒有經過 AlertDialogTrigger,Radix 不會自己把焦點還給按鈕,這裡手動處理:
            // 取消時還給刪除鈕;刪除成功時按鈕已隨這一列卸載,改交給頁面主要區域(與 AddAccountDialog 相同做法)
            e.preventDefault();
            if (triggerRef.current?.isConnected) triggerRef.current.focus();
            else document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{character.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作無法還原,將會刪除此角色以及底下所有任務與 BOSS 的進度紀錄。同步後，其他裝置上的這個角色也會一併刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              刪除角色
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * 管理角色模式下的單列:左側拖曳握把(可用鍵盤 Space 拿起、方向鍵移動)、右側不可點擊的角色列,刪除鈕在角色列卡片內的右端。
 * 只有一隻角色時沒東西可排,握把隱藏但保留寬度,列的位置不會因為角色數變化而左右跳動。
 * @param props.sortable 是否可排序(帳號內至少兩隻角色)
 */
function SortableRow({ row, index, sortable }: { row: BoardCharacterRowData; index: number; sortable: boolean }) {
  const { ref, handleRef, isDragging } = useSortable({ id: row.character.id, index, disabled: !sortable });

  return (
    <div ref={ref} className={cn('flex items-stretch gap-1.5', isDragging && 'relative z-10 opacity-80 shadow-lg')}>
      <button
        type="button"
        ref={handleRef}
        aria-label={`拖曳排序:${row.character.name}`}
        className={cn(
          'flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
          // invisible 同時讓它離開 Tab 順序與無障礙樹
          !sortable && 'invisible',
        )}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <BoardCharacterRow row={row} sorting action={<DeleteCharacterButton character={row.character} />} />
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
 * 看板帳號區塊的「管理角色」模式:垂直排序清單(支援滑鼠/觸控拖曳與鍵盤操作),每列另有刪除鈕。
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
        const next = move(ids, event);
        // 原地放下時 move() 回傳同一個陣列,不需要寫回
        if (next !== ids) onReorder(next);
      }}
    >
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <SortableRow key={row.character.id} row={row} index={index} sortable={rows.length >= 2} />
        ))}
      </div>
    </DragDropProvider>
  );
}
