import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, Cloud, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { CharacterTabs } from '@/components/CharacterTabs';
import { CharacterHeader } from '@/components/CharacterHeader';
import { CharacterFormFields } from '@/components/CharacterFormFields';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { BossCatalogPicker } from '@/components/BossCatalogPicker';
import { BossSelectionPreview } from '@/components/BossSelectionPreview';
import { TaskList } from '@/components/TaskList';
import { BossList } from '@/components/BossList';
import { DashboardSummary } from '@/components/DashboardSummary';
import { BackupStatusBar } from '@/components/BackupStatusBar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { resolveSelectedPresetTasks, type PresetTask } from '@/lib/presetTasks';
import { flattenBossSelections, type BossSelection } from '@/lib/bossCatalog';
import { SERVERS, type Server } from '@/lib/servers';
import type { JobGroup } from '@/lib/jobs';
import { CHARACTER_NAME_MAX_LENGTH, type BossDifficulty } from '@/types';

const DataManagementPage = lazy(() => import('@/components/DataManagementPage'));

const RESET_CHECK_INTERVAL_MS = 60_000;

type OnboardingStep = 'info' | 'presets' | 'bosses' | 'confirm';

function FirstCharacterOnboarding({ onImport }: { onImport: () => void }) {
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const addPresetTasks = useTaskStore((s) => s.addPresetTasks);
  const addBosses = useBossStore((s) => s.addBosses);
  const [step, setStep] = useState<OnboardingStep>('info');
  const [name, setName] = useState('');
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [level, setLevel] = useState('');
  const [jobGroup, setJobGroup] = useState<JobGroup | undefined>(undefined);
  const [job, setJob] = useState<string | undefined>(undefined);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [resolvedPresetTasks, setResolvedPresetTasks] = useState<PresetTask[]>([]);
  const [bossSelections, setBossSelections] = useState<Map<string, Set<BossDifficulty>>>(new Map());
  const [resolvedBossSelections, setResolvedBossSelections] = useState<BossSelection[]>([]);

  function togglePreset(id: string) {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleBossDifficulty(bossId: string, difficulty: BossDifficulty) {
    setBossSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(bossId));
      if (set.has(difficulty)) set.delete(difficulty);
      else set.add(difficulty);
      if (set.size === 0) next.delete(bossId);
      else next.set(bossId, set);
      return next;
    });
  }

  const canSubmit =
    name.trim().length > 0 && name.length <= CHARACTER_NAME_MAX_LENGTH && !!jobGroup && !!job;
  const enteredLevel = Number(level) || 1;

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep('presets');
  }

  function continueFromPresets(tasks: PresetTask[]) {
    setResolvedPresetTasks(tasks);
    setStep('bosses');
  }

  function continueFromBosses(selections: BossSelection[]) {
    setResolvedBossSelections(selections);
    setStep('confirm');
  }

  function createCharacter(tasks: PresetTask[], bosses: BossSelection[]) {
    if (!canSubmit) return;
    const newCharacterId = addCharacter({ name, server, level: enteredLevel, jobGroup: jobGroup!, job: job! });
    if (tasks.length > 0) {
      addPresetTasks(newCharacterId, tasks);
    }
    if (bosses.length > 0) {
      addBosses(newCharacterId, bosses);
    }
    setStep('info');
    setName('');
    setLevel('');
    setJobGroup(undefined);
    setJob(undefined);
    setSelectedPresetIds(new Set());
    setResolvedPresetTasks([]);
    setBossSelections(new Map());
    setResolvedBossSelections([]);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <UserPlus className="size-6" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">建立第一個角色</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          每個角色會獨立管理自己的每日/每週任務進度，先建立一個角色開始追蹤吧。
        </p>
      </div>

      {step === 'info' ? (
        <>
          <form onSubmit={handleInfoSubmit} className="flex w-full max-w-xs flex-col gap-4">
            <CharacterFormFields
              idPrefix="onboarding"
              name={name}
              onNameChange={setName}
              server={server}
              onServerChange={setServer}
              level={level}
              onLevelChange={setLevel}
              jobGroup={jobGroup}
              job={job}
              onJobChange={(g, j) => {
                setJobGroup(g);
                setJob(j);
              }}
              autoFocusName
            />
            <Button type="submit" disabled={!canSubmit}>
              下一步
            </Button>
          </form>

          <div className="flex w-full max-w-xs flex-col items-center gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">有已建立的角色紀錄嗎？</p>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onImport}>
              <Cloud className="size-3.5" />
              從檔案或 Google Drive 匯入
            </Button>
          </div>
        </>
      ) : step === 'presets' ? (
        <div className="flex w-full max-w-sm flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => setStep('info')}
          >
            <ArrowLeft className="size-3.5" />
            返回角色資訊
          </Button>

          <PresetTaskPicker selectedIds={selectedPresetIds} onToggle={togglePreset} characterLevel={enteredLevel} />

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={selectedPresetIds.size === 0}
              onClick={() => continueFromPresets(resolveSelectedPresetTasks(selectedPresetIds, enteredLevel))}
            >
              套用所選並前往下一步({selectedPresetIds.size})
            </Button>
            <Button type="button" variant="outline" onClick={() => continueFromPresets([])}>
              跳過，前往下一步
            </Button>
          </div>
        </div>
      ) : step === 'bosses' ? (
        <div className="flex w-full max-w-sm flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => setStep('presets')}
          >
            <ArrowLeft className="size-3.5" />
            返回預設任務
          </Button>

          <BossCatalogPicker selections={bossSelections} onToggleDifficulty={toggleBossDifficulty} />

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={flattenBossSelections(bossSelections).length === 0}
              onClick={() => continueFromBosses(flattenBossSelections(bossSelections))}
            >
              套用所選並前往下一步({flattenBossSelections(bossSelections).length})
            </Button>
            <Button type="button" variant="outline" onClick={() => continueFromBosses([])}>
              跳過，前往確認
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => setStep('bosses')}
          >
            <ArrowLeft className="size-3.5" />
            返回預設 BOSS
          </Button>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">確認建立以下內容</h2>
            <p className="text-sm text-muted-foreground">確認無誤後即可建立角色,建立後可再自行調整。</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">任務({resolvedPresetTasks.length})</p>
            <PresetTaskPreview tasks={resolvedPresetTasks} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">BOSS({resolvedBossSelections.length})</p>
            <BossSelectionPreview selections={resolvedBossSelections} />
          </div>

          <Button type="button" onClick={() => createCharacter(resolvedPresetTasks, resolvedBossSelections)}>
            確認新增角色
          </Button>
        </div>
      )}
    </div>
  );
}

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
            <DashboardSummary character={activeCharacter} />
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
