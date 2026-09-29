import type { VipTier } from '@/types';

/** VIP會員等級徽章對應的圖示路徑,圖檔放在 public 底下 */
export const VIP_TIER_ICONS: Record<VipTier, string> = {
  silver: '/vip_silver.png',
  gold: '/vip_gold.png',
  diamond: '/vip_diamond.png',
  royal: '/vip_royal.png',
  royalBlack: '/vip_royalBlack.png',
};
