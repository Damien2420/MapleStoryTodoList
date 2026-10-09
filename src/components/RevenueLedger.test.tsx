import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RevenueLedger } from '@/components/RevenueLedger';
import { pickRevenueItems } from '@/lib/revenueItems';

// React 19 的 act() 需要明確宣告目前環境支援 act,否則狀態更新不會同步 flush
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('pickRevenueItems', () => {
  it('依日/週/月順序只保留有收益資料的週期', () => {
    const revenue = { daily: undefined, weekly: 100, monthly: 0 } as const;
    expect(pickRevenueItems((cycle) => revenue[cycle])).toEqual([
      { cycle: 'weekly', revenue: 100 },
      { cycle: 'monthly', revenue: 0 },
    ]);
  });
});

describe('RevenueLedger', () => {
  it('精確模式顯示完整金額', () => {
    const el = render(<RevenueLedger items={[{ cycle: 'daily', revenue: 41_529_750 }]} />);
    expect(el.textContent).toContain('4152萬9750');
    expect(el.textContent).not.toContain('≈');
  });

  it('四捨五入模式顯示約略金額', () => {
    const el = render(<RevenueLedger items={[{ cycle: 'daily', revenue: 41_529_750 }]} roundToWan />);
    expect(el.textContent).toContain('≈$4153萬');
  });

  it('沒有項目且沒有 emptyText 時不渲染', () => {
    const el = render(<RevenueLedger items={[]} />);
    expect(el.innerHTML).toBe('');
  });

  it('沒有項目但有 emptyText 時顯示文字', () => {
    const el = render(<RevenueLedger items={[]} emptyText="尚未追蹤 BOSS" />);
    expect(el.textContent).toContain('尚未追蹤 BOSS');
  });
});
