import { useEffect, useRef } from 'react';
import { HourglassIcon, type HourglassIconHandle } from '@/components/ui/hourglass-icon';

/** HourglassIcon 的單次翻轉動畫時長(秒),掛載期間會用同一個數字重複觸發動畫 */
const FLIP_DURATION = 1;

/**
 * 載入中的沙漏圖示:掛載期間持續翻轉,只在載入中時 render 即可,不需要另外傳狀態。
 * HourglassIcon 的動畫是「觸發一次」,不是自動 loop,所以用 interval 每隔一個動畫週期(0.9 * duration 秒)重新觸發。
 * 顏色沿用父層文字顏色(currentColor),放在按鈕裡會自動跟著按鈕文字色。
 * 純裝飾,旁邊的文字(例如「查詢中…」)負責傳達狀態,所以對輔助技術隱藏。
 * @param props.size 圖示尺寸(px),預設 16
 * @param props.className 額外樣式
 */
export function LoadingHourglass({ size = 16, className }: { size?: number; className?: string }) {
  const hourglassRef = useRef<HourglassIconHandle>(null);

  useEffect(() => {
    hourglassRef.current?.startAnimation();
    const intervalId = setInterval(() => {
      hourglassRef.current?.startAnimation();
    }, FLIP_DURATION * 900);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <HourglassIcon
      ref={hourglassRef}
      size={size}
      duration={FLIP_DURATION}
      aria-hidden="true"
      className={className}
    />
  );
}
