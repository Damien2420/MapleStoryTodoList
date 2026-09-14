import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { VIP_TIER_LABELS } from '@/lib/vipBossCatalog';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Character, VipTier } from '@/types';

interface VipTierDialogProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VIP_TIER_OPTIONS: { value: VipTier; label: string }[] = [
  { value: 'diamond', label: VIP_TIER_LABELS.diamond },
  { value: 'royal', label: VIP_TIER_LABELS.royal },
];

/**
 * VIP等級設定彈窗:只有鑽石/皇家兩個選項(不含「無」),所有角色預設都是無VIP。
 * 這個欄位不會顯示在角色卡片或清單任何地方,只有重新打開這個彈窗才看得到目前設定。
 */
export function VipTierDialog({ character, open, onOpenChange }: VipTierDialogProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const [selected, setSelected] = useState<VipTier | undefined>(character.vipTier);

  function handleOpenChange(next: boolean) {
    if (next) setSelected(character.vipTier);
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!selected) return;
    updateCharacter(character.id, { vipTier: selected });
    toast(`已將「${character.name}」設定為${VIP_TIER_OPTIONS.find((o) => o.value === selected)?.label}`);
    onOpenChange(false);
  }

  function handleRemove() {
    updateCharacter(character.id, { vipTier: undefined });
    toast(`已移除「${character.name}」的VIP資格`);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>設定VIP等級</AlertDialogTitle>
          <AlertDialogDescription>
            選擇「{character.name}」的VIP會員等級,可額外用VIP重置券重置指定的BOSS。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex gap-2">
          {VIP_TIER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                selected === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-muted/60',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={cn('flex flex-col-reverse gap-2 sm:flex-row', character.vipTier ? 'sm:justify-between' : 'sm:justify-end')}>
          {character.vipTier && (
            <Button type="button" variant="destructive" onClick={handleRemove}>
              移除VIP資格
            </Button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction disabled={!selected} onClick={handleConfirm}>
              確定
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
