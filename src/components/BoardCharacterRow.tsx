import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BoardCycleRing } from '@/components/BoardCycleRing';
import { CrystalAmount } from '@/components/CrystalAmount';
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
import type { BoardCharacterRow as BoardCharacterRowData } from '@/lib/characterBoard';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import type { Character } from '@/types';

/** 討伐收益列上有收益的三個週期,順序即顯示順序 */
const REVENUE_CYCLES = [
  { cycle: 'daily', label: '日' },
  { cycle: 'weekly', label: '週' },
  { cycle: 'monthly', label: '月' },
] as const;

/**
 * 角色頭像:以照片為主的識別依據,96px 方形明顯大於旁邊的文字資訊,讓使用者滑過整排時先靠照片認出是哪隻角色。
 * 有外觀圖用外觀圖;手動建立的角色沒有圖時畫同尺寸的名字首字方塊,避免版面因為缺圖而跳動。
 */
function CharacterAvatar({ character }: { character: Character }) {
  if (character.imageUrl) {
    return <img src={character.imageUrl} alt="" className="size-24 shrink-0 rounded-xl bg-muted object-contain" />;
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl font-bold text-muted-foreground"
    >
      {[...character.name][0]}
    </div>
  );
}

/** 環下方的討伐收益列:有追蹤 BOSS 的週期才出現該項,有追蹤但都沒勾顯示灰色 $0;完全沒有 BOSS 顯示「尚未追蹤 BOSS」 */
function RevenueLedger({ cycles }: { cycles: BoardCharacterRowData['cycles'] }) {
  const items = REVENUE_CYCLES.flatMap(({ cycle, label }) => {
    const revenue = cycles.find((c) => c.cycle === cycle)?.revenue;
    return revenue === undefined ? [] : [{ cycle, label, revenue }];
  });

  return (
    <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border pt-2">
      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-wide text-boss-foreground">
        <img src="/coin.png" alt="" className="size-3.5 shrink-0" />
        討伐收益
      </span>
      {items.length > 0 ? (
        <div className="flex min-w-0 flex-auto flex-wrap justify-between gap-x-2.5 gap-y-1">
          {items.map((item) => (
            <span key={item.cycle} className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[9.5px] font-semibold leading-none text-muted-foreground">{item.label}</span>
              <CrystalAmount value={item.revenue} className="text-[12.5px]" />
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[10.5px] text-muted-foreground opacity-70">尚未追蹤 BOSS</span>
      )}
    </div>
  );
}

/**
 * 刪除角色按鈕(含確認對話框)。這顆按鈕與底下的 Link 是同層的兩個獨立元素(見 BoardCharacterRow),
 * 不是巢狀在 Link 裡面:Radix AlertDialogCancel 關閉對話框的同一次點擊,有機會在遮罩卸載後讓瀏覽器
 * 把點擊落到底下重新露出的元素,若那個元素是 Link 就會誤觸導覽;同層疊加可以完全避開這個問題。
 */
function DeleteCharacterButton({ character }: { character: Character }) {
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const removeBossesForCharacter = useBossStore((s) => s.removeBossesForCharacter);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    removeTasksForCharacter(character.id);
    removeBossesForCharacter(character.id);
    removeCharacter(character.id);
    setConfirmOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`刪除角色:${character.name}`}
        title="刪除角色"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{character.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作無法還原,將會刪除此角色以及底下所有任務與 BOSS 的進度紀錄。
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
 * 進度看板上的一隻角色:整列是一個連結,點擊進入該角色的角色頁。
 * 三個區塊不換行:身分、週期環加討伐收益、其他進度(目前只是預留版位)。容器寬度不足時整列改成直向堆疊的卡片;
 * 斷點用 container query(祖先需有 @container),因為這一列的版面取決於它自己有多少空間,而不是視窗寬度。
 * 網址不帶角色 id,所以點擊時先把這隻角色設為目前角色,再由連結導覽到角色頁。
 * 排序模式(sorting)下整列不可點擊:改渲染成一般的 div,避免拖曳時誤觸導覽,也不會讓鍵盤焦點停在連結上。
 * @param row 看板上這隻角色的資料
 * @param sorting 是否處於排序模式
 */
export function BoardCharacterRow({ row, sorting = false }: { row: BoardCharacterRowData; sorting?: boolean }) {
  const { character, cycles } = row;
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);

  const content = (
    <>
      <div className="flex min-w-[220px] flex-[0_1_268px] items-center gap-4 @max-[712px]:min-w-0 @max-[712px]:flex-none @max-[712px]:pr-7">
        <CharacterAvatar character={character} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[14.5px] font-bold text-foreground">{character.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {character.server} · Lv.{character.level}
            {character.job && ` · ${character.job}`}
          </span>
        </div>
      </div>

      <div className="flex min-w-[280px] flex-[0_0.4_380px] flex-col @max-[712px]:min-w-0 @max-[712px]:flex-none">
        {/* 環隨區塊寬度縮放(單環上限 56px),各週期環等寬,所以每一列的環都上下對齊 */}
        <div className="flex justify-between gap-1">
          {cycles.map((cycle) => (
            <BoardCycleRing key={cycle.cycle} cycle={cycle} />
          ))}
        </div>
        <RevenueLedger cycles={cycles} />
      </div>

      {/* TODO(下一階段):其他進度的內容還沒定案,這裡只保留版位與寬度,不接任何資料,也不預先設計資料結構;
          堆疊版目前沒有內容可放,先隱藏,等內容定案再決定它在窄版的位置 */}
      <div
        aria-hidden="true"
        className="flex min-w-[150px] flex-[0_2.5_300px] flex-col gap-1.5 self-center @max-[712px]:hidden"
      >
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">其他進度</span>
      </div>
    </>
  );

  const rowClassName = cn(
    'relative flex flex-nowrap items-center gap-x-7 gap-y-2.5 rounded-lg border border-border bg-card py-2.5 pl-3 text-left @max-[712px]:flex-col @max-[712px]:items-stretch @max-[712px]:p-3',
    sorting ? 'pr-3' : 'pr-14',
  );

  if (sorting) return <div className={rowClassName}>{content}</div>;

  return (
    <div className="relative">
      <Link
        to={ROUTES.character}
        onClick={() => setActiveCharacter(character.id)}
        className={cn(
          rowClassName,
          'transition-colors hover:border-ring hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {content}
      </Link>

      {/* 刪除按鈕與確認對話框刻意不放進上面的 Link 裡:Radix AlertDialogCancel 關閉的同一次點擊,
          有機會在遮罩卸載後讓瀏覽器把點擊落到底下重新露出的元素,若那個元素是這顆 Link,就會誤觸導覽。
          疊在 Link 上層的獨立同層元素完全不受這個影響,不需要在按鈕上額外擋事件冒泡。 */}
      <div className="pointer-events-none absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-0.5 @max-[712px]:top-3 @max-[712px]:translate-y-0">
        <div className="pointer-events-auto">
          <DeleteCharacterButton character={character} />
        </div>
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground opacity-50" />
      </div>
    </div>
  );
}
