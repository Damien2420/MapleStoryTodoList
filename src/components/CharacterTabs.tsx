import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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

  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function updateScrollEdges() {
      if (!track) return;
      setCanScrollLeft(track.scrollLeft > 2);
      setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth - 2);
    }

    function handleWheel(e: WheelEvent) {
      if (!track || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }

    updateScrollEdges();
    track.addEventListener('wheel', handleWheel, { passive: false });
    track.addEventListener('scroll', updateScrollEdges);
    window.addEventListener('resize', updateScrollEdges);
    return () => {
      track.removeEventListener('wheel', handleWheel);
      track.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, [characters.length]);

  function scrollTrackBy(amount: number) {
    trackRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  }

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
      <div className="relative min-w-0 flex-1">
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-xl bg-gradient-to-r from-background to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-xl bg-gradient-to-l from-background to-transparent" />
        )}
        {canScrollLeft && (
          <button
            type="button"
            aria-label="向左捲動角色分頁"
            onClick={() => scrollTrackBy(-160)}
            className="absolute top-1/2 left-1 z-20 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label="向右捲動角色分頁"
            onClick={() => scrollTrackBy(160)}
            className="absolute top-1/2 right-1 z-20 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}

        <div
          ref={trackRef}
          className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Tabs value={activeCharacterId ?? undefined} onValueChange={setActiveCharacter} className="contents">
            <TabsList className="contents">
              {characters.map((character) => (
                <TabsTrigger
                  key={character.id}
                  value={character.id}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  {character.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

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
    </div>
  );
}