import { cn } from '@/lib/utils';
import { VIP_TICKET_LEVEL_ICONS } from '@/lib/vipBossCatalog';
import type { VipTicketLevel } from '@/types';

/**
 * VIP 重置券等級的圖示。各券圖片的原始尺寸不一(72~108px),
 * 這裡用固定大小的框加 object-contain 統一顯示,呼叫端要調整大小時用 className 覆寫 size。
 * @param props.level 券等級
 * @param props.className 額外的 class,預設大小為 size-6
 */
export function VipTicketIcon({ level, className }: { level: VipTicketLevel; className?: string }) {
  return <img src={VIP_TICKET_LEVEL_ICONS[level]} alt="" className={cn('size-6 shrink-0 object-contain', className)} />;
}
