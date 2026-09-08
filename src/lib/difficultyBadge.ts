import type { BossDifficulty } from '@/types';

/**
 * BOSS 難度標籤對應的語意色 Badge class(楓葉森林配色)。
 *
 * 簡單→終極沿暖色調做真正的色相位移(金黃→橘→酒紫),搭配彩度遞增,讓六個難度一眼就能分辨,
 * 不只是靠明度深淺;刻意繞開 destructive 的紅色帶(hue 15-18),避免「難度」跟「逾期警示」混淆。
 * 顏色定義在 index.css 的 --difficulty-* token,深淺主題各自調校。
 */
export const DIFFICULTY_BADGE_CLASSES: Record<BossDifficulty, string> = {
  簡單: 'border-transparent bg-difficulty-easy text-difficulty-easy-foreground',
  普通: 'border-transparent bg-difficulty-normal text-difficulty-normal-foreground',
  困難: 'border-transparent bg-difficulty-hard text-difficulty-hard-foreground',
  渾沌: 'border-transparent bg-difficulty-chaos text-difficulty-chaos-foreground',
  極限: 'border-transparent bg-difficulty-extreme text-difficulty-extreme-foreground',
  終極: 'border-transparent bg-difficulty-ultimate text-difficulty-ultimate-foreground',
};
