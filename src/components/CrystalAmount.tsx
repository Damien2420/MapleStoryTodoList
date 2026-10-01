import { formatCrystalValue, formatCrystalValueToWan } from '@/lib/formatCrystal';
import { cn } from '@/lib/utils';

/**
 * 討伐收益金額:貨幣符號「$」與「億/萬」單位縮小、降低對比,讓數字本身最醒目;金額為 0 時整體變灰、不加粗。
 * 預設顯示內容與 formatCrystalValue 完全一致,只是把單位拆成獨立節點供排版;
 * roundToWan 時改用 formatCrystalValueToWan,有捨入時前面加淡色「≈」。
 * 字級由呼叫端用 className 決定,內部單位與符號以 em 相對縮放。
 * @param value 收益數字(楓幣)
 * @param className 額外的 class,通常用來指定字級與對齊
 * @param roundToWan 是否四捨五入到萬(角色頁 Header 收合版用)
 */
export function CrystalAmount({
  value,
  className,
  roundToWan = false,
}: {
  value: number;
  className?: string;
  roundToWan?: boolean;
}) {
  const { text, approximate } = roundToWan
    ? formatCrystalValueToWan(value)
    : { text: formatCrystalValue(value), approximate: false };
  const parts = text.split(/(億|萬)/);
  return (
    <span
      className={cn(
        'inline-flex items-baseline whitespace-nowrap leading-none tracking-tight tabular-nums',
        value === 0 ? 'font-medium text-muted-foreground' : 'font-bold text-foreground',
        className,
      )}
    >
      {approximate && <span className="mr-px text-[0.78em] font-medium text-muted-foreground">≈</span>}
      <span className="mr-px text-[0.78em] font-medium text-muted-foreground">$</span>
      {parts.map((part, index) =>
        part === '億' || part === '萬' ? (
          <span key={index} className="mx-px text-[0.82em] font-medium opacity-70">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}
