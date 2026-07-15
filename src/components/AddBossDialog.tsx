import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BossCatalogPicker, WeeklyBossLimitHint } from '@/components/BossCatalogPicker';
import { flattenBossSelections } from '@/lib/bossCatalog';
import { useBossStore } from '@/store/useBossStore';
import type { BossDifficulty } from '@/types';

interface AddBossDialogProps {
  characterId: string;
}

/** 新增BOSS對話框:只能從 BOSS_CATALOG 勾選 + 選難度套用,一次可套用多隻、每隻可同時選多個難度 */
export function AddBossDialog({ characterId }: AddBossDialogProps) {
  const addBosses = useBossStore((s) => s.addBosses);
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<Map<string, Set<BossDifficulty>>>(new Map());

  function resetForm() {
    setSelections(new Map());
  }

  function handleToggleDifficulty(bossId: string, difficulty: BossDifficulty) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(bossId));
      if (set.has(difficulty)) set.delete(difficulty);
      else set.add(difficulty);
      if (set.size === 0) next.delete(bossId);
      else next.set(bossId, set);
      return next;
    });
  }

  const flatSelections = flattenBossSelections(selections);

  function handleSubmit() {
    if (flatSelections.length === 0) return;
    addBosses(characterId, flatSelections);
    resetForm();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" />
          新增BOSS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl sm:max-h-fit">
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>新增BOSS</DialogTitle>
            <DialogDescription>勾選要追蹤的王與難度,一次可套用多隻、多難度。</DialogDescription>
          </DialogHeader>

          <WeeklyBossLimitHint selections={selections} />

          <BossCatalogPicker selections={selections} onToggleDifficulty={handleToggleDifficulty} />

          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={flatSelections.length === 0}
              onClick={handleSubmit}
            >
              套用所選BOSS({flatSelections.length})
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
