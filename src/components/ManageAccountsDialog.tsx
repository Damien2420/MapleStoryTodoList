import { useMemo, useState } from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { Accessibility, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { DragDropProvider, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Settings2, Trash2 } from 'lucide-react';
import { AddAccountDialog } from '@/components/AddAccountDialog';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME } from '@/lib/characterBoard';
import { createDndAnnouncements } from '@/lib/dndAnnouncements';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Account, Character } from '@/types';

/**
 * 角色卡容器(帳號本體或未歸類)的 droppable id 前綴。帳號本身的可排序項目(拖曳排序帳號用)也是用帳號 id 註冊,
 * 兩者不能共用同一個 id,所以角色卡容器另外加前綴錯開。
 */
const BODY_PREFIX = 'body:';
const bodyId = (accountId: string) => `${BODY_PREFIX}${accountId}`;

/** 角色卡片固定尺寸 class */
const CARD_CLASS = 'h-[118px] w-[84px]';

/** 容器 id(bodyId 的結果)對應到該容器內依序排列的角色 id;用來畫面呈現與 dnd-kit 的 move() 直接運算 */
type ContainerMap = Record<string, string[]>;

/** 角色卡片:有外觀圖以外觀圖為底、名字壓在下緣;沒有圖就直接置中顯示名字。整張卡片都是拖曳把手 */
function CharacterCard({ character, index, group }: { character: Character; index: number; group: string }) {
  const { ref, isDragging } = useSortable({
    id: character.id,
    index,
    group,
    type: 'character',
    accept: 'character',
  });

  return (
    <div
      ref={ref}
      aria-label={`${character.name},拖曳以搬到其他帳號或調整順序`}
      className={cn(
        CARD_CLASS,
        'relative shrink-0 cursor-grab overflow-hidden rounded-lg border border-border bg-muted outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
        isDragging && 'z-20 opacity-80 shadow-lg ring-2 ring-primary',
      )}
    >
      {character.imageUrl && (
        <img src={character.imageUrl} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />
      )}
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold',
          character.imageUrl ? 'bg-background/80 text-foreground' : 'top-0 flex items-center justify-center whitespace-normal break-all text-sm',
        )}
      >
        {character.name}
      </span>
    </div>
  );
}

interface ContainerBodyProps {
  accountId: string;
  characters: Character[];
  /** 空容器時顯示的提示文字;未歸類不是真的帳號,「加入這個帳號」的措辭不適用,由呼叫端換一句 */
  emptyMessage?: string;
}

/**
 * 一個容器(帳號或未歸類)的角色區:同時是 Droppable,空的時候顯示提示,拖到上面就能加入。
 * collisionPriority 設為 Low,讓卡片本身(預設優先度)在有重疊時優先命中,只有落在卡片以外的空白處才會命中容器本體,
 * 這樣才能對齊「拖到卡片之間插入、拖到空白處排最後、拖到空容器直接加入」的行為。
 */
