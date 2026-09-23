import { useState } from 'react';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
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
import { BossCatalogPicker, WeeklyBossLimitHint } from '@/components/BossCatalogPicker';
import { BossSelectionPreview } from '@/components/BossSelectionPreview';
import { useAddCharacterFlow } from '@/hooks/useAddCharacterFlow';
import { resolveSelectedPresetTasks } from '@/lib/presetTasks';
import { flattenBossSelections } from '@/lib/bossCatalog';

/**
 * 新增角色對話框(自帶觸發按鈕):NEXON API 查詢/手動輸入角色資訊 → 套用預設任務 → 套用預設 BOSS → 確認建立。
 * 放在進度看板頁面,跟管理帳號並列,是新增角色的唯一入口。
 */
export function AddCharacterDialog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const flow = useAddCharacterFlow(() => setDialogOpen(false));

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        setDialogOpen(next);
        if (!next) flow.resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-4" />
          新增角色
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {flow.step === 'info' && flow.lookupPhase === 'search' ? (
          <form onSubmit={flow.handleLookup}>
            <DialogHeader>
              <DialogTitle>新增角色</DialogTitle>
              <DialogDescription>輸入遊戲內角色名稱，直接查詢您的角色資訊。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-character-lookup-name">角色名稱</Label>
                <Input
                  id="add-character-lookup-name"
                  autoFocus
                  placeholder="請輸入遊戲內角色名稱"
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
              <DialogDescription className="flex flex-col gap-1">
                <span>建立一個新角色，開始追蹤這個角色的每日/每週任務。</span>
                <span className="text-destructive">手動建立的角色不會有外觀照片</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
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
              {flow.lookupError && <p className="text-sm text-destructive">{flow.lookupError}</p>}
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

            <WeeklyBossLimitHint selections={flow.bossSelections} />

            <BossCatalogPicker
              selections={flow.bossSelections}
              onToggleDifficulty={flow.toggleBossDifficulty}
              trackedGroupKeys={new Set<string>()}
            />

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
                跳過，前往下一步
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
  );
}
