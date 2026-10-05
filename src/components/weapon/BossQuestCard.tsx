import { ArrowUp } from 'lucide-react';
import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 創世、命運的 BOSS 任務卡與阿斯特拉的升階條件:素材足夠時外框轉金色、升階按鈕可以按
 * @param heading 卡片標題(BOSS 任務 / 升階條件)
 * @param name 任務名稱
 * @param bossCatalogId 任務 BOSS(顯示頭像),阿斯特拉沒有
 * @param ready 素材是否足夠
 * @param onUpgrade 按下升階時呼叫
 */
export function BossQuestCard({
  heading,
  name,
  bossCatalogId,
  ready,
  onUpgrade,
}: {
  heading: string;
  name: string;
  bossCatalogId?: string;
  ready: boolean;
  onUpgrade: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[9.6px] border border-border px-3 py-2.5',
        ready && 'border-secondary-foreground bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))]',
      )}
    >
      <span className="text-xs font-semibold text-muted-foreground">{heading}</span>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          {bossCatalogId && <BossAvatar bossCatalogId={bossCatalogId} name={name} />}
          {name}
        </span>
        <Button type="button" size="sm" disabled={!ready} onClick={onUpgrade} className="pointer-coarse:h-11">
          <ArrowUp aria-hidden="true" />
          升階
        </Button>
      </div>
    </div>
  );
}
