import { useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { JumpList } from '@/lib/listJump';
import { matchesMedia, WIDE_LIST_LAYOUT_QUERY } from '@/lib/media';
import { cn } from '@/lib/utils';
import type { BossCycleKey } from '@/store/useListFilterStore';

const LIST_LABELS: Record<JumpList, string> = { task: '任務', boss: 'BOSS' };

/**
 * 點擊後跳轉到某週期清單的按鈕,收合版跳轉磚與展開版週期卡共用。
 * 寬螢幕點擊時所有清單一起跳轉;窄螢幕若該週期同時有任務與 BOSS,先在按鈕下方跳出選單讓使用者選。
 * 按鈕套用 index.css 的 cycle-jump(hover 與按下回饋),呼叫端需在 style 提供 --cf(週期色)與 --cycle-jump-base(靜止底色),
 * 且不要再加 bg-* / border-border。其餘 button 屬性(className、aria-label、style、children 等)原樣套到按鈕上。
 * @param cycle 要跳轉的週期
 * @param lists 該週期有項目的清單
 * @param onJump 要跳轉時呼叫,lists 為要捲動的清單
 */
export function CycleJumpTrigger({
  cycle,
  lists,
  onJump,
  className,
  ...buttonProps
}: Omit<ComponentProps<'button'>, 'onClick' | 'type'> & {
  cycle: BossCycleKey;
  lists: JumpList[];
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (lists.length > 1 && !matchesMedia(WIDE_LIST_LAYOUT_QUERY)) {
      setOpen(true);
      return;
    }
    onJump(cycle, lists);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        {/* data-open:選單開著時讓按鈕保持染色,看得出選單屬於哪一顆 */}
        <button
          type="button"
          onClick={handleClick}
          data-open={open || undefined}
          className={cn('cycle-jump', className)}
          {...buttonProps}
        />
      </PopoverAnchor>
      {/* collisionPadding 讓選單在螢幕邊緣的按鈕下方時,仍與視窗邊界保留頁面 gutter 的距離 */}
      <PopoverContent align="center" collisionPadding={16} className="w-auto flex-row gap-2 p-2">
        {lists.map((list) => (
          <Button
            key={list}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              onJump(cycle, [list]);
            }}
          >
            {LIST_LABELS[list]}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
