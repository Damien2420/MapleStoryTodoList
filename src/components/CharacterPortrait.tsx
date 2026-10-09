import { cn } from '@/lib/utils';
import type { Character } from '@/types';

/**
 * 角色外觀小圖:有外觀圖顯示外觀圖,手動建立的角色沒有圖時畫同尺寸的名字首字方塊,避免版面因缺圖跳動。
 * 尺寸與圓角由呼叫端的 className 決定。純裝飾,旁邊一定有文字名稱,所以 alt 留空、fallback 設 aria-hidden。
 * @param props.character 要顯示的角色(只用到名稱與外觀圖)
 * @param props.className 尺寸、圓角等外觀
 */
export function CharacterPortrait({
  character,
  className,
}: {
  character: Pick<Character, 'name' | 'imageUrl'>;
  className?: string;
}) {
  if (character.imageUrl) {
    return <img src={character.imageUrl} alt="" draggable={false} className={cn('shrink-0 bg-muted object-contain', className)} />;
  }
  return (
    <div
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground', className)}
    >
      {[...character.name][0]}
    </div>
  );
}
