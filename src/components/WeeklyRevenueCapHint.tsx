import { Info } from 'lucide-react';

/**
 * 每週收益上限提示:一般週王區塊與 VIP重置區塊共用同一份文案與樣式,
 * 說明兩邊的週王共用同一個每週收益名額(前 WEEKLY_BOSS_LIMIT 高才算收益)。
 * 用中性底色+圖示做成提示卡的樣子,而非單純一行文字,但不用警示色(沒有東西出錯,純資訊)。
 */
export function WeeklyRevenueCapHint() {
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <p>周收益只計算前12高結晶價格，VIP與一般周王共同計算</p>
    </div>
  );
}
