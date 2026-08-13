import { useRef, useState } from 'react';
import { Trash2Icon } from './ui/trash-2-icon';
import { RefreshCWIcon } from './ui/refresh-cw';
import { PencilIcon } from './ui/pencil-icon';
import { Button } from '@/components/ui/button';
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
import { DashboardSummary } from '@/components/DashboardSummary';
import { CharacterUpdateDialog } from '@/components/CharacterUpdateDialog';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import type { Character } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/** Trash2Icon/RefreshCWIcon/PencilIcon 共用的動畫控制 handle 形狀,用來在 hover 到外層 Button 時手動觸發圖示動畫 */
interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/** 角色身份橫帶:左側立繪+名稱/伺服器/等級/職業,右側併入任務進度與 BOSS 收益摘要,並提供更新/刪除角色入口 */
export function CharacterHeader({ character }: { character: Character }) {
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const removeBossesForCharacter = useBossStore((s) => s.removeBossesForCharacter);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const updateLabel = character.source === 'api' ? '更新角色資料' : '編輯角色資料';
  const UpdateIcon = character.source === 'api' ? RefreshCWIcon : PencilIcon;

  // 圖示元件預設只在滑鼠停在圖示本身(很小的範圍)時觸發動畫,這裡改用 ref 手動控制,
  // 讓滑鼠停在整個按鈕範圍就能觸發;手機/桌機版是各自獨立的元件實例,各需一組 ref。
  const mobileUpdateIconRef = useRef<AnimatedIconHandle>(null);
  const mobileDeleteIconRef = useRef<AnimatedIconHandle>(null);
  const desktopUpdateIconRef = useRef<AnimatedIconHandle>(null);
  const desktopDeleteIconRef = useRef<AnimatedIconHandle>(null);

  function handleDeleteCharacter() {
    removeTasksForCharacter(character.id);
    removeBossesForCharacter(character.id);
    removeCharacter(character.id);
    setDeleteConfirmOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-center justify-between gap-3 lg:shrink-0 lg:justify-normal">
        <div className="flex min-w-0 items-center gap-3 lg:gap-4">
          {character.imageUrl && (
            <img
              src={character.imageUrl}
              alt={character.name}
              className="aspect-square h-16 w-16 shrink-0 rounded-xl bg-muted object-contain lg:h-20 lg:w-20"
            />
          )}
          <div className="min-w-0 flex flex-col gap-0.5">
            <h2 className="truncate text-lg font-semibold text-foreground" title={character.name}>
              {character.name}
            </h2>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>{character.server}</span>
              <span aria-hidden="true">·</span>
              <span>Lv.{character.level}</span>
              {character.job && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{character.job}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            aria-label={`${updateLabel}:${character.name}`}
            onClick={() => setUpdateDialogOpen(true)}
            onMouseEnter={() => mobileUpdateIconRef.current?.startAnimation()}
            onMouseLeave={() => mobileUpdateIconRef.current?.stopAnimation()}
          >
            <UpdateIcon ref={mobileUpdateIconRef} size={16} />
            {updateLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`刪除角色:${character.name}`}
            onClick={() => setDeleteConfirmOpen(true)}
            onMouseEnter={() => mobileDeleteIconRef.current?.startAnimation()}
            onMouseLeave={() => mobileDeleteIconRef.current?.stopAnimation()}
          >
            <Trash2Icon ref={mobileDeleteIconRef} size={16} />
            刪除角色
          </Button>
        </div>
      </div>

      <DashboardSummary
        character={character}
        className="min-w-0 flex-1 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pr-8 lg:pl-6"
      />

      <div className="absolute top-2 right-2 hidden items-center gap-1 lg:flex">
        <Tooltip>
          <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`${updateLabel}:${character.name}`}
                title={updateLabel}
                onClick={() => setUpdateDialogOpen(true)}
                onMouseEnter={() => desktopUpdateIconRef.current?.startAnimation()}
                onMouseLeave={() => desktopUpdateIconRef.current?.stopAnimation()}
              >
                <UpdateIcon ref={desktopUpdateIconRef} size={16} />
              </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>更新角色資料</p>
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
                title="刪除角色"
                onClick={() => setDeleteConfirmOpen(true)}
                onMouseEnter={() => desktopDeleteIconRef.current?.startAnimation()}
                onMouseLeave={() => desktopDeleteIconRef.current?.stopAnimation()}
              >
                <Trash2Icon ref={desktopDeleteIconRef} size={16} />
              </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>刪除角色資料</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <CharacterUpdateDialog character={character} open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{character.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作無法還原,將會刪除此角色以及底下所有任務與 BOSS 的進度紀錄。
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
