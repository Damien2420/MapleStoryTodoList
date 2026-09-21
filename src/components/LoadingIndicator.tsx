import { Spinner } from '@/components/ui/spinner';

/**
 * 載入中提示(spinner + 文字),給 Suspense 的 fallback 共用。
 * 只負責內容與無障礙語意(role="status" 讓螢幕閱讀器朗讀),不決定尺寸與位置;
 * 呼叫端在自己的容器內自行決定大小與置中方式
 */
export function LoadingIndicator() {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      {/* Spinner 自帶英文的 aria-label="Loading",這裡文字已經負責朗讀,避免重複 */}
      <Spinner aria-hidden="true" />
      <span>載入中…</span>
    </div>
  );
}
