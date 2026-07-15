import { cn } from '@/lib/utils';
import type { StatusFilter } from '@/lib/listFilter';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'unchecked', label: '未完成' },
  { value: 'checked', label: '已完成' },
];

interface StatusFilterControlProps {
  /** 目前的完成狀態篩選值 */
  value: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}

/**
 * 完成狀態篩選 segmented control(全部/未完成/已完成),任務清單與 BOSS 清單共用。
 * 只負責顯示與回呼,不直接讀寫 store。
 */
export function StatusFilterControl({ value, onChange }: StatusFilterControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-4xl bg-muted/40 p-0.5">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            'rounded-4xl border border-transparent px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
