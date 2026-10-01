/** 討伐收益列上會出現的週期 */
export type RevenueCycle = 'daily' | 'weekly' | 'monthly';

/** 收益列上的一個週期金額 */
export interface RevenueLedgerItem {
  cycle: RevenueCycle;
  revenue: number;
}

/** 討伐收益列上有收益的三個週期,順序即顯示順序 */
const REVENUE_CYCLES: RevenueCycle[] = ['daily', 'weekly', 'monthly'];

/** 收益列上各週期的短標籤 */
export const REVENUE_LABELS: Record<RevenueCycle, string> = { daily: '日', weekly: '週', monthly: '月' };

/**
 * 依日/週/月順序挑出有收益資料的週期;revenue 為 undefined 代表該週期沒有追蹤 BOSS,不列出。
 * @param getRevenue 依週期取得收益,沒有追蹤 BOSS 時回傳 undefined
 * @returns 收益列的項目
 */
export function pickRevenueItems(getRevenue: (cycle: RevenueCycle) => number | undefined): RevenueLedgerItem[] {
  return REVENUE_CYCLES.flatMap((cycle) => {
    const revenue = getRevenue(cycle);
    return revenue === undefined ? [] : [{ cycle, revenue }];
  });
}
