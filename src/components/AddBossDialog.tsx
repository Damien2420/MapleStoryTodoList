import { useMemo, useState } from 'react';
import { ArrowLeft, Gem, Plus } from 'lucide-react';
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
import { VipBossCatalogPicker } from '@/components/VipBossCatalogPicker';
import { buildTrackedGroupKeys, countTrackedWeeklyBosses, findBossCatalogEntry, flattenBossSelections } from '@/lib/bossCatalog';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import {
  buildTrackedVipGroupKeys,
  buildVipSelectionKey,
  countTrackedVipBossesByLevel,
  hasVipTicketAllocation,
  parseVipSelectionKey,
  VIP_TICKET_LEVEL_LABELS,
} from '@/lib/vipBossCatalog';
import { cn } from '@/lib/utils';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { BossDifficulty, VipTicketLevel } from '@/types';

interface AddBossDialogProps {
  characterId: string;
}

type Step = 'pick' | 'vip' | 'vip-confirm';

/**
 * 新增BOSS對話框:一般BOSS與VIP重置BOSS是兩條互斥路徑,同一個對話框依 step 切換畫面。
 * pick(一般BOSS勾選,含「新增VIP重置BOSS」入口)→ vip(VIP券等級勾選)→ vip-confirm(確認清單,按下確認才真正套用)→ 關閉整個對話框。
 */
export function AddBossDialog({ characterId }: AddBossDialogProps) {
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const addBosses = useBossStore((s) => s.addBosses);
  const addVipBosses = useBossStore((s) => s.addVipBosses);
  const bosses = useBossStore((s) => s.bosses);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('pick');
  const [selections, setSelections] = useState<Map<string, Set<BossDifficulty>>>(new Map());
  const [vipSelections, setVipSelections] = useState<Set<string>>(new Set());

  // 該角色已追蹤的互斥群組鍵,對話框中整群鎖住避免建立同週期重複紀錄
  const trackedGroupKeys = useMemo(() => buildTrackedGroupKeys(bosses, characterId), [bosses, characterId]);
  // 該角色已追蹤且計入每週上限的筆數,與對話框內勾選數合計判斷 12 筆上限
  const trackedWeeklyCount = useMemo(() => countTrackedWeeklyBosses(bosses, characterId), [bosses, characterId]);
  const trackedVipGroupKeys = useMemo(() => buildTrackedVipGroupKeys(bosses, characterId), [bosses, characterId]);
  const trackedVipCountsByLevel = useMemo(
    () => countTrackedVipBossesByLevel(bosses, characterId),
    [bosses, characterId],
  );

  function resetForm() {
    setSelections(new Map());
    setVipSelections(new Set());
    setStep('pick');
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

  function handleToggleVip(level: VipTicketLevel, bossCatalogId: string, difficulty: BossDifficulty) {
    setVipSelections((prev) => {
      const next = new Set(prev);
      const key = buildVipSelectionKey(level, bossCatalogId, difficulty);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const flatSelections = flattenBossSelections(selections);
  const flatVipSelections = Array.from(vipSelections, (key) => parseVipSelectionKey(key));

  function handleSubmit() {
    if (flatSelections.length === 0) return;
    addBosses(characterId, flatSelections);
    resetForm();
    setOpen(false);
  }

  function handleVipReview() {
    if (flatVipSelections.length === 0) return;
    setStep('vip-confirm');
  }

  function handleConfirmAddVip() {
    if (flatVipSelections.length === 0) return;
    addVipBosses(characterId, flatVipSelections);
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
          <span className="max-[400px]:sr-only">新增BOSS</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl sm:max-h-fit">
        {step === 'pick' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增BOSS</DialogTitle>
              <DialogDescription>勾選要追蹤的王與難度，一次可套用多隻、多難度。</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2">
              <WeeklyBossLimitHint selections={selections} trackedWeeklyCount={trackedWeeklyCount} />
              {hasVipTicketAllocation(character?.vipTier) && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setStep('vip')}>
                  <Gem className="size-4" />
                  新增VIP重置BOSS
                </Button>
              )}
            </div>

            <BossCatalogPicker
              selections={selections}
              onToggleDifficulty={handleToggleDifficulty}
              trackedGroupKeys={trackedGroupKeys}
              trackedWeeklyCount={trackedWeeklyCount}
            />

            <DialogFooter>
              <Button type="button" className="w-full" disabled={flatSelections.length === 0} onClick={handleSubmit}>
                套用所選BOSS({flatSelections.length})
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'vip' && character && hasVipTicketAllocation(character.vipTier) && (
          <div className="space-y-4">
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1.5 self-start text-muted-foreground hover:text-foreground"
                onClick={() => setStep('pick')}
              >
                <ArrowLeft className="size-4" />
                返回選擇BOSS
              </Button>
              <DialogTitle>新增VIP重置BOSS</DialogTitle>
              <DialogDescription>使用VIP重置券額外攻略指定的BOSS，依券等級分組，只能根據重置卷張數最大數量選擇BOSS。</DialogDescription>
            </DialogHeader>

            <div className="max-h-[50vh] overflow-y-auto pr-1">
              <VipBossCatalogPicker
                vipTier={character.vipTier}
                selections={vipSelections}
                onToggle={handleToggleVip}
                trackedGroupKeys={trackedVipGroupKeys}
                trackedCountsByLevel={trackedVipCountsByLevel}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                className="w-full"
                disabled={flatVipSelections.length === 0}
                onClick={handleVipReview}
              >
                套用所選VIP重置BOSS({flatVipSelections.length})
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'vip-confirm' && (
          <div className="space-y-4">
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1.5 self-start text-muted-foreground hover:text-foreground"
                onClick={() => setStep('vip')}
              >
                <ArrowLeft className="size-4" />
                返回選擇VIP重置卷BOSS
              </Button>
              <DialogTitle>確認新增VIP重置BOSS</DialogTitle>
              <DialogDescription>將新增以下VIP重置卷BOSS，請確認以下清單。</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {flatVipSelections.map(({ ticketLevel, bossCatalogId, difficulty }, index) => (
                <div key={index} className="flex flex-col gap-1 px-3 py-2.5">
                  <span className="text-xs text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[ticketLevel]}</span>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{findBossCatalogEntry(bossCatalogId)?.name ?? bossCatalogId}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-normal',
                        DIFFICULTY_BADGE_CLASSES[difficulty],
                      )}
                    >
                      {difficulty}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" className="w-full" onClick={handleConfirmAddVip}>
                確認新增
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
