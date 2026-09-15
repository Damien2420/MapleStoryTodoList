import { useEffect, useState } from 'react';
import { ArrowLeft, CircleCheckBig, CircleX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import { cn } from '@/lib/utils';
import {
  getVipAllocation,
  hasVipTicketAllocation,
  VIP_TICKET_LEVEL_LABELS,
  VIP_TICKET_LEVELS,
  VIP_TIER_BADGE_CLASSES,
  VIP_TIER_LABELS,
} from '@/lib/vipBossCatalog';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Character, CharacterBossTrackList, VipTicketLevel, VipTier } from '@/types';

interface VipTierDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'pick' | 'select-keep' | 'confirm' | 'remove-confirm';

/** 單一券等級的「配額不夠、需要使用者選擇保留哪些」分組 */
interface OverflowGroup {
  level: VipTicketLevel;
  cap: number;
  bosses: CharacterBossTrackList[];
}

const VIP_TIER_OPTIONS: { value: VipTier; label: string }[] = [
  { value: 'gold', label: VIP_TIER_LABELS.gold },
  { value: 'diamond', label: VIP_TIER_LABELS.diamond },
  { value: 'royal', label: VIP_TIER_LABELS.royal },
  { value: 'royalBlack', label: VIP_TIER_LABELS.royalBlack },
];

/** 選等級按鈕未選中時的 hover 外框顏色,比照該等級的VIP Badge底色 */
const VIP_TIER_HOVER_BORDER_CLASSES: Record<VipTier, string> = {
  gold: 'hover:border-vip-gold',
  diamond: 'hover:border-vip-diamond',
  royal: 'hover:border-vip-royal',
  royalBlack: 'hover:border-vip-royal-black',
};

/**
 * VIP等級設定彈窗:依序提供金牌/鑽石/皇家/皇家黑四個選項，所有角色預設都是無VIP。
 * 金牌與皇家黑純粹是顯示用等級，沒有額外的VIP重置券配額(皇家黑比照皇家)。
 *
 * 降級或移除VIP時，若目前追蹤中的VIP BOSS數量超過新等級的重置券配額，會套用以下動作:
 * 1. select-keep:列出配額不夠的券等級，讓使用者勾選要保留哪些BOSS(不可超過新上限)
 * 2. confirm:顯示最終會保留的完整清單與將被移除的數量,確認後才真的套用
 * 移除VIP資格時，若該角色目前有追蹤中的VIP BOSS，則改進 remove-confirm 提示使用者會清空，確認後才移除。
 * 選的等級跟目前相同、或新等級配額足夠時，維持原本「選了就套用」的單步驟行為。
 */
