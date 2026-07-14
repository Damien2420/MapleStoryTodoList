import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import type { Character } from '@/types';

/** 角色身份橫帶:左側立繪+名稱/伺服器/等級/職業,右側併入任務進度與 BOSS 收益摘要,並提供刪除角色入口 */
export function CharacterHeader({ character }: { character: Character }) {
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const removeBossesForCharacter = useBossStore((s) => s.removeBossesForCharacter);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:hidden"
          aria-label={`刪除角色:${character.name}`}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="size-4" />
          刪除角色
        </Button>
      </div>

      <DashboardSummary
        character={character}
        className="min-w-0 flex-1 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pr-8 lg:pl-6"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 hidden size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:inline-flex"
        aria-label={`刪除角色:${character.name}`}
        title="刪除角色"
        onClick={() => setDeleteConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

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
