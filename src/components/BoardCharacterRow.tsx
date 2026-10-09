import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BoardCycleRing } from '@/components/BoardCycleRing';
import { RevenueLedger } from '@/components/RevenueLedger';
import { WeaponProgressList } from '@/components/weapon/WeaponProgressList';
import { describeWeaponRows, hasProgress, weaponListRows } from '@/components/weapon/weaponUi';
import { useWeaponStatus } from '@/hooks/useWeaponProgress';
import { describeBoardRowProgress, type BoardCharacterRow as BoardCharacterRowData } from '@/lib/characterBoard';
import { pickRevenueItems } from '@/lib/revenueItems';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Character } from '@/types';

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

/**
 * 進度看板上的一隻角色:整列是一個連結,點擊進入該角色的角色頁。刪除角色不在這裡,只在管理角色模式(BoardSortableRows)。
 * 三個區塊不換行:身分、週期環加討伐收益、武器進度。容器寬度不足時整列改成直向堆疊的卡片;
 * 斷點用 container query(祖先需有 @container),因為這一列的版面取決於它自己有多少空間,而不是視窗寬度。
 * 網址不帶角色 id,所以點擊時先把這隻角色設為目前角色,再由連結導覽到角色頁。
 * 管理角色模式(sorting)下整列不可點擊:改渲染成一般的 div,避免拖曳時誤觸導覽,也不會讓鍵盤焦點停在連結上;
 * 此時列內右端可放操作按鈕(action,目前是刪除鈕)。因為列不是連結,按鈕放在列內不會形成巢狀互動元素。
 * @param row 看板上這隻角色的資料
 * @param sorting 是否處於管理角色模式
 * @param action 管理角色模式下放在列內右端的操作按鈕;寬版垂直置中,窄版在卡片右上角
 */
export function BoardCharacterRow({
  row,
  sorting = false,
  action,
}: {
  row: BoardCharacterRowData;
  sorting?: boolean;
  action?: ReactNode;
}) {
  const { character, cycles } = row;
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);
  const hasAction = sorting && action !== undefined;
  const progressId = useId();
  // 看板只需要目前狀態,用輕量版,不算本週與預估時間軸
  const weapons = useWeaponStatus(character);
  const weaponRows = weaponListRows(weapons);
  const weaponsEmpty = weaponRows.every((r) => !hasProgress(r.status));
  const waitingCount = weaponRows.filter((r) => r.waiting).length;

  const content = (
    <>
      <div
        className={cn(
          'flex min-w-[220px] flex-[0_1_268px] items-center gap-4 @max-[712px]:min-w-0 @max-[712px]:flex-none',
          // 窄版右上角要讓出箭頭(28px)或操作按鈕(44px)的位置,名稱才不會被蓋住
          hasAction ? '@max-[712px]:pr-12' : '@max-[712px]:pr-7',
        )}
      >
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
        {/* 環下方的討伐收益列:完全沒有 BOSS 時顯示「尚未追蹤 BOSS」 */}
        <RevenueLedger
          items={pickRevenueItems((cycle) => cycles.find((c) => c.cycle === cycle)?.revenue)}
          emptyText="尚未追蹤 BOSS"
          className="mt-2"
        />
      </div>

      {/* 武器進度:固定四行、固定欄寬,上下角色的進度條對齊;堆疊版放在週期環下方,排成 2x2(太窄時回到單欄) */}
      <div
        aria-hidden="true"
        className="flex min-w-[150px] flex-[0_2.5_300px] flex-col gap-1.5 self-center @max-[712px]:min-w-0 @max-[712px]:flex-none @max-[712px]:self-stretch @max-[712px]:border-t @max-[712px]:border-border @max-[712px]:pt-2.5"
      >
        <span className="flex justify-between gap-2 text-[10px] font-semibold tracking-wide text-muted-foreground">
          武器進度
          {waitingCount > 0 && <span className="text-secondary-foreground">{waitingCount} 把待升階</span>}
        </span>
        {/* 四把都沒有進度時(小號常見)只顯示簡短說明,不列四行「未設定」;
            用次要文字色、和標題左緣對齊,一頁有很多小號時不會比其他列的進度更搶眼 */}
        {weaponsEmpty ? (
          <span className="flex flex-col gap-0.5 text-[11px] leading-normal text-muted-foreground">
            <span className="font-medium">還沒設定武器進度</span>
            <span>進入角色頁設定</span>
          </span>
        ) : (
          <WeaponProgressList
            rows={weaponRows}
            state={weapons.state}
            className="grid-cols-[4.4em_minmax(0,1fr)_5.4em] text-[11px] @max-[712px]:grid-cols-[4.4em_minmax(0,1fr)_5.4em_calc(4.4em+10px)_minmax(0,1fr)_5.4em] @max-[380px]:grid-cols-[4.4em_minmax(0,1fr)_5.4em]"
            pairClassName="@max-[712px]:pl-2.5 @max-[380px]:pl-0"
          />
        )}
      </div>
    </>
  );

  const rowClassName = cn(
    'relative flex flex-nowrap items-center gap-x-7 gap-y-2.5 rounded-lg border border-border bg-card py-2.5 pl-3 text-left @max-[712px]:flex-col @max-[712px]:items-stretch @max-[712px]:p-3',
    hasAction ? 'pr-16' : sorting ? 'pr-3' : 'pr-10',
  );

  if (sorting) {
    return (
      <div className={rowClassName}>
        {content}
        {hasAction && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2 @max-[712px]:top-1.5 @max-[712px]:right-1.5 @max-[712px]:translate-y-0">
            {action}
          </div>
        )}
      </div>
    );
  }

  return (
    // 連結名稱只放角色名稱:整列內容都當名稱時螢幕閱讀器每列要念上百字;進度改用 aria-describedby 補在名稱之後
    <Link
      to={ROUTES.character}
      onClick={() => setActiveCharacter(character.id)}
      aria-label={`${character.name},進入角色頁`}
      aria-describedby={progressId}
      className={cn(
        rowClassName,
        'transition-colors hover:border-ring hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {content}
      <span id={progressId} className="sr-only">
        {describeBoardRowProgress(cycles)};{weaponsEmpty ? '尚未設定武器進度' : `武器進度：${describeWeaponRows(weaponRows)}`}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground opacity-50 @max-[712px]:top-3.5 @max-[712px]:translate-y-0"
      />
    </Link>
  );
}