export function VipTierDialog({ character, open, onOpenChange }: VipTierDialogProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const bosses = useBossStore((s) => s.bosses);
  const removeBossesByIds = useBossStore((s) => s.removeBossesByIds);

  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<VipTier | undefined>(character.vipTier);
  const [pendingTier, setPendingTier] = useState<VipTier | undefined>(undefined);
  const [overflowGroups, setOverflowGroups] = useState<OverflowGroup[]>([]);
  const [keepSelections, setKeepSelections] = useState<Set<string>>(new Set());

  // 對話框的 open 是外部(角色卡片按鈕)直接控制的 prop,不是透過這個元件自己觸發關閉再打開,
  // 所以不能只在 onOpenChange callback 裡重置狀態(那只有 Radix 內部觸發關閉時才會呼叫到)。
  // 改用 React 官方建議的「render 期間依 prop 變化調整 state」寫法(而非 useEffect),
  // 追蹤上一次的 open 值,只要偵測到 false → true 就在這次 render 裡重置所有步驟狀態。
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep('pick');
      setSelected(character.vipTier);
      setPendingTier(undefined);
      setOverflowGroups([]);
      setKeepSelections(new Set());
    }
  }

  function trackedVipBosses(): CharacterBossTrackList[] {
    return bosses.filter((b) => b.characterId === character.id && b.category === 'vip' && b.vipTicketLevel);
  }

  function computeOverflowGroups(tier: VipTier): OverflowGroup[] {
    const allocation = getVipAllocation(tier);
    const tracked = trackedVipBosses();
    return VIP_TICKET_LEVELS.map((level) => ({
      level,
      cap: allocation[level],
      bosses: tracked.filter((b) => b.vipTicketLevel === level),
    })).filter((group) => group.bosses.length > group.cap);
  }

  function applyTierChange(tier: VipTier, removeIds: string[]) {
    if (removeIds.length > 0) removeBossesByIds(removeIds);
    updateCharacter(character.id, { vipTier: tier });
    toast(`已將「${character.name}」設定為${VIP_TIER_LABELS[tier]}`);
    onOpenChange(false);
  }

  function handleConfirmPick() {
    if (!selected) return;
    if (selected === character.vipTier) {
      onOpenChange(false);
      return;
    }
    const overflow = computeOverflowGroups(selected);
    if (overflow.length === 0) {
      applyTierChange(selected, []);
      return;
    }
    setPendingTier(selected);
    setOverflowGroups(overflow);
    setKeepSelections(new Set());
    // 新等級完全沒有重置券配額(例如金牌)時,不保留任何BOSS,直接跳過選擇畫面進確認畫面
    setStep(hasVipTicketAllocation(selected) ? 'select-keep' : 'confirm');
  }

  function handleRemoveClick() {
    if (trackedVipBosses().length === 0) {
      updateCharacter(character.id, { vipTier: undefined });
      toast(`已移除「${character.name}」的VIP資格`);
      onOpenChange(false);
      return;
    }
    setStep('remove-confirm');
  }

  function handleConfirmRemove() {
    const ids = trackedVipBosses().map((b) => b.id);
    removeBossesByIds(ids);
    updateCharacter(character.id, { vipTier: undefined });
    toast(`已移除「${character.name}」的VIP資格,並清除 ${ids.length} 筆VIP重置紀錄`);
    onOpenChange(false);
  }

  function toggleKeep(bossId: string) {
    setKeepSelections((prev) => {
      const next = new Set(prev);
      if (next.has(bossId)) next.delete(bossId);
      else next.add(bossId);
      return next;
    });
  }

  /** 最終會保留的VIP BOSS:配額足夠的等級(不在 overflowGroups 裡)全部保留 + overflow 等級裡使用者勾選保留的 */
  function finalKeptBosses(): CharacterBossTrackList[] {
    const overflowBossIds = new Set(overflowGroups.flatMap((g) => g.bosses.map((b) => b.id)));
    const autoKept = trackedVipBosses().filter((b) => !overflowBossIds.has(b.id));
    const manuallyKept = overflowGroups.flatMap((g) => g.bosses.filter((b) => keepSelections.has(b.id)));
    return [...autoKept, ...manuallyKept];
  }

  function handleConfirmApply() {
    if (!pendingTier) return;
    const keptIds = new Set(finalKeptBosses().map((b) => b.id));
    const removeIds = trackedVipBosses()
      .filter((b) => !keptIds.has(b.id))
      .map((b) => b.id);
    applyTierChange(pendingTier, removeIds);
  }

  const keptBosses = finalKeptBosses();
  const keptIds = new Set(keptBosses.map((b) => b.id));
  const removedBosses = trackedVipBosses().filter((b) => !keptIds.has(b.id));

  // 「選擇要保留的BOSS」跟「移除VIP資格確認」必須按下畫面上的按鈕才能離開,不能用 ESC 或點擊對話框外部直接關閉。
  const isDismissLocked = step === 'select-keep' || step === 'remove-confirm';

  // Radix 的 DismissableLayer 本身也是在 document capture 階段監聽 Escape 才呼叫這個 callback
  // 一旦被其他也監聽 keydown 的程式碼搶先攔截，callback 就完全不會執行
  // 因此改成在 window capture 階段搶先攔截、用 stopImmediatePropagation 直接吃掉事件，確保視窗不會被 Esc 關閉。
  useEffect(() => {
    if (!open) return;
    function handleWindowKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDismissLocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
  }, [open, isDismissLocked]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isDismissLocked}
        onPointerDownOutside={(e) => {
          if (isDismissLocked) e.preventDefault();
        }}
      >
        {step === 'pick' && (
          <>
            <DialogHeader>
              <DialogTitle>設定VIP等級</DialogTitle>
              <DialogDescription>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              {VIP_TIER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelected(option.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected === option.value
                      ? VIP_TIER_BADGE_CLASSES[option.value]
                      : cn('border-input text-muted-foreground hover:bg-muted/60', VIP_TIER_HOVER_BORDER_CLASSES[option.value]),
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row', character.vipTier ? 'sm:justify-between' : 'sm:justify-end')}>
              {character.vipTier && (
                <Button type="button" variant="destructive" onClick={handleRemoveClick}>
                  移除VIP
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="button" disabled={!selected} onClick={handleConfirmPick}>
                  確定
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'select-keep' && pendingTier && (
          <>
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit gap-1.5 self-start text-muted-foreground hover:text-foreground"
                onClick={() => setStep('pick')}
              >
                <ArrowLeft className="size-4" />
                返回選擇等級
              </Button>
              <DialogTitle>選擇要保留的BOSS</DialogTitle>
              <DialogDescription>
                改成{VIP_TIER_LABELS[pendingTier]}後，
                以下等級的重置券數量不夠涵蓋目前追蹤中的BOSS，請選擇要保留哪些。
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
              {overflowGroups.filter((group) => group.cap > 0).map((group) => {
                const keptCount = group.bosses.filter((b) => keepSelections.has(b.id)).length;
                return (
                  <div key={group.level} className="flex flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[group.level]}</span>
                      <Badge variant={keptCount >= group.cap ? 'default' : 'outline'} className="tabular-nums">
                        ({keptCount}/{group.cap})
                      </Badge>
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {group.bosses.map((boss) => {
                        const checked = keepSelections.has(boss.id);
                        const disabled = !checked && keptCount >= group.cap;
                        return (
                          <label
                            key={boss.id}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                              checked ? 'border-primary bg-primary/5' : 'border-border',
                              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                            )}
                          >
                            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleKeep(boss.id)} />
                            <span className="flex-1">{boss.bossName}</span>
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-normal', DIFFICULTY_BADGE_CLASSES[boss.difficulty])}>
                              {boss.difficulty}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" onClick={() => setStep('confirm')}>
                下一步
              </Button>
            </div>
          </>
        )}

        {step === 'confirm' && pendingTier && (
          <>
            <DialogHeader>
              <DialogTitle>確認變更VIP等級</DialogTitle>
              <DialogDescription>
                「{character.name}」的VIP等級將變更為{VIP_TIER_LABELS[pendingTier]}，以下是變更後的追蹤清單。
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
              {keptBosses.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-cycle-weekly/40 bg-cycle-weekly/20 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-cycle-weekly-foreground">
                      <CircleCheckBig className="size-4" />
                      保留
                    </span>
                    <span className="rounded-full bg-cycle-weekly-foreground/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-cycle-weekly-foreground">
                      {keptBosses.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {VIP_TICKET_LEVELS.filter((level) => keptBosses.some((b) => b.vipTicketLevel === level)).map((level) => (
                      <div key={level} className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[level]}</span>
                        <div className="flex flex-col gap-1.5">
                          {keptBosses
                            .filter((boss) => boss.vipTicketLevel === level)
                            .map((boss) => (
                              <div
                                key={boss.id}
                                className="flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm"
                              >
                                <CircleCheckBig className="size-4 shrink-0 text-cycle-weekly-foreground" />
                                <span className="flex-1">{boss.bossName}</span>
                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-normal', DIFFICULTY_BADGE_CLASSES[boss.difficulty])}>
                                  {boss.difficulty}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {removedBosses.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                      <CircleX className="size-4" />
                      移除
                    </span>
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-destructive">
                      {removedBosses.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {removedBosses.map((boss) => (
                      <div
                        key={boss.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm"
                      >
                        <CircleX className="size-4 shrink-0 text-destructive" />
                        <span className="flex-1 text-muted-foreground">{boss.bossName}</span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-normal', DIFFICULTY_BADGE_CLASSES[boss.difficulty])}>
                          {boss.difficulty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(hasVipTicketAllocation(pendingTier) ? 'select-keep' : 'pick')}
              >
                上一步
              </Button>
              <Button type="button" onClick={handleConfirmApply}>
                確認
              </Button>
            </div>
          </>
        )}

        {step === 'remove-confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>移除VIP資格</DialogTitle>
              <DialogDescription>
                移除「{character.name}」的VIP資格將清除目前VIP重置區域的所有BOSS(共 {trackedVipBosses().length} 隻),此動作無法復原。
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmRemove}>
                確認移除
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
