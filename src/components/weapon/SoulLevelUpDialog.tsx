import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { soulAtGate, soulCostBetween, soulLevelUp } from '@/lib/weapon/rules';
import { UNIT, type SoulState } from '@/lib/weapon/types';
import { fmt, fmtUnits } from './weaponUi';

/**
 * 靈魂手動升級:自動升級關閉時,使用者在遊戲裡灌完碎片後回來記錄升到幾級;疊在武器管理視窗上方
 * @param soul 靈魂狀態
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 * @param onConfirm 確認升級時呼叫,帶要升到的等級
 */
export function SoulLevelUpDialog({
  soul,
  open,
  onOpenChange,
  onConfirm,
}: {
  soul: SoulState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (toLevel: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-5 sm:max-w-sm">
        {/* 每次開啟重新建立,目標等級回到預設的最高可升等級 */}
        {open && <LevelUpBody soul={soul} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function LevelUpBody({ soul, onCancel, onConfirm }: { soul: SoulState; onCancel: () => void; onConfirm: (toLevel: number) => void }) {
  const reached = soulLevelUp(soul);
  const min = soul.level + 1;
  const max = Math.max(min, reached.level);
  const [target, setTarget] = useState(max);
  const spent = soulCostBetween(soul.level, target);
  const stepBtn = 'size-11 rounded-[9.6px]';
  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">升級靈魂武器</DialogTitle>
        <DialogDescription>選擇在遊戲裡升到幾級，會從持有的碎片扣掉對應的量。</DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        <div className="flex items-center justify-between gap-3 rounded-[9.6px] bg-surface-raised px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">目前</span>
          <b className="font-semibold tabular-nums">
            Lv.{soul.level} · 持有 {fmtUnits(soul.pool)} 碎片
          </b>
        </div>
        <div className="flex flex-col gap-2">
          <span id="soul-target-label" className="text-sm font-medium">
            升到
          </span>
          <div role="group" aria-labelledby="soul-target-label" className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="少升一級" disabled={target <= min} onClick={() => setTarget(target - 1)} className={stepBtn}>
              <Minus aria-hidden="true" />
            </Button>
            <b aria-live="polite" className="flex-1 text-center text-xl font-bold text-(--weapon-soul) tabular-nums">
              Lv.{target}
            </b>
            <Button type="button" variant="outline" size="icon" aria-label="多升一級" disabled={target >= max} onClick={() => setTarget(target + 1)} className={stepBtn}>
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <span className="text-center text-xs text-muted-foreground">
            碎片最多可以升到 Lv.{max}
            {soulAtGate(reached) && `，Lv.${max} 要先完成升階任務才能繼續升級`}
          </span>
        </div>
        <ul aria-live="polite" className="flex flex-col gap-1 rounded-[9.6px] border border-border px-3 py-2.5 text-xs tabular-nums">
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              共花掉（Lv.{soul.level} → {target}）
            </span>
            <span>{fmt(spent)}</span>
          </li>
          <li className="flex justify-between gap-3 text-sm font-semibold">
            <span>升級後持有</span>
            <span>{fmtUnits(soul.pool - spent * UNIT)} 碎片</span>
          </li>
        </ul>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button type="button" size="sm" onClick={() => onConfirm(target)}>
          確認升級
        </Button>
      </DialogFooter>
    </>
  );
}
