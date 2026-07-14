import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { CharacterLookupResult } from '@/components/CharacterLookupResult';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { BossCatalogPicker } from '@/components/BossCatalogPicker';
import { BossSelectionPreview } from '@/components/BossSelectionPreview';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useAddCharacterFlow } from '@/hooks/useAddCharacterFlow';
import { resolveSelectedPresetTasks } from '@/lib/presetTasks';
import { flattenBossSelections } from '@/lib/bossCatalog';

/** 角色分頁列:切換目前檢視的角色,並提供新增/刪除角色的入口 */
export function CharacterTabs() {
  const characters = useCharacterStore((s) => s.characters);
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId);
  const setActiveCharacter = useCharacterStore((s) => s.setActiveCharacter);

  const [dialogOpen, setDialogOpen] = useState(false);
  const flow = useAddCharacterFlow(() => setDialogOpen(false));

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
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-primary/25"
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
          if (!next) flow.resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-1.5 rounded-lg">
            <Plus className="size-4" />
            新增角色
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          {flow.step === 'info' && flow.lookupPhase === 'search' ? (
            <form onSubmit={flow.handleLookup}>
              <DialogHeader>
                <DialogTitle>新增角色</DialogTitle>
                <DialogDescription>輸入遊戲內角色名稱,自動查詢伺服器、等級與職業。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div className="space-y-2">
                  <Label htmlFor="add-character-lookup-name">角色名稱</Label>
                  <Input
                    id="add-character-lookup-name"
                    autoFocus
                    placeholder="輸入遊戲內角色名稱"
                    value={flow.name}
                    onChange={(e) => flow.setName(e.target.value)}
                  />
                </div>
                {flow.lookupError && <p className="text-sm text-destructive">{flow.lookupError}</p>}
              </div>
              <DialogFooter className="sm:flex-col">
                <Button type="submit" className="w-full gap-1.5" disabled={!flow.name.trim() || flow.lookupLoading}>
                  {flow.lookupLoading && <Loader2 className="size-4 animate-spin" />}
                  {flow.lookupLoading ? '查詢中…' : '查詢角色'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={flow.switchToManualEntry}>
                  改為手動輸入
                </Button>
              </DialogFooter>
            </form>
          ) : flow.step === 'info' && flow.lookupPhase === 'result' ? (
            <div>
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={flow.retryLookup}
                >
                  <ArrowLeft className="size-3.5" />
                  返回角色查詢
                </Button>
                <DialogTitle>確認角色資訊</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <CharacterLookupResult
                  info={{
                    name: flow.name,
                    level: flow.enteredLevel,
                    job: flow.job ?? '',
                    world: flow.server,
                    imageUrl: flow.imageUrl,
                  }}
                  onConfirm={flow.confirmLookupResult}
                  onRetry={flow.retryLookup}
                />
              </div>
            </div>
          ) : flow.step === 'info' ? (
            <form onSubmit={flow.handleInfoSubmit}>
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={() => flow.setLookupPhase('search')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回角色查詢
                </Button>
                <DialogTitle>新增角色</DialogTitle>
                <DialogDescription>建立一個新角色，開始追蹤這個角色的每日/每週任務。</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <CharacterFormFields
                  idPrefix="add-character"
                  name={flow.name}
                  onNameChange={flow.setName}
                  server={flow.server}
                  onServerChange={flow.setServer}
                  level={flow.level}
                  onLevelChange={flow.setLevel}
                  job={flow.job}
                  onJobChange={flow.setJob}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!flow.canSubmit}>
                  下一步
                </Button>
              </DialogFooter>
            </form>
          ) : flow.step === 'presets' ? (
            <div className="space-y-4">
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={() => flow.setStep('info')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回角色資訊
                </Button>
                <DialogTitle>套用預設任務(選填)</DialogTitle>
                <DialogDescription>勾選要一併建立的預設任務，或直接跳過。</DialogDescription>
              </DialogHeader>

              <PresetTaskPicker
                selectedIds={flow.selectedPresetIds}
                onToggle={flow.togglePreset}
                characterLevel={flow.enteredLevel}
              />

              <DialogFooter className="sm:flex-col">
                <Button
                  type="button"
                  className="w-full"
                  disabled={flow.selectedPresetIds.size === 0}
                  onClick={() =>
                    flow.continueFromPresets(resolveSelectedPresetTasks(flow.selectedPresetIds, flow.enteredLevel))
                  }
                >
                  套用所選並前往下一步({flow.selectedPresetIds.size})
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => flow.continueFromPresets([])}>
                  跳過，前往下一步
                </Button>
              </DialogFooter>
            </div>
          ) : flow.step === 'bosses' ? (
            <div className="space-y-4">
              <DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit gap-1 text-muted-foreground"
                  onClick={() => flow.setStep('presets')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回預設任務
                </Button>
                <DialogTitle>套用預設 BOSS(選填)</DialogTitle>
                <DialogDescription>勾選要一併追蹤的 BOSS 與難度，或直接跳過。</DialogDescription>
              </DialogHeader>

              <BossCatalogPicker selections={flow.bossSelections} onToggleDifficulty={flow.toggleBossDifficulty} />

              <DialogFooter className="sm:flex-col">
                <Button
                  type="button"
                  className="w-full"
                  disabled={flattenBossSelections(flow.bossSelections).length === 0}
                  onClick={() => flow.continueFromBosses(flattenBossSelections(flow.bossSelections))}
                >
                  套用所選並前往確認({flattenBossSelections(flow.bossSelections).length})
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => flow.continueFromBosses([])}>
                  跳過，前往確認
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
                  onClick={() => flow.setStep('bosses')}
                >
                  <ArrowLeft className="size-3.5" />
                  返回預設 BOSS
                </Button>
                <DialogTitle>確認建立以下內容</DialogTitle>
                <DialogDescription>確認無誤後即可建立角色，建立後可再自行調整。</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">任務({flow.resolvedPresetTasks.length})</p>
                  <PresetTaskPreview tasks={flow.resolvedPresetTasks} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">BOSS({flow.resolvedBossSelections.length})</p>
                  <BossSelectionPreview selections={flow.resolvedBossSelections} />
                </div>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={() => flow.createCharacter(flow.resolvedPresetTasks, flow.resolvedBossSelections)}
              >
                確認新增角色
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
