import { useEffect, useState } from 'react';

/** 每隔 intervalMs 更新一次的目前時間,用於需要即時倒數顯示的元件 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
