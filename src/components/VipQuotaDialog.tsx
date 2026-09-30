import { useMemo } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { PickerCategoryStatus } from '@/components/PickerCategorySection';
import { VipTicketIcon } from '@/components/VipTicketIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { DIFFICULTY_BADGE_CLASSES } from '@/lib/difficultyBadge';
import { compareByOrder } from '@/lib/order';
import { getVipAllocation, VIP_TICKET_LEVEL_LABELS, VIP_TICKET_LEVELS } from '@/lib/vipBossCatalog';
import { cn } from '@/lib/utils';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Account } from '@/types';

interface VipQuotaDialogProps {
  account: Account;
  /** 帳號的重置券用量(已用/上限),由看板分組算好傳入 */
  quota: { used: number; cap: number };
}

/**
 * 視窗內容:依券等級列出每一格額度,用掉的格子顯示「哪隻角色、哪隻 BOSS、什麼難度」,沒用的格子畫成虛線空格。
 * 只在視窗打開時才 render(Radix 關閉時會卸載內容),所以角色與 BOSS 的 store 訂閱不會拖累看板頁。
 * @param props.account 所屬帳號,決定有哪些券等級與各自的額度
 * @param props.quota 帳號的重置券用量
 */
function VipQuotaContent({ account, quota }: VipQuotaDialogProps) {
  const characters = useCharacterStore((s) => s.characters);
  const bosses = useBossStore((s) => s.bosses);

  const allocation = getVipAllocation(account.vipTier);
  // allocation 來自常數表,同一個 vipTier 拿到的是同一個物件,所以可以當 memo 依賴
  const levels = useMemo(() => VIP_TICKET_LEVELS.filter((level) => allocation[level] > 0), [allocation]);

  // 每個券等級用掉的 BOSS,依角色顯示順序排列,同一角色內維持 BOSS 清單原本的順序
  const usesByLevel = useMemo(() => {
    const members = characters.filter((c) => c.accountId === account.id).sort(compareByOrder);
    return new Map(
      levels.map((level) => [
        level,
        members.flatMap((member) =>
          bosses
            .filter((b) => b.characterId === member.id && b.category === 'vip' && b.vipTicketLevel === level)
            .map((boss) => ({ boss, member })),
        ),
      ]),
    );
  }, [characters, bosses, account.id, levels]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>「{account.name}」的 VIP 重置券</DialogTitle>
        <DialogDescription>配額由帳號底下所有角色共用。</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          已使用 <b className="font-bold text-foreground tabular-nums">{quota.used}</b> / {quota.cap} 張
        </span>
        <Progress
          value={quota.cap > 0 ? Math.min(100, (quota.used / quota.cap) * 100) : 0}
          className="h-1.5 flex-1"
          indicatorClassName="bg-vip-accent-text"
          aria-label={`VIP 重置券已使用 ${quota.used}/${quota.cap}`}
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-muted px-2">
        {levels.map((level) => {
          const uses = usesByLevel.get(level) ?? [];
          const slotCount = Math.max(allocation[level], uses.length);
          return (
            <section key={level} className="not-first:border-t not-first:border-border">
              <div className="flex items-center gap-2 pt-2.5 pb-2">
                <VipTicketIcon level={level} />
                <h3 className="text-sm font-semibold text-vip-accent-text">{VIP_TICKET_LEVEL_LABELS[level]}</h3>
                <span className="ml-auto shrink-0">
                  <PickerCategoryStatus tone="muted">
                    {uses.length}/{allocation[level]}
                  </PickerCategoryStatus>
                </span>
              </div>
              <ul className="flex flex-col gap-1.5 pb-3">
                {Array.from({ length: slotCount }, (_, index) => {
                  const use = uses[index];
                  if (!use) {
                    return (
                      <li
                        key={`empty-${index}`}
                        className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
                      >
                        尚未使用
                      </li>
                    );
                  }
                  return (
                    <li
                      key={use.boss.id}
                      className="flex items-center justify-between gap-2.5 rounded-md bg-popover px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{use.boss.bossName}</span>
                        <span className="break-words text-xs text-muted-foreground">{use.member.name}</span>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-normal',
                          DIFFICULTY_BADGE_CLASSES[use.boss.difficulty],
                        )}
                      >
                        {use.boss.difficulty}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        想釋出名額，請到該角色的 BOSS 清單移除對應的 VIP 重置 BOSS。
      </p>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="w-full">
            關閉
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

/**
 * 總覽頁帳號 VIP 列上的「VIP 重置券 已用/上限」入口(自帶視窗):整段是一顆按鈕,尾端的箭頭表示可以點,
 * hover 時浮出灰底、箭頭往右推一點;點下去打開視窗,列出每個券等級被哪隻角色用在哪隻 BOSS、什麼難度。
 * 只給有配額的帳號使用,沒有配額(quota 為 undefined)的帳號由呼叫端不渲染。
 * @param props.account 所屬帳號
 * @param props.quota 帳號的重置券用量(已用/上限)
 */
export function VipQuotaDialog({ account, quota }: VipQuotaDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`查看 VIP 重置券使用狀況，已使用 ${quota.used} 張，共 ${quota.cap} 張`}
          className="-ml-0.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg py-1 pr-1.5 pl-2.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11 [&:hover_svg]:translate-x-0.5 [&:hover_svg]:text-foreground"
        >
          VIP 重置券
          <b className={cn('tabular-nums', quota.used >= quota.cap ? 'text-vip-accent-text' : 'text-foreground')}>
            {quota.used}/{quota.cap}
          </b>
          <Progress
            value={quota.cap > 0 ? Math.min(100, (quota.used / quota.cap) * 100) : 0}
            className="h-1 w-14"
            indicatorClassName="bg-vip-accent-text"
            aria-hidden="true"
          />
          <ChevronRight className="size-4 transition-transform" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <VipQuotaContent account={account} quota={quota} />
      </DialogContent>
    </Dialog>
  );
}
