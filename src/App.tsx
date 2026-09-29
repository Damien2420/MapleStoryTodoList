import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { CharacterGuard } from '@/components/CharacterGuard';
import { CharacterBoardPage } from '@/components/CharacterBoardPage';
import { CharacterPage } from '@/components/CharacterPage';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { REDIRECT_NAV_STATE } from '@/hooks/useRouteChangeEffects';
import { ROUTES } from '@/lib/routes';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';

const DataManagementPage = lazy(() => import('@/components/DataManagementPage'));

const RESET_CHECK_INTERVAL_MS = 60_000;

export function App() {
  const settings = useSettingsStore((s) => s.settings);
  const runTaskResetCheck = useTaskStore((s) => s.runResetCheck);
  const runBossResetCheck = useBossStore((s) => s.runResetCheck);

  useEffect(() => {
    runTaskResetCheck(settings);
    runBossResetCheck(settings);
    const interval = setInterval(() => {
      runTaskResetCheck(settings);
      runBossResetCheck(settings);
    }, RESET_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runTaskResetCheck, runBossResetCheck, settings]);

  return (
    <TooltipProvider>
      <Routes>
        <Route element={<AppLayout />}>
          {/* 資料管理刻意放在 CharacterGuard 外:沒有角色時也要能進來匯入備份 */}
          <Route
            path={ROUTES.backup}
            element={
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingIndicator />
                  </div>
                }
              >
                <DataManagementPage />
              </Suspense>
            }
          />
          <Route element={<CharacterGuard />}>
            <Route path={ROUTES.root} element={<CharacterBoardPage />} />
            <Route path={ROUTES.character} element={<CharacterPage />} />
          </Route>
          <Route path="*" element={<Navigate to={ROUTES.root} replace state={REDIRECT_NAV_STATE} />} />
        </Route>
      </Routes>
      <Toaster position="bottom-center" />
      <Analytics />
      <SpeedInsights />
    </TooltipProvider>
  );
}

export default App;
