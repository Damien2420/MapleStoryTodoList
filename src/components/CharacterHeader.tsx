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
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import type { Character } from '@/types';

/** 角色身份資訊列:名稱/伺服器/等級/職業 + 刪除角色入口,橫跨任務清單與 BOSS 清單上方 */
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
    <div className="flex items-center justify-between gap-3">
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`刪除角色:${character.name}`}
        onClick={() => setDeleteConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
        刪除角色
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
