import { useReducer } from 'react';
import { cn } from '@/lib/utils';

/** 載入失敗(尚未提供圖片)的目錄 id,整個 session 共用,之後掛載同一隻王時直接顯示佔位,不再重複請求 */
const failedIconIds = new Set<string>();

/**
 * BOSS 頭像:讀取 public/boss-icon/<目錄 id>.png,載入失敗或沒有目錄 id(舊資料)時改顯示名稱首字的佔位方塊。
 * 圖片不另外維護對照表,之後補圖只要把檔案放進資料夾;佔位與圖片同尺寸,補圖前後版面不會跳動。
 * @param props.bossCatalogId BOSS 目錄 id,同時也是圖片檔名
 * @param props.name BOSS 名稱,取首字當佔位文字
 * @param props.className 額外的 class,預設大小為 size-6
 */
export function BossAvatar({
  bossCatalogId,
  name,
  className,
}: {
  bossCatalogId: string | undefined;
  name: string;
  className?: string;
}) {
  // 失敗紀錄放在模組層級的 Set,這裡只負責在載入失敗後觸發重新渲染
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  if (!bossCatalogId || failedIconIds.has(bossCatalogId)) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-[5px] bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border ring-inset',
          className,
        )}
      >
        {name.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={`/boss-icon/${bossCatalogId}.png`}
      alt=""
      className={cn('size-6 shrink-0 rounded-[5px] object-contain', className)}
      onError={() => {
        failedIconIds.add(bossCatalogId);
        rerender();
      }}
    />
  );
}
