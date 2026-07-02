import { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Sun, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CharacterTabs } from '@/components/CharacterTabs';
import { CharacterFormFields } from '@/components/CharacterFormFields';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { TaskList } from '@/components/TaskList';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useTheme } from '@/components/theme-provider';
import { resolveSelectedPresetTasks, type PresetTask } from '@/lib/presetTasks';
import { CHARACTER_NAME_MAX_LENGTH, SERVERS, type JobGroup, type Server } from '@/types';

const RESET_CHECK_INTERVAL_MS = 60_000;

type OnboardingStep = 'info' | 'presets' | 'confirm';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={isDark ? '切換為淺色主題' : '切換為深色主題'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function FirstCharacterOnboarding() {
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const addPresetTasks = useTaskStore((s) => s.addPresetTasks);
  const [step, setStep] = useState<OnboardingStep>('info');
  const [name, setName] = useState('');
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [level, setLevel] = useState('');
  const [jobGroup, setJobGroup] = useState<JobGroup | undefined>(undefined);
  const [job, setJob] = useState<string | undefined>(undefined);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [resolvedPresetTasks, setResolvedPresetTasks] = useState<PresetTask[]>([]);

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

  const canSubmit =
    name.trim().length > 0 && name.length <= CHARACTER_NAME_MAX_LENGTH && !!jobGroup && !!job;
  const enteredLevel = Number(level) || 1;

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep('presets');
  }

  function handleReviewPresets() {
    if (selectedPresetIds.size === 0) return;
    setResolvedPresetTasks(resolveSelectedPresetTasks(selectedPresetIds, enteredLevel));
    setStep('confirm');
  }

  function createCharacter(tasks: PresetTask[]) {
    if (!canSubmit) return;
    const newCharacterId = addCharacter({ name, server, level: enteredLevel, jobGroup: jobGroup!, job: job! });
    if (tasks.length > 0) {
      addPresetTasks(newCharacterId, tasks);
    }
    setStep('info');
    setName('');
    setLevel('');
    setJobGroup(undefined);
    setJob(undefined);
    setSelectedPresetIds(new Set());
    setResolvedPresetTasks([]);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <UserPlus className="size-6" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">建立第一個角色</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          每個角色會獨立管理自己的每日/每週任務進度,先建立一個角色開始追蹤吧。
        </p>
      </div>

      {step === 'info' ? (
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
            <Button type="button" disabled={selectedPresetIds.size === 0} onClick={handleReviewPresets}>
              套用所選並新增角色({selectedPresetIds.size})
            </Button>
            <Button type="button" variant="outline" onClick={() => createCharacter([])}>
              跳過,直接新增角色
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
            onClick={() => setStep('presets')}
          >
            <ArrowLeft className="size-3.5" />
            返回預設任務
          </Button>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">確認建立以下任務</h2>
            <p className="text-sm text-muted-foreground">確認無誤後即可建立角色,建立後可再自行調整。</p>
          </div>

          <PresetTaskPreview tasks={resolvedPresetTasks} />

          <Button type="button" onClick={() => createCharacter(resolvedPresetTasks)}>
            確認新增角色({resolvedPresetTasks.length})
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
  const runResetCheck = useTaskStore((s) => s.runResetCheck);

  const activeCharacter = characters.find((c) => c.id === activeCharacterId);

  useEffect(() => {
    runResetCheck(settings);
    const interval = setInterval(() => runResetCheck(settings), RESET_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runResetCheck, settings]);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <h1 className="text-base font-semibold tracking-tight text-foreground">任務追蹤</h1>
          <ThemeToggle />
        </header>

        {characters.length === 0 || !activeCharacter ? (
          <FirstCharacterOnboarding />
        ) : (
          <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
            <CharacterTabs />
            <TaskList character={activeCharacter} />
          </main>
        )}
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
