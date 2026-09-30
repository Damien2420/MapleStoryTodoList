import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Gem, Info, Plus, Swords } from 'lucide-react';
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
import { ConfirmListSection } from '@/components/ConfirmListSection';
import { VipBossCatalogPicker } from '@/components/VipBossCatalogPicker';
import { VipTicketIcon } from '@/components/VipTicketIcon';
import { BossSelectionPreview } from '@/components/BossSelectionPreview';
import { buildTrackedGroupKeys, countTrackedWeeklyBosses, findBossCatalogEntry, flattenBossSelections } from '@/lib/bossCatalog';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import {
  buildVipSelectionKey,
  countTrackedVipBossesByLevelForCharacters,
  hasVipTicketAllocation,
  parseVipSelectionKey,
  VIP_TICKET_LEVEL_LABELS,
  VIP_TIER_LABELS,
} from '@/lib/vipBossCatalog';
import { cn } from '@/lib/utils';
import { focusDialogContainer } from '@/lib/dialogFocus';
import { useAccountStore } from '@/store/useAccountStore';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Account, BossDifficulty, VipTicketLevel } from '@/types';

interface AddBossDialogProps {
  characterId: string;
}

type Step = 'pick' | 'confirm' | 'vip' | 'vip-confirm';

/**
 * 沒有 VIP 重置券可用時,告訴使用者原因與下一步;顯示在原本「新增VIP重置BOSS」按鈕的位置。
 * @param account 角色所屬的帳號;未歸類為 undefined
 * @returns 說明文字(依「沒有帳號」「帳號沒設定 VIP」「VIP 等級本身沒有重置券」三種情況)
 */
function getVipUnavailableReason(account: Account | undefined): string {
  if (!account) return '將角色加入帳號並設定 VIP 等級後，即可新增 VIP 重置 BOSS';
  if (!account.vipTier) return '在總覽頁面為此帳號設定 VIP 等級後，即可新增 VIP 重置 BOSS';
  return `「${account.name}」目前的 ${VIP_TIER_LABELS[account.vipTier]} 等級沒有 VIP 重置券`;
}

/**
 * 新增BOSS對話框:一般BOSS與VIP重置BOSS是兩條互斥路徑,同一個對話框依 step 切換畫面。
 * 一般BOSS:pick(勾選,含「新增VIP重置BOSS」入口)→ confirm(確認清單,按下確認才真正套用)→ 關閉整個對話框。
 * VIP重置BOSS:pick → vip(VIP券等級勾選)→ vip-confirm(確認清單,按下確認才真正套用)→ 關閉整個對話框。
 * VIP 等級與重置券配額屬於角色所屬的帳號、由帳號內所有角色共用;某個券等級配額用完時,該等級未勾選的項目直接停用。
 */
export function AddBossDialog({ characterId }: AddBossDialogProps) {
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const characters = useCharacterStore((s) => s.characters);
  const account = useAccountStore((s) => s.accounts.find((a) => a.id === character?.accountId));
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
  // 配額是帳號共用的:用量要算帳號內所有角色,不只是目前這一隻
  const accountMembers = useMemo(
    () => (account ? characters.filter((c) => c.accountId === account.id) : []),
    [characters, account],
  );
  const trackedVipCountsByLevel = useMemo(
    () => countTrackedVipBossesByLevelForCharacters(bosses, new Set(accountMembers.map((c) => c.id))),
    [bosses, accountMembers],
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

  function handleReview() {
    if (flatSelections.length === 0) return;
    setStep('confirm');
  }

  function handleConfirm() {
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
      <DialogContent
        className={cn('sm:max-w-xl', (step === 'confirm' || step === 'vip-confirm') && 'flex flex-col')}
        onOpenAutoFocus={focusDialogContainer}
      >
        {step === 'pick' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增BOSS</DialogTitle>
              <DialogDescription>勾選要追蹤的王與難度，一次可套用多隻、多難度。</DialogDescription>
              {/* 沒有 VIP 時依照狀況顯示說明,獨立一行放在描述下,不跟上限徽章擠在同一列 */}
              {!hasVipTicketAllocation(account?.vipTier) && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {getVipUnavailableReason(account)}
                </p>
              )}
            </DialogHeader>

            {/* VIP 是切換到另一份清單的導覽,做成撐滿寬度的入口列,窄畫面也不會跟其他按鈕擠在一起 */}
            {hasVipTicketAllocation(account?.vipTier) && (
              <button
                type="button"
                onClick={() => setStep('vip')}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Gem className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-sm font-medium">新增VIP重置BOSS</span>
                  <span className="text-xs text-muted-foreground">追蹤目前帳號的 VIP 重置券額度</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            )}

            <BossCatalogPicker
              selections={selections}
              onToggleDifficulty={handleToggleDifficulty}
              trackedGroupKeys={trackedGroupKeys}
              trackedWeeklyCount={trackedWeeklyCount}
              toolbarEnd={<WeeklyBossLimitHint selections={selections} trackedWeeklyCount={trackedWeeklyCount} />}
            />

            <DialogFooter>
              <Button type="button" className="w-full" disabled={flatSelections.length === 0} onClick={handleReview}>
                套用所選BOSS({flatSelections.length})
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'vip' && account && hasVipTicketAllocation(account.vipTier) && (
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

            <VipBossCatalogPicker
              vipTier={account.vipTier}
              selections={vipSelections}
              onToggle={handleToggleVip}
              trackedCountsByLevel={trackedVipCountsByLevel}
            />

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

        {step === 'confirm' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogHeader>
              <DialogTitle>確認新增BOSS</DialogTitle>
              <DialogDescription>將新增以下BOSS，請確認以下清單。</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConfirmListSection
                icon={Swords}
                label="BOSS"
                count={flatSelections.length}
                unit="隻"
                onChange={() => setStep('pick')}
              >
                <BossSelectionPreview
                  selections={flatSelections}
                  className="max-h-none overflow-visible pr-0"
                  itemClassName="border-transparent bg-popover"
                />
              </ConfirmListSection>
            </div>

            <DialogFooter>
              <Button type="button" className="w-full" onClick={handleConfirm}>
                確認新增
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'vip-confirm' && (
          // 與新增角色的確認頁同一套版型:標題與按鈕固定,只有中間清單捲動;
          // 返回改由分區右上角的「變更」承擔,不再另放返回按鈕
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogHeader>
              <DialogTitle>確認新增VIP重置BOSS</DialogTitle>
              <DialogDescription>將新增以下VIP重置卷BOSS，請確認以下清單。</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConfirmListSection
                icon={Gem}
                label="VIP重置BOSS"
                count={flatVipSelections.length}
                unit="隻"
                onChange={() => setStep('vip')}
              >
                <div className="flex flex-col gap-1.5">
                  {flatVipSelections.map(({ ticketLevel, bossCatalogId, difficulty }, index) => (
                    <div key={index} className="flex flex-col gap-1 rounded-md bg-popover px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-vip-accent-text">
                        <VipTicketIcon level={ticketLevel} className="size-5" />
                        {VIP_TICKET_LEVEL_LABELS[ticketLevel]}
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {findBossCatalogEntry(bossCatalogId)?.name ?? bossCatalogId}
                        </span>
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
              </ConfirmListSection>
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
