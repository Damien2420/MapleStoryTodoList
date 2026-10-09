import { CrystalAmount } from '@/components/CrystalAmount';
import { REVENUE_LABELS, type RevenueLedgerItem } from '@/lib/revenueItems';
import { cn } from '@/lib/utils';

/**
 * 討伐收益列:金幣圖示 + 鋼藍「討伐收益」小標,右側日/週/月金額兩端對齊;有追蹤但都沒勾的週期顯示灰色 $0。
 * 總覽頁與角色頁 Header 收合版共用。
 * @param items 要顯示的週期金額(lib/revenueItems 的 pickRevenueItems 結果)
 * @param roundToWan 金額是否四捨五入到萬
 * @param emptyText 沒有任何項目時顯示的文字;未提供時整列不渲染
 * @param className 外層額外的 class(間距、分隔線)
 * @param amountClassName 金額字級
 * @param itemsClassName 金額群組額外的 class(例如改成靠左排列,避免寬欄位中金額被拉到兩端)
 */
export function RevenueLedger({
  items,
  roundToWan = false,
  emptyText,
  className,
  amountClassName = 'text-[12.5px]',
  itemsClassName,
}: {
  items: RevenueLedgerItem[];
  roundToWan?: boolean;
  emptyText?: string;
  className?: string;
  amountClassName?: string;
  itemsClassName?: string;
}) {
  if (items.length === 0 && emptyText === undefined) return null;

  return (
    <div
      className={cn('flex min-h-6 flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border pt-2', className)}
    >
      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-wide text-boss-foreground">
        <img src="/coin.png" alt="" className="size-3.5 shrink-0" />
        討伐收益
      </span>
      {items.length > 0 ? (
        <div className={cn('flex min-w-0 flex-auto flex-wrap justify-between gap-x-2.5 gap-y-1', itemsClassName)}>
          {items.map((item) => (
            <span key={item.cycle} className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[9.5px] font-semibold leading-none text-muted-foreground">
                {REVENUE_LABELS[item.cycle]}
              </span>
              <CrystalAmount value={item.revenue} roundToWan={roundToWan} className={amountClassName} />
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[10.5px] text-muted-foreground">{emptyText}</span>
      )}
    </div>
  );
}