function ContainerBody({ accountId, characters, emptyMessage = '拖曳角色到這裡即可加入這個帳號' }: ContainerBodyProps) {
  const id = bodyId(accountId);
  const { ref, isDropTarget } = useDroppable({
    id,
    type: 'character',
    accept: 'character',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={ref}
      className={cn(
        'flex min-h-[134px] flex-wrap content-start gap-2 rounded-lg border border-dashed p-2 transition-colors',
        isDropTarget ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      {characters.length === 0 ? (
        <p className="flex min-h-[118px] flex-1 items-center justify-center text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        characters.map((character, index) => (
          <CharacterCard key={character.id} character={character} index={index} group={id} />
        ))
      )}
    </div>
  );
}

interface AccountBlockProps {
  account: Account;
  index: number;
  characters: Character[];
  onRequestDelete: (account: Account) => void;
}

/**
 * 一個帳號:上方是標題列(拖曳握把、名稱、角色數、刪除),下方是角色區。整個區塊可被拖曳來調整帳號順序。
 * 握把的可拖曳範圍是整個「圖示+名稱+角色數」區塊,不是只有那顆小圖示——帳號區塊會隨角色卡片換行變高,
 * 只留一顆 28px 圖示當唯一熱區,遊標要精準移回左上角太苛求,擴大熱區才符合這個拖曳目標的實際大小。
 * 刻意不用實色底 hover(那是這個專案裡按鈕的視覺語言,BoardAccountSection 的收合鈕就長這樣但是真的可以點),
 * 這個區塊本身沒有 onClick、純粹是拖曳握把,套同一種底色會讓使用者誤以為點下去會有反應;
 * 改成只有 grab 游標加握把圖示 hover 變色,提示「這裡可以抓」而不是「這裡可以按」。
 */
function AccountBlock({ account, index, characters, onRequestDelete }: AccountBlockProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: account.id,
    index,
    type: 'account',
    accept: 'account',
  });

  return (
    <section
      ref={ref}
      className={cn('flex flex-col gap-2 rounded-xl border border-border bg-card p-3', isDragging && 'relative z-10 opacity-80 shadow-lg')}
    >
      <div className="flex items-center gap-2">
        <div
          ref={handleRef}
          role="button"
          tabIndex={0}
          aria-label={`拖曳排序帳號:${account.name}`}
          className="group flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          />
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{account.name}</h3>
          <span className="shrink-0 text-xs text-muted-foreground">{characters.length} 位角色</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`刪除帳號:${account.name}`}
          title="刪除帳號"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRequestDelete(account)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <ContainerBody accountId={account.id} characters={characters} />
    </section>
  );
}

/**
 * 管理帳號對話框(自帶觸發按鈕):新增帳號、刪除帳號、拖曳調整帳號順序、搬動角色到別的帳號或在帳號內部排序角色。
 * 
 * 「未歸類」永遠排在最後,不能拖曳也不能刪除,但可以當作放置目標(把角色移出帳號)。
 * 角色卡片的拖曳過程只改本地的草稿排列(draft),放開才用 applyCharacterLayout 一次寫回 store,
 * 取消(Esc)則丟掉草稿,不會動到資料;帳號順序則是放開後直接呼叫 reorderAccounts。
 * 刪除帳號會先確認,底下的角色歸回未歸類(由 removeAccount 處理)。
 */
