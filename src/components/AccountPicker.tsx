import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/animate-ui/components/radix/radio-group';
import { UNASSIGNED_GROUP_ID, UNASSIGNED_GROUP_NAME } from '@/lib/characterBoard';
import { cn } from '@/lib/utils';
import type { Account } from '@/types';

/** 單選項目的共用樣式:整列都是可點擊範圍,選中時框線與底色改成強調色(Radix 的選中狀態寫在按鈕的 data-state 上) */
const OPTION_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5';

interface AccountPickerProps {
  accounts: Account[];
  /** 目前選擇的帳號 id;null 代表未歸類 */
  value: string | null;
  onChange: (accountId: string | null) => void;
}

/**
 * 新增角色流程的「選擇帳號」單選清單:依看板順序列出所有帳號,最後一項是「未歸類」。
 * 新增角色 Dialog 與首次引導畫面共用,外層的標題、按鈕由各自的版型負責。
 * 用 Radix RadioGroup(animate-ui 樣式),方向鍵切換與螢幕閱讀器語意由 Radix 處理。
 * Radix 的值只能是字串,「未歸類」在元件內部用 UNASSIGNED_GROUP_ID 代表,對外仍是 null。
 * @param props.accounts 所有帳號(元件內部會依 order 排序)
 * @param props.value 目前選擇的帳號 id,null 代表未歸類
 * @param props.onChange 選擇改變時呼叫
 */
export function AccountPicker({ accounts, value, onChange }: AccountPickerProps) {
  const idPrefix = useId();
  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order);
  const options = [
    ...sortedAccounts.map((a) => ({ value: a.id, name: a.name, unassigned: false })),
    { value: UNASSIGNED_GROUP_ID, name: UNASSIGNED_GROUP_NAME, unassigned: true },
  ];

  return (
    <RadioGroup
      aria-label="歸屬帳號"
      value={value ?? UNASSIGNED_GROUP_ID}
      onValueChange={(next) => onChange(next === UNASSIGNED_GROUP_ID ? null : next)}
      className="flex flex-col gap-2"
    >
      {options.map((option) => {
        const itemId = `${idPrefix}-${option.value}`;
        return (
          // label 對應按鈕 id,讓整列都能點選
          <label key={option.value} htmlFor={itemId} className={OPTION_CLASS}>
            <RadioGroupItem id={itemId} value={option.value} />
            <span
              className={cn(
                'min-w-0 truncate',
                option.unassigned ? 'text-muted-foreground' : 'font-medium text-foreground',
              )}
            >
              {option.name}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
