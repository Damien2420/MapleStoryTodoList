import { formatCrystalValue } from '@/lib/formatCrystal';
import { cn } from '@/lib/utils';

/**
 * 討伐收益金額:貨幣符號「$」與「億/萬」單位縮小、降低對比,讓數字本身最醒目;金額為 0 時整體變灰、不加粗。
 * 顯示內容與 formatCrystalValue 完全一致,只是把單位拆成獨立節點供排版。
 * 字級由呼叫端用 className 決定,內部單位與符號以 em 相對縮放。
 * @param value 收益數字(楓幣)
 * @param className 額外的 class,通常用來指定字級與對齊
 */
export function CrystalAmount({ value, className }: { value: number; className?: string }) {
  const parts = formatCrystalValue(value).split(/(億|萬)/);
  return (
    <span
      className={cn(
        'inline-flex items-baseline whitespace-nowrap leading-none tracking-tight tabular-nums',
        value === 0 ? 'font-medium text-muted-foreground' : 'font-bold text-foreground',
        className,
      )}
    >
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