export function ManageAccountsDialog() {
  const accounts = useAccountStore((s) => s.accounts);
  const reorderAccounts = useAccountStore((s) => s.reorderAccounts);
  const removeAccount = useAccountStore((s) => s.removeAccount);
  const characters = useCharacterStore((s) => s.characters);
  const applyCharacterLayout = useCharacterStore((s) => s.applyCharacterLayout);

  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  // 角色拖曳期間的本地草稿排列;null 代表目前沒有在拖角色,直接顯示 store 算出來的排列
  const [draft, setDraft] = useState<ContainerMap | null>(null);

  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.order - b.order), [accounts]);
  const accountIds = useMemo(() => new Set(sortedAccounts.map((a) => a.id)), [sortedAccounts]);
  const charactersById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);

  // store 目前的排列:每個帳號一格(key 用 bodyId 前綴),指向不存在帳號的角色與 accountId 為 null 的一起歸未歸類
  const storeLayout = useMemo<ContainerMap>(() => {
    const layout: ContainerMap = { [bodyId(UNASSIGNED_GROUP_ID)]: [] };
    for (const account of sortedAccounts) layout[bodyId(account.id)] = [];
    for (const character of [...characters].sort((a, b) => a.order - b.order)) {
      const key = character.accountId !== null && accountIds.has(character.accountId) ? character.accountId : UNASSIGNED_GROUP_ID;
      layout[bodyId(key)].push(character.id);
    }
    return layout;
  }, [sortedAccounts, characters, accountIds]);

  const layout = draft ?? storeLayout;

  const announcements = useMemo(
    () =>
      createDndAnnouncements(
        (id) => charactersById.get(String(id))?.name ?? sortedAccounts.find((a) => a.id === id)?.name ?? String(id),
        (id) => {
          const key = String(id);
          if (key === bodyId(UNASSIGNED_GROUP_ID)) return UNASSIGNED_GROUP_NAME;
          return key.startsWith(BODY_PREFIX)
            ? sortedAccounts.find((a) => a.id === key.slice(BODY_PREFIX.length))?.name
            : undefined;
        },
      ),
    [charactersById, sortedAccounts],
  );

  function handleDragOver(event: DragOverEvent) {
    const { source } = event.operation;
    if (!source || accountIds.has(String(source.id))) return;
    setDraft((prev) => move(prev ?? storeLayout, event));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;
    if (!source) {
      setDraft(null);
      return;
    }

    if (accountIds.has(String(source.id))) {
      if (!event.canceled) {
        reorderAccounts(move(sortedAccounts.map((a) => a.id), event));
      }
      return;
    }

    const final = move(draft ?? storeLayout, event);
    setDraft(null);
    if (event.canceled) return;
    applyCharacterLayout([
      ...sortedAccounts.map((a) => ({ accountId: a.id as string | null, characterIds: final[bodyId(a.id)] ?? [] })),
      { accountId: null, characterIds: final[bodyId(UNASSIGNED_GROUP_ID)] ?? [] },
    ]);
  }

  function handleConfirmDelete() {
    if (deleteTarget) removeAccount(deleteTarget.id);
    setDeleteTarget(null);
  }

  const charactersOf = (id: string) =>
    (layout[id] ?? []).map((cid) => charactersById.get(cid)).filter((c): c is Character => c !== undefined);
  const deleteTargetMemberCount = deleteTarget ? (storeLayout[bodyId(deleteTarget.id)]?.length ?? 0) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-4" />
          管理帳號
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>管理帳號</DialogTitle>
          <DialogDescription>
            按住帳號列左上角的把手可調整拖曳帳號順序；拖曳角色卡片可以搬到別的帳號，同一個帳號內的拖曳則是排序。
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <AddAccountDialog />
        </div>

        <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
          <DragDropProvider
            sensors={(defaults) => [
              ...defaults.filter((sensor) => sensor !== PointerSensor),
              PointerSensor.configure({
                activationConstraints(event) {
                  if (event.pointerType === 'touch') {
                    return [new PointerActivationConstraints.Delay({ value: 200, tolerance: 8 })];
                  }
                  return [new PointerActivationConstraints.Distance({ value: 6 })];
                },
              }),
            ]}
            plugins={(defaults) => [
              ...defaults.filter((plugin) => plugin !== Accessibility),
              Accessibility.configure({ announcements }),
            ]}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {sortedAccounts.map((account, index) => (
              <AccountBlock
                key={account.id}
                account={account}
                index={index}
                characters={charactersOf(bodyId(account.id))}
                onRequestDelete={setDeleteTarget}
              />
            ))}

            {/* 未歸類永遠在最後,不能被拖曳、也不能刪除,只當放置目標 */}
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 pl-9">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">{UNASSIGNED_GROUP_NAME}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">{charactersOf(bodyId(UNASSIGNED_GROUP_ID)).length} 位角色</span>
              </div>
              <ContainerBody
                accountId={UNASSIGNED_GROUP_ID}
                characters={charactersOf(bodyId(UNASSIGNED_GROUP_ID))}
                emptyMessage="拖曳角色到這裡即可移出所屬帳號"
              />
            </section>
          </DragDropProvider>
        </div>
        
        { /* 刪除確認的 AlertDialog 刻意宣告在這個 Dialog 的 JSX 樹裡面(而不是兄弟元素):
             Radix 的 dismissable layer 是用 React context 往下傳來判斷「這次點擊算不算點在外面」,
             兩個 Dialog 類元件如果只是同層並列、沒有 React 父子關係,子層(AlertDialog)裡的任何點擊
             對外層 Dialog 來說都會被判定成「點在外面」而觸發關閉——按「取消」時外層的管理帳號視窗也會跟著關掉就是這樣來的。 */ }
        <AlertDialog open={deleteTarget !== null} onOpenChange={(next) => !next && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除「{deleteTarget?.name}」嗎?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTargetMemberCount > 0
                  ? `底下 ${deleteTargetMemberCount} 位角色會歸回未歸類，角色與進度紀錄不會被刪除。`
                  : '這個帳號底下沒有角色。'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                刪除帳號
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
