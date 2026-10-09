import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { Trash2Icon } from './ui/trash-2-icon';
import { RefreshCWIcon } from './ui/refresh-cw';
import { PencilIcon } from './ui/pencil-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VIP_TIER_BADGE_CLASSES, VIP_TIER_LABELS } from '@/lib/vipBossCatalog';
import { VIP_TIER_ICONS } from '@/lib/vipTierIcons';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
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
import { CharacterHeaderCollapsed } from '@/components/CharacterHeaderCollapsed';
import { DashboardSummary } from '@/components/DashboardSummary';
import { CharacterUpdateDialog } from '@/components/CharacterUpdateDialog';
import { WeaponDialog } from '@/components/weapon/WeaponDialog';
import { WeaponEntryPanel } from '@/components/weapon/WeaponEntryPanel';
import { useWeaponProgress } from '@/hooks/useWeaponProgress';
import { useCharacterCycles } from '@/hooks/useCharacterCycles';
import { useDeleteCharacter } from '@/hooks/useDeleteCharacter';
import { useHeaderExpanded } from '@/hooks/useHeaderExpanded';
import { useLayoutMorph } from '@/hooks/useLayoutMorph';
import { hasAnyTrackedCycle } from '@/lib/characterSummary';
import type { JumpList } from '@/lib/listJump';
import { useAccountStore } from '@/store/useAccountStore';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { Character } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/** Trash2Icon/RefreshCWIcon/PencilIcon 共用的動畫控制 handle 形狀,用來在 hover 到外層 Button 時手動觸發圖示動畫 */
interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/**
 * 角色身份橫帶:可展開/收合。展開時為原本的排版(立繪+名稱/伺服器/等級/職業,右側併入週期卡與收益摘要);
 * 收合時為精簡身分列加週期跳轉磚與收益列。切換由卡片底部的抽屜把手觸發,狀態所有角色共用並存在這台裝置。
 * 兩種排版都提供更新/刪除角色入口。
 * @param character 目前的角色
 * @param onJump 點擊週期卡(展開版)或跳轉磚(收合版)時呼叫,由 CharacterPage 負責切換清單分頁與捲動
 */
