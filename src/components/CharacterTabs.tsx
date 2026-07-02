import { useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CharacterFormFields } from '@/components/CharacterFormFields';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { resolveSelectedPresetTasks, type PresetTask } from '@/lib/presetTasks';
import { CHARACTER_NAME_MAX_LENGTH, SERVERS, type JobGroup, type Server } from '@/types';

type AddCharacterStep = 'info' | 'presets' | 'confirm';

/** 角色分頁列:切換目前檢視的角色,並提供新增/刪除角色的入口 */
export function CharacterTabs() {
  const characters = useCharacterStore((s) => s.characters);
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId);
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);
  const removeTasksForCharacter = useTaskStore((s) => s.removeTasksForCharacter);
  const addPresetTasks = useTaskStore((s) => s.addPresetTasks);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<AddCharacterStep>('info');
  const [name, setName] = useState('');
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [level, setLevel] = useState('');
  const [jobGroup, setJobGroup] = useState<JobGroup | undefined>(undefined);
  const [job, setJob] = useState<string | undefined>(undefined);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [resolvedPresetTasks, setResolvedPresetTasks] = useState<PresetTask[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteCharacter = characters.find((c) => c.id === pendingDeleteId);

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

  function confirmDelete() {
    if (!pendingDeleteId) return;
    removeTasksForCharacter(pendingDeleteId);
    removeCharacter(pendingDeleteId);
    setPendingDeleteId(null);
  }

  function resetForm() {
    setStep('info');
    setName('');
    setServer(SERVERS[0]);
    setLevel('');
    setJobGroup(undefined);
    setJob(undefined);
    setSelectedPresetIds(new Set());
    setResolvedPresetTasks([]);
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
    resetForm();
    setDialogOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Tabs
        value={activeCharacterId ?? undefined}
        onValueChange={setActiveCharacter}
        className="min-w-0 flex-1"
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {characters.map((character) => (
            <div key={character.id} className="group/tab relative">
              <TabsTrigger
                value={character.id}
                className="rounded-lg border border-transparent py-2 pr-7 pl-4 text-sm font-medium data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {character.name}
              </TabsTrigger>
              <button
                type="button"
                aria-label={`刪除角色 ${character.name}`}
                onClick={() => setPendingDeleteId(character.id)}
                className="absolute top-1/2 right-1.5 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover/tab:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </TabsList>
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-1.5 rounded-lg">
            <Plus className="size-4" />
            新增角色
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          {step === 'info' ? (
            <form onSubmit={handleInfoSubmit}>
              <DialogHeader>
                <DialogTitle>新增角色</DialogTitle>
                <DialogDescription>建立一個新角色,開始追蹤這個角色的每日/每週任務。</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <CharacterFormFields
                  idPrefix="add-character"
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
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!canSubmit}>
                  下一步
                </Button>
              </DialogFooter>
            </form>
          ) : step === 'presets' ? (
            <div className="space-y-4">
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={() => setStep('info')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回角色資訊
                </Button>
                <DialogTitle>套用預設任務(選填)</DialogTitle>
                <DialogDescription>勾選要一併建立的預設任務,或直接跳過。</DialogDescription>
              </DialogHeader>

              <PresetTaskPicker selectedIds={selectedPresetIds} onToggle={togglePreset} characterLevel={enteredLevel} />

              <DialogFooter className="sm:flex-col">
                <Button
                  type="button"
                  className="w-full"
                  disabled={selectedPresetIds.size === 0}
                  onClick={handleReviewPresets}
                >
                  套用所選並新增角色({selectedPresetIds.size})
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => createCharacter([])}>
                  跳過,直接新增角色
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={() => setStep('presets')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回預設任務
                </Button>
                <DialogTitle>確認建立以下任務</DialogTitle>
                <DialogDescription>確認無誤後即可建立角色,建立後可再自行調整。</DialogDescription>
              </DialogHeader>

              <PresetTaskPreview tasks={resolvedPresetTasks} />

              <Button type="button" className="w-full" onClick={() => createCharacter(resolvedPresetTasks)}>
                確認新增角色({resolvedPresetTasks.length})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(next) => !next && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除角色「{pendingDeleteCharacter?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作無法還原,將會刪除此角色以及底下所有任務的進度紀錄。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              刪除角色
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}