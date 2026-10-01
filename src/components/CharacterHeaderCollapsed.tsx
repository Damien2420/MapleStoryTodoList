import type { ReactNode } from 'react';
import { CycleJumpTiles } from '@/components/CycleJumpTiles';
import { Badge } from '@/components/ui/badge';
import { RevenueLedger } from '@/components/RevenueLedger';
import { hasAnyTrackedCycle, type CycleSummary } from '@/lib/characterSummary';
import type { CycleUrgency } from '@/lib/cycleUrgency';
import type { JumpList } from '@/lib/listJump';
import { pickRevenueItems } from '@/lib/revenueItems';
import { cn } from '@/lib/utils';
import { VIP_TIER_BADGE_CLASSES, VIP_TIER_LABELS } from '@/lib/vipBossCatalog';
import { VIP_TIER_ICONS } from '@/lib/vipTierIcons';
import type { BossCycleKey } from '@/store/useListFilterStore';
import type { Character, VipTier } from '@/types';
import { Info } from 'lucide-react';

/**
 * 角色頁 Header 的收合排版:以裁掉留白放大的立繪為主,名稱列(名稱、VIP 徽章、角色資訊)與週期跳轉磚、
 * 四捨五入到萬的討伐收益列放在立繪旁(手機則排在立繪下方)。
 * 沒有任何週期項目時只顯示立繪與名稱列;沒有追蹤 BOSS 時不顯示收益列。
 * @param character 目前的角色
 * @param vipTier 所屬帳號的 VIP 等級,沒有則不顯示徽章
 * @param summary 各週期進度摘要
 * @param urgency 每週/每月/賽季是否急迫
 * @param actions 更新/刪除按鈕(由 CharacterHeader 提供,手機橫排、桌面固定在右上角)
 * @param onJump 點擊跳轉磚要跳轉時呼叫
 */
export function CharacterHeaderCollapsed({
  character,
  vipTier,
  summary,
  urgency,
  actions,
  onJump,
}: {
  character: Character;
  vipTier?: VipTier;
  summary: Record<BossCycleKey, CycleSummary>;
  urgency: CycleUrgency;
  actions: ReactNode;
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
}) {
  const revenueItems = pickRevenueItems((cycle) => summary[cycle].revenue);
  const hasCycles = hasAnyTrackedCycle(summary);

  return (
    // 手機:grid 第一列為立繪/名稱/按鈕,週期區跨整列排在下方;
    // 桌面:立繪獨立一欄,名稱列與週期區在中間欄上下排列(中間欄在手機是 contents,子元素直接參與 grid)
    <div
      data-morph-layer
      className={cn(
        'relative grid items-center gap-x-3 gap-y-2.5 px-3.5 py-3 lg:flex lg:gap-6 lg:py-4 lg:pr-14 lg:pl-4',
        character.imageUrl ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {character.imageUrl && (
        // 外觀圖四周有大片透明留白,放大後由外框裁掉,讓角色本身更大
        <div
          data-morph="avatar"
          className={cn(
            'size-20 shrink-0 overflow-hidden rounded-xl bg-muted',
            hasCycles ? 'lg:size-[120px]' : 'lg:size-[72px]',
          )}
        >
          <img src={character.imageUrl} alt={character.name} className="size-full scale-[1.35] object-contain" />
        </div>
      )}

      {/* 桌面版中間欄佔剩餘寬度的 2/3,右側 1/3 留給下一階段的武器進度 */}
      <div className="contents lg:flex lg:min-w-0 lg:flex-[2_1_0%] lg:flex-col lg:gap-2">
        {/* 名稱列:手機三行(名稱 / VIP / 角色資訊),桌面一行並在下方以分隔線和週期區隔開 */}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-2',
            hasCycles && 'lg:border-b lg:border-border lg:pb-2',
          )}
        >
          {/* 手機版 VIP 徽章換到名稱下一行,避免長名稱被截斷;桌面版名稱、VIP、角色資訊同一行 */}
          <div className="flex min-w-0 flex-col items-start gap-1 lg:shrink-0 lg:flex-row lg:items-center lg:gap-2">
            <h1
              data-morph="name"
              className="max-w-full truncate text-base font-semibold text-foreground"
              title={character.name}
            >
              {character.name}
            </h1>
            {vipTier && (
              <Badge variant="secondary" className={cn('shrink-0 rounded-sm', VIP_TIER_BADGE_CLASSES[vipTier])}>
                <img src={VIP_TIER_ICONS[vipTier]} alt="" className="size-3" />
                {VIP_TIER_LABELS[vipTier]}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground lg:min-w-0 lg:flex-1">
            {character.server} · Lv.{character.level}
            {character.job && ` · ${character.job}`}
          </p>
        </div>

        {hasCycles && (
          <div className="col-span-full flex min-w-0 flex-col gap-2">
            <p className="flex flex-row gap-1 items-center text-xs text-muted-foreground">
              <Info className="size-3 shrink-0" aria-hidden="true"/>可點擊下方週期區塊快速跳轉至該週期項目
            </p>
            <CycleJumpTiles summary={summary} urgency={urgency} onJump={onJump} />
            <RevenueLedger
              items={revenueItems}
              roundToWan
              className="gap-x-2 lg:gap-x-2.5"
              amountClassName="text-xs lg:text-[12.5px]"
              itemsClassName="lg:justify-start lg:gap-x-6"
            />
          </div>
        )}
      </div>

      {/* 手機固定在第一列最後一欄;桌面由 actions 自己絕對定位到右上角 */}
      <div className="col-end-[-1] row-start-1 self-start lg:contents">{actions}</div>
      {/* 武器進度預留位置:這一階段不渲染內容,只在桌面版佔住右側 1/3 寬度 */}
      <div aria-hidden="true" className="hidden lg:block lg:flex-1" />
    </div>
  );
}