export function CharacterHeader({
  character,
  onJump,
}: {
  character: Character;
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
}) {
  const account = useAccountStore((s) => s.accounts.find((a) => a.id === character.accountId));
  const deleteCharacter = useDeleteCharacter();
  const navigate = useNavigate();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [weaponDialogOpen, setWeaponDialogOpen] = useState(false);
  const weaponProgress = useWeaponProgress(character);
  const updateLabel = character.source === 'api' ? '更新角色資料' : '編輯角色資料';
  const UpdateIcon = character.source === 'api' ? RefreshCWIcon : PencilIcon;
  // VIP 屬於帳號,角色頁只顯示所屬帳號的等級;未歸類的角色沒有 VIP
  const vipTier = account?.vipTier;
  const vipTierIconSrc = vipTier && VIP_TIER_ICONS[vipTier];

  const [expanded, toggleExpanded] = useHeaderExpanded();
  const { summary, urgency } = useCharacterCycles(character);
  const hasCycles = hasAnyTrackedCycle(summary);
  const { shellRef, capture } = useLayoutMorph(expanded);
  const panelId = useId();

  // 圖示元件預設只在滑鼠停在圖示本身(很小的範圍)時觸發動畫,這裡改用 ref 手動控制,
  // 讓滑鼠停在整個按鈕範圍就能觸發;展開版手機按鈕與圖示按鈕組(展開版桌面/收合版)是各自獨立的元件實例,各需一組 ref。
  const mobileUpdateIconRef = useRef<AnimatedIconHandle>(null);
  const mobileDeleteIconRef = useRef<AnimatedIconHandle>(null);
  const desktopUpdateIconRef = useRef<AnimatedIconHandle>(null);
  const desktopDeleteIconRef = useRef<AnimatedIconHandle>(null);

  function handleDeleteCharacter() {
    deleteCharacter(character.id);
    setDeleteConfirmOpen(false);
    // 刪除後回到看板:留在角色頁會直接跳到另一隻角色,容易讓人以為刪錯了
    navigate(ROUTES.root);
    toast(`已刪除「${character.name}」`);
  }

  function handleToggle() {
    if (!capture(expanded ? 'collapse' : 'expand')) return;
    toggleExpanded();
  }

  // 圖示按鈕組:展開版放在桌面右上角,收合版手機橫排、桌面右上角;兩種排版不會同時存在,共用同一組 ref
  const iconActions = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`${updateLabel}:${character.name}`}
            onClick={() => setUpdateDialogOpen(true)}
            onMouseEnter={() => desktopUpdateIconRef.current?.startAnimation()}
            onMouseLeave={() => desktopUpdateIconRef.current?.stopAnimation()}
          >
            <UpdateIcon ref={desktopUpdateIconRef} size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{updateLabel}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`刪除角色:${character.name}`}
            onClick={() => setDeleteConfirmOpen(true)}
            onMouseEnter={() => desktopDeleteIconRef.current?.startAnimation()}
            onMouseLeave={() => desktopDeleteIconRef.current?.stopAnimation()}
          >
            <Trash2Icon ref={desktopDeleteIconRef} size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>刪除角色</p>
        </TooltipContent>
      </Tooltip>
    </>
  );

  // 武器進度入口:兩種排版共用同一個實例的資料,點擊開啟武器管理視窗
  const weaponEntry = <WeaponEntryPanel progress={weaponProgress} onOpen={() => setWeaponDialogOpen(true)} />;

  const expandedLayout = (
    <div data-morph-layer className="relative flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-6">
      {/* 手機:身分列與入口上下排在週期卡上方;桌面:左欄為「身分列 + 入口」,固定 300px */}
      <div className="flex min-w-0 flex-col gap-3 lg:w-[300px] lg:shrink-0">
      <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-normal">
        <div className="flex min-w-0 items-center gap-3 lg:gap-4">
          {character.imageUrl && (
            <img
              data-morph="avatar"
              src={character.imageUrl}
              alt={character.name}
              className="aspect-square h-16 w-16 shrink-0 rounded-xl bg-muted object-contain lg:h-20 lg:w-20"
            />
          )}
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex min-w-0 flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-2">
              <h1 data-morph="name" className="max-w-full truncate text-lg font-semibold text-foreground" title={character.name}>
                {character.name}
              </h1>
              {vipTier && vipTierIconSrc && (
                <Badge variant="secondary" className={cn('shrink-0 rounded-sm', VIP_TIER_BADGE_CLASSES[vipTier])}>
                  <img src={vipTierIconSrc} alt="" className="size-3" />
                  {VIP_TIER_LABELS[vipTier]}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {character.server} · Lv.{character.level}
              {character.job && ` · ${character.job}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 max-[560px]:flex-col lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground max-[560px]:w-8 max-[560px]:px-0"
            aria-label={`${updateLabel}:${character.name}`}
            onClick={() => setUpdateDialogOpen(true)}
            onMouseEnter={() => mobileUpdateIconRef.current?.startAnimation()}
            onMouseLeave={() => mobileUpdateIconRef.current?.stopAnimation()}
          >
            <UpdateIcon ref={mobileUpdateIconRef} size={16} />
            <span className="max-[560px]:hidden">{updateLabel}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive max-[560px]:w-8 max-[560px]:px-0"
            aria-label={`刪除角色:${character.name}`}
            onClick={() => setDeleteConfirmOpen(true)}
            onMouseEnter={() => mobileDeleteIconRef.current?.startAnimation()}
            onMouseLeave={() => mobileDeleteIconRef.current?.stopAnimation()}
          >
            <Trash2Icon ref={mobileDeleteIconRef} size={16} />
            <span className="max-[560px]:hidden">刪除角色</span>
          </Button>
        </div>
      </div>
      {weaponEntry}
      </div>

      <DashboardSummary
        character={character}
        onJump={onJump}
        className="min-w-0 flex-1 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pr-8 lg:pl-6"
      />

      <div className="absolute top-2 right-2 hidden flex-col items-center gap-1 lg:flex">{iconActions}</div>
    </div>
  );

  return (
    // mb-2 加上 CharacterPage 的 gap-6,讓 Header 與備份列之間有 32px,底部垂下的把手不會貼住備份列
    <div className="relative mb-2">
      <div ref={shellRef} id={panelId} className="relative overflow-hidden rounded-lg border border-border bg-card">
        {expanded ? (
          // key 讓 React 在兩種排版切換時換掉整棵子樹,useLayoutMorph 才找得到新排版的 data-morph-layer
          <div key="expanded" className="contents">
            {expandedLayout}
          </div>
        ) : (
          <CharacterHeaderCollapsed
            key="collapsed"
            character={character}
            vipTier={vipTier}
            summary={summary}
            urgency={urgency}
            onJump={onJump}
            weaponEntry={weaponEntry}
            actions={
              <div className="flex shrink-0 items-center gap-0.5 lg:absolute lg:top-2 lg:right-2 lg:flex-col lg:gap-1">
                {iconActions}
              </div>
            }
          />
        )}
      </div>

      {hasCycles && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? '收合角色摘要' : '展開角色摘要'}
          className="absolute top-full left-1/2 z-10 -mt-px flex h-5 w-12 -translate-x-1/2 items-center justify-center rounded-b-md border border-t-0 border-border bg-card text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3 pointer-coarse:after:content-['']"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
          />
        </button>
      )}

      <CharacterUpdateDialog character={character} open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />

      {/* key:切換角色時重新建立,預設 Tab 依新角色的進度決定 */}
      <WeaponDialog
        key={character.id}
        character={character}
        progress={weaponProgress}
        open={weaponDialogOpen}
        onOpenChange={setWeaponDialogOpen}
        onJump={onJump}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{character.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作無法還原,將會刪除此角色以及底下所有任務與 BOSS 的進度紀錄。同步後，其他裝置上的這個角色也會一併刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteCharacter}>
              刪除角色
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
