import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { CharacterTabs } from '@/components/CharacterTabs';
import { CharacterHeader } from '@/components/CharacterHeader';
import { FirstCharacterOnboarding } from '@/components/FirstCharacterOnboarding';
import { TaskList } from '@/components/TaskList';
import { BossList } from '@/components/BossList';
import { BackupStatusBar } from '@/components/BackupStatusBar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';

const DataManagementPage = lazy(() => import('@/components/DataManagementPage'));

const RESET_CHECK_INTERVAL_MS = 60_000;

export function App() {
  const characters = useCharacterStore((s) => s.characters);
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId);
  const settings = useSettingsStore((s) => s.settings);
  const runTaskResetCheck = useTaskStore((s) => s.runResetCheck);
  const runBossResetCheck = useBossStore((s) => s.runResetCheck);
  const [showBackupPage, setShowBackupPage] = useState(false);

  const activeCharacter = characters.find((c) => c.id === activeCharacterId);

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
      <div className="flex min-h-svh flex-col bg-background">
        <Header onGoHome={() => setShowBackupPage(false)} onOpenDataManagement={() => setShowBackupPage(true)} />

        {showBackupPage ? (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">載入中…</div>}>
            <DataManagementPage onBack={() => setShowBackupPage(false)} />
          </Suspense>
        ) : characters.length === 0 || !activeCharacter ? (
          <FirstCharacterOnboarding onImport={() => setShowBackupPage(true)} />
        ) : (
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
            <CharacterTabs />
            <CharacterHeader character={activeCharacter} />
            <BackupStatusBar onOpenBackupPage={() => setShowBackupPage(true)} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TaskList character={activeCharacter} />
              <BossList character={activeCharacter} />
            </div>
          </main>
        )}
      </div>
      <Toaster position="bottom-center" />
    </TooltipProvider>
  );
}

export default App;
