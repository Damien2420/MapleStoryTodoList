import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Footer } from '@/components/Footer';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRouteChangeEffects } from '@/hooks/useRouteChangeEffects';

/** 所有頁面共用的外框(Layout Route):頂欄、公告列、唯一的 <main> landmark、頁尾;各頁只負責 main 裡面的內容 */
export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useDocumentTitle();
  useRouteChangeEffects(mainRef);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <AnnouncementBar />
      {/* tabIndex=-1:只供換頁後以程式移動焦點,不進入 Tab 順序 */}
      <main ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {/* 以 pathname 當 key:某一頁載入失敗後,切到別頁要能恢復,不能讓錯誤畫面一直卡住;頂欄與頁尾在邊界外,不受影響 */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
