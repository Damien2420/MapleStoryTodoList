import { useId } from 'react';
import { cn } from '@/lib/utils';

/** 一張選項卡的內容 */
export interface Choice<T extends string> {
  value: T;
  title: string;
  description: string;
  /** 選了之後會發生什麼 */
  effect: string;
  /** 影響說明會覆蓋或失去資料時用警告色 */
  warn?: boolean;
  /** 在標題旁加上「建議」標籤 */
  recommended?: boolean;
}

interface ChoiceCardsProps<T extends string> {
  /** 群組標題（同時是 fieldset 的 legend） */
  legend: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * 比較畫面下方的單選卡片：整張卡片是 radio 的 label，點了只是選取，按對話框的「確定」才執行。
 * 容器小於 520px 時上下排列。
 */
export function ChoiceCards<T extends string>({ legend, choices, value, onChange, disabled }: ChoiceCardsProps<T>) {
  const name = useId();
  return (
    <fieldset className="@container min-w-0" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-foreground">{legend}</legend>
      <div className="grid grid-cols-1 gap-3 @[520px]:grid-cols-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={cn(
              'grid cursor-pointer grid-cols-[20px_minmax(0,1fr)] content-start gap-x-2.5 gap-y-1.5 rounded-xl border bg-background px-4 py-3.5 transition-colors',
              'hover:border-primary/45 has-checked:border-primary has-checked:bg-primary/5 has-checked:ring-1 has-checked:ring-primary has-checked:ring-inset',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-disabled:cursor-default has-disabled:opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="peer sr-only"
            />
            <span className="mt-0.5 flex size-4.5 items-center justify-center rounded-full border-[1.5px] border-foreground/35 peer-checked:border-primary peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-primary" />
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              {choice.title}
              {choice.recommended && (
                <span className="rounded-full bg-primary px-2 py-px text-[10.5px] font-bold text-primary-foreground">建議</span>
              )}
            </span>
            <span className="col-start-2 text-xs text-muted-foreground">{choice.description}</span>
            <span
              className={cn(
                // 中文預設可在任兩字之間斷行，角色名稱會被切開；改成只在標點斷行，名稱長到超出卡片時才強制斷開
                'col-start-2 justify-self-start rounded-lg px-2 py-1 text-xs break-keep wrap-anywhere',
                choice.warn ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-foreground',
              )}
            >
              {choice.effect}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
