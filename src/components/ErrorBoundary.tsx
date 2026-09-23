import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * 錯誤邊界:接住子孫元件「渲染期間」的例外(包含 React.lazy 動態載入失敗,例如離線或網站剛更新後舊的 chunk 檔已被刪除),
 * 改顯示重新整理的提示,避免整個 app 被 React 卸載成白畫面。
 * 事件處理函式與 async 函式裡的錯誤不會被接住,那些維持用 try/catch 處理。
 * 接住錯誤後不會自己復原,靠 AppLayout 這邊帶入的 key 變更讓它重新掛載。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">頁面載入失敗，請稍後再重試。</p>
        {/* React.lazy 會快取已失敗的載入結果,單純重繪拿到的還是同一個失敗;整頁重新載入才會取得新版本的 chunk 檔名 */}
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          重新整理
        </Button>
      </div>
    );
  }
}
