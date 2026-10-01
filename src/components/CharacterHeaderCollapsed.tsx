import type { ReactNode } from 'react';
import { CycleJumpTiles } from '@/components/CycleJumpTiles';
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
 * 角色頁 Header 的收合排版:精簡身分列(小立繪、名稱旁 VIP 圖示),下方為週期跳轉磚與四捨五入到萬的討伐收益列。
 * 沒有任何週期項目時只顯示身分列;沒有追蹤 BOSS 時不顯示收益列。
 * @param character 目前的角色
 * @param vipTier 所屬帳號的 VIP 等級,沒有則不顯示圖示
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

  return (
    <div
      data-morph-layer
      className="relative flex flex-col gap-2.5 px-3.5 py-3 lg:flex-row lg:items-center lg:gap-6 lg:py-4 lg:pr-14 lg:pl-4"
    >
      <div className="flex min-w-0 items-center gap-2.5 lg:shrink-0 lg:gap-3.5">
        {character.imageUrl && (
          <img
            data-morph="avatar"
            src={character.imageUrl}
            alt={character.name}
            className="aspect-square size-12 shrink-0 rounded-xl bg-muted object-contain lg:size-14"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 data-morph="name" className="truncate text-lg font-semibold text-foreground" title={character.name}>
              {character.name}
            </h1>
            {vipTier && (
              <span
                title={VIP_TIER_LABELS[vipTier]}
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-[5px]',
                  VIP_TIER_BADGE_CLASSES[vipTier],
                )}
              >
                <img src={VIP_TIER_ICONS[vipTier]} alt={VIP_TIER_LABELS[vipTier]} className="size-3" />
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {character.server} · Lv.{character.level}
            {character.job && ` · ${character.job}`}
          </p>
        </div>
        {actions}
      </div>

      {hasAnyTrackedCycle(summary) && (
        // 桌面版中間欄佔剩餘寬度的 2/3,右側 1/3 留給下一階段的武器進度
        <div className="flex min-w-0 flex-col gap-2 lg:flex-[2_1_0%] lg:border-l lg:border-border lg:pl-6">
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
      {/* 武器進度預留位置:這一階段不渲染內容,只在桌面版佔住右側 1/3 寬度 */}
      <div aria-hidden="true" className="hidden lg:block lg:flex-1" />
    </div>
  );
}
