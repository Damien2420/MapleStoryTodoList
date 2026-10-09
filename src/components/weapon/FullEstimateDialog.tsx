import { useCallback, type CSSProperties } from 'react';
import { Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DESTINY, SOUL_LEVEL_COSTS } from '@/data/weaponRates.data';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { formatDate, formatEta, type FullEstimateRow } from '@/lib/weapon/estimate';
import { soulStageOf } from '@/lib/weapon/rules';
import { cn } from '@/lib/utils';
import { bossName, fmt, fmtUnits, weaponColor } from './weaponUi';

/** 靈魂每一階的需求 */
const soulStageNeed = (stage: number) => SOUL_LEVEL_COSTS.slice((stage - 1) * 10 + 1, stage * 10 + 1).reduce((a, b) => a + b, 0);

/**
 * 完整預估時間軸(靈魂 1~10 階、命運 1~6 階):疊在武器管理視窗上方,逐階列出預計完成日;
 * 標題與關閉固定,中間內容超過高度時捲動,計算方式收在清單最下方當註腳
 * @param kind 靈魂或命運
 * @param progress useWeaponProgress 的結果
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 */
export function FullEstimateDialog({
  kind,
  progress,
  open,
  onOpenChange,
}: {
  kind: 'soul' | 'destiny';
  progress: WeaponProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, estimate, now } = progress;
  const soul = kind === 'soul';
  const rows: FullEstimateRow[] = soul ? estimate.soulFull : estimate.destinyFull;
  const currentStage = soul ? soulStageOf(state.soul.level, state.soul.gatePassed) : state.destiny.status === 'phase1done' ? 4 : state.destiny.stage;
  const last = rows[rows.length - 1];
  const src = estimate.soulSource;
  const topBoss = soul && src ? `${src.difficulty}${bossName(src.bossCatalogId)}` : null;

  // 開啟時把目前階段捲到可視範圍中央,後期不用先捲過一段已完成的階段,下方也看得到之後各階的日期
  // (用 nearest 會停在最底,之後的階段還是被擋住);內容沒超出高度時不會捲動。
  // callback ref 固定不變,只在那一列掛上時執行一次
  const scrollToCurrent = useCallback((el: HTMLElement | null) => el?.scrollIntoView({ block: 'center' }), []);

  const title = soul ? '靈魂武器滿等預估時間軸' : '命運武器完整預估時間軸';
  const sub = soul
    ? `目前 Lv.${state.soul.level}（${currentStage} 階）`
    : `目前第 ${currentStage} 階（${currentStage <= 3 ? '第一階段' : '第二階段'}）`;
  const sumLabel = soul ? 'Lv.100 預計' : '二次解放預計';
  const sumValue = last?.date ? `${formatDate(last.date)} · ${formatEta(last.weeks, last.date, now)}` : '超過 30 年';
  const points = soul
    ? [
        '每一階的升階 BOSS 任務都能順利完成、不卡關',
        `每週固定取得目前清單中最多的 +${fmtUnits(estimate.gain.soul)}${topBoss ? `（${topBoss}）` : ''}`,
      ]
    : [
        '每一階的決戰任務都能順利完成、不卡關',
        `每週固定取得目前清單中追蹤的 BOSS 合計約 +${fmtUnits(estimate.gain.destiny)}（組隊依人數平分）`,
        '進入第二階段後持有上限提高到 15,000',
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-5 sm:max-w-lg">
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm">{sub}</DialogDescription>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Info aria-hidden="true" className="size-3" />
            預估時間軸計算方式請見清單最下方
          </span>
        </DialogHeader>
        <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 [scrollbar-width:thin]">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[9.6px] bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))] px-3 py-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock aria-hidden="true" className="size-3.5" />
              {sumLabel}
            </span>
            <b className="font-semibold text-secondary-foreground tabular-nums">{sumValue}</b>
          </div>
          <ol className="flex flex-col" style={{ '--bar': weaponColor(kind, state) } as CSSProperties}>
            {rows.map((row, i) => {
              const group =
                !soul && (row.stage === 1 || row.stage === 4)
                  ? row.stage === 1
                    ? `第一階段 · 升級成命運武器（持有上限 ${fmt(DESTINY.phaseCaps[0])}）`
                    : `第二階段 · 二次解放（持有上限 ${fmt(DESTINY.phaseCaps[1])}）`
                  : null;
              const isCur = row.stage === currentStage && !row.done;
              const isEnd = i === rows.length - 1;
              return (
                <li key={row.stage} className="contents">
                  {group && <span className={cn('block px-2 pb-1 text-xs font-semibold text-muted-foreground', row.stage === 4 && 'pt-3')}>{group}</span>}
                  <span
                    ref={isCur ? scrollToCurrent : undefined}
                    className={cn(
                      'grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-[7px] text-sm',
                      row.done && 'text-muted-foreground',
                      // 目前階段用武器色淡底,和上方金黃的最終結果區分開;
                      // 用 oklab 混色:oklch 會沿色相環內插,紫色混暖白底時會繞經紅橘變成褐色
                      // 淡底上的灰色小字對比不足 4.5:1,改用前景色帶一點武器色
                      isCur && 'bg-[color-mix(in_oklab,var(--bar)_16%,var(--popover))] [&_small]:text-[color-mix(in_oklab,var(--foreground)_70%,var(--bar))]',
                    )}
                  >
                    <span className={cn(row.done ? 'font-medium' : 'font-semibold', isCur && 'text-(--bar)')}>{row.stage} 階</span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate">{soul ? `Lv.${(row.stage - 1) * 10 + 1}～${row.stage * 10}` : bossLabel(row.stage)}</span>
                      <small className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {soul ? `${fmt(soulStageNeed(row.stage))} 碎片` : `${fmt(DESTINY.needs[row.stage - 1])} 敵對者的決心`}
                      </small>
                    </span>
                    <span className="flex flex-col items-end text-right leading-tight">
                      {row.done ? (
                        <span>已完成</span>
                      ) : row.date ? (
                        <>
                          <span className={cn('tabular-nums', isEnd && 'font-semibold text-secondary-foreground')}>{formatDate(row.date)}</span>
                          <small className="text-xs text-muted-foreground">{formatEta(row.weeks, row.date, now)}</small>
                        </>
                      ) : (
                        <span className="text-muted-foreground">超過 30 年</span>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-1 border-t border-border/70 pt-2.5 text-xs leading-normal text-muted-foreground">
            <b className="mb-0.5 block font-semibold">預估時間軸計算方式</b>
            <ul className="list-disc pl-[1.2em]">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-3">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              關閉
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 命運各階的決戰任務 BOSS 名稱(去掉「決戰，」前綴) */
function bossLabel(stage: number): string {
  return DESTINY.quests[stage - 1].name.replace(/^決戰，/, '');
}

