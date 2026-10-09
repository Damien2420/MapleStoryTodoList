import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * 按鈕文字：動作進行中顯示轉圈與「處理中」，否則顯示原本的文字。
 * @param pending 動作是否進行中（通常來自 usePendingAction）
 * @param children 平常顯示的按鈕文字
 */
export function PendingLabel({ pending, children }: { pending: boolean; children: ReactNode }) {
  if (!pending) return children;
  return (
    <>
      <Spinner aria-hidden="true" />
      處理中
    </>
  );
}
