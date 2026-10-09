import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ASTRA, DESTINY, GENESIS, SOUL_QUESTS } from '@/data/weaponRates.data';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { toDisplay } from '@/lib/weapon/rates';
import { destinyNeed, genesisNeed, soulStageOf } from '@/lib/weapon/rules';
import { soloKey, type WeaponKind } from '@/lib/weapon/types';
import { BossTilePicker } from './BossTilePicker';
import { fmt } from './weaponUi';

/**
 * 升階確認:疊在武器管理視窗上方。創世、命運、阿斯特拉勾選已完成任務後才能確認;
 * 靈魂用 BOSS 圖示按鈕選擇單人擊破了哪一隻(任一即可),已攻略的會預先選好
 * @param kind 武器
 * @param progress useWeaponProgress 的結果
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 * @param onConfirm 確認升階時呼叫;靈魂附上選擇的 BOSS
 */
export function UpgradeConfirmDialog({
  kind,
  progress,
  open,
  onOpenChange,
  onConfirm,
}: {
  kind: WeaponKind;
  progress: WeaponProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (soulQuestKey?: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5 sm:max-w-md">
        {/* 每次開啟重新建立表單,勾選狀態不會殘留 */}
        {open && <UpgradeBody kind={kind} progress={progress} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function UpgradeBody({
  kind,
  progress,
  onCancel,
  onConfirm,
}: {
  kind: WeaponKind;
  progress: WeaponProgress;
  onCancel: () => void;
  onConfirm: (soulQuestKey?: string) => void;
}) {
  const { state } = progress;
  const soulStage = soulStageOf(state.soul.level, false);
  const soulOptions = SOUL_QUESTS[soulStage] ?? [];
  const [checked, setChecked] = useState(false);
  const [soulPick, setSoulPick] = useState<string | null>(
    () => soulOptions.map((o) => soloKey(o.bossCatalogId, o.difficulty)).find((k) => state.soul.soloCleared.includes(k)) ?? null,
  );

  const diff = (label: string, from: number, to: number) => (
    <div className="flex items-center gap-2 text-sm tabular-nums">
      {label} <b className="font-semibold text-foreground">{fmt(from)}</b>
      <ArrowRight aria-hidden="true" className="size-3" />
      <span className="font-bold text-secondary-foreground">{fmt(Math.max(0, to))}</span>
    </div>
  );
  const taskBox = (text: string) => (
    <label className="flex min-h-8 items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      {text}
    </label>
  );

  let title: string;
  let sub: string;
  let body: ReactNode;
  let canConfirm = checked;

  if (kind === 'genesis') {
    const g = state.genesis;
    const need = genesisNeed(g.stage);
    const pool = toDisplay(g.pool);
    title = '創世武器升階';
    sub = g.stage >= 8 ? '第 8 階 → 解放' : `第 ${g.stage} 階 → 第 ${g.stage + 1} 階`;
    body = (
      <>
        {taskBox(`我已完成「${GENESIS.quests[g.stage - 1].name}」`)}
        <Preview>
          {diff('持有痕跡', pool, pool - need)}
          {g.stage >= 8
            ? `扣除第 8 階需求 ${fmt(need)}，創世武器解放，命運武器與阿斯特拉輔助武器隨即解鎖。`
            : `扣除第 ${g.stage} 階需求 ${fmt(need)}，剩下的帶入第 ${g.stage + 1} 階。`}
        </Preview>
      </>
    );
  } else if (kind === 'destiny') {
    const d = state.destiny;
    const need = destinyNeed(d.stage);
    const pool = toDisplay(d.pool);
    const phaseEnd = d.stage === 3;
    title = '命運武器升階';
    sub = phaseEnd ? '第 3 階 → 第一階段完成' : d.stage === 6 ? '第 6 階 → 二次解放' : `第 ${d.stage} 階 → 第 ${d.stage + 1} 階`;
    body = (
      <>
        {taskBox(`我已完成「${DESTINY.quests[d.stage - 1].name}」`)}
        <Preview>
          {diff('持有決心', pool, phaseEnd ? 0 : pool - need)}
          {phaseEnd
            ? `扣除第 3 階需求 ${fmt(need)}，第一階段完成，升級成命運武器。接著就能開始第二階段：二次解放（決心從 0 開始，上限 15,000）。`
            : d.stage === 6
              ? `扣除第 6 階需求 ${fmt(need)}，完成二次解放。`
              : `扣除第 ${d.stage} 階需求 ${fmt(need)}，剩下的帶入第 ${d.stage + 1} 階。`}
        </Preview>
      </>
    );
  } else if (kind === 'astra') {
    const a = state.astra;
    const traceNeed = ASTRA.traceNeeds[a.stage - 1];
    const shardNeed = ASTRA.shardNeeds[a.stage - 1];
    title = '阿斯特拉輔助武器升階';
    sub = a.stage >= 3 ? '第 3 階 → 完成' : `第 ${a.stage} 階 → 第 ${a.stage + 1} 階`;
    body = (
      <>
        {taskBox(`我已在遊戲中完成第 ${a.stage} 階的任務`)}
        <Preview>
          {diff('激戰的痕跡', toDisplay(a.trace), toDisplay(a.trace) - traceNeed)}
          {diff('艾里溫碎片', toDisplay(a.shard), toDisplay(a.shard) - shardNeed)}
          {`扣除第 ${a.stage} 階需求（痕跡 ${fmt(traceNeed)}、碎片 ${fmt(shardNeed)}）${a.stage >= 3 ? '，取得阿斯特拉輔助武器。' : `，剩下的帶入第 ${a.stage + 1} 階。`}`}
        </Preview>
      </>
    );
  } else {
    const s = state.soul;
    title = '靈魂武器升階';
    sub = `Lv.${s.level} · ${soulStage} 階 → ${soulStage + 1} 階`;
    canConfirm = soulPick !== null;
    body = (
      <>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">單人擊破了哪一隻？（任一即可）</span>
          <BossTilePicker
            options={soulOptions}
            selected={soulPick ? [soulPick] : []}
            history={s.soloCleared}
            onToggle={(key) => setSoulPick(key)}
          />
        </div>
        <Preview>
          <span>
            靈魂武器升階不消耗碎片。
          </span>
        </Preview>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        <DialogDescription>{sub}</DialogDescription>
      </DialogHeader>
      {body}
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          返回
        </Button>
        <Button type="button" size="sm" disabled={!canConfirm} onClick={() => onConfirm(kind === 'soul' ? (soulPick ?? undefined) : undefined)}>
          確認升階
        </Button>
      </DialogFooter>
    </>
  );
}

/** 升階後的變化預覽 */
function Preview({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-lg bg-surface-raised px-2.5 py-2 text-xs text-muted-foreground">{children}</div>;
}
