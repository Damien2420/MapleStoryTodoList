import { ArrowLeft, Cloud, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CharacterFormFields } from '@/components/CharacterFormFields';
import { CharacterLookupResult } from '@/components/CharacterLookupResult';
import { PresetTaskPicker } from '@/components/PresetTaskPicker';
import { PresetTaskPreview } from '@/components/PresetTaskPreview';
import { BossCatalogPicker } from '@/components/BossCatalogPicker';
import { BossSelectionPreview } from '@/components/BossSelectionPreview';
import { useAddCharacterFlow } from '@/hooks/useAddCharacterFlow';
import { resolveSelectedPresetTasks } from '@/lib/presetTasks';
import { flattenBossSelections } from '@/lib/bossCatalog';

/** 首次使用引導畫面:角色數為 0 時顯示,提供 NEXON API 查詢或手動輸入建立第一個角色 */
export function FirstCharacterOnboarding({ onImport }: { onImport: () => void }) {
  const flow = useAddCharacterFlow();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center overflow-y-auto">
      {flow.step === 'info' && flow.lookupPhase === 'search' && (
        <>
          <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UserPlus className="size-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">建立第一個角色</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              每個角色會獨立管理自己的每日/每週任務進度，先建立一個角色開始追蹤吧。
            </p>
          </div>
        </>
      )}

      {flow.step === 'info' && flow.lookupPhase === 'search' ? (
        <>
          <form onSubmit={flow.handleLookup} className="flex w-full max-w-xs sm:max-w-sm flex-col gap-3">
            <div className="space-y-2 text-left">
              <Label htmlFor="onboarding-lookup-name">角色名稱</Label>
              <Input
                id="onboarding-lookup-name"
                autoFocus
                placeholder="輸入遊戲內角色名稱"
                value={flow.name}
                onChange={(e) => flow.setName(e.target.value)}
              />
            </div>
            {flow.lookupError && <p className="text-sm text-destructive">{flow.lookupError}</p>}
            <Button type="submit" className="gap-1.5" disabled={!flow.name.trim() || flow.lookupLoading}>
              {flow.lookupLoading && <Loader2 className="size-4 animate-spin" />}
              {flow.lookupLoading ? '查詢中…' : '查詢角色'}
            </Button>
            <Button type="button" variant="outline" onClick={flow.switchToManualEntry}>
              改為手動輸入
            </Button>
          </form>

          <div className="flex w-full max-w-xs sm:max-w-sm flex-col items-center gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">有已建立的角色紀錄嗎？</p>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onImport}>
              <Cloud className="size-3.5" />
              從檔案或 Google Drive 匯入
            </Button>
          </div>
        </>
      ) : flow.step === 'info' && flow.lookupPhase === 'result' ? (
        <div className="flex w-full max-w-xs sm:max-w-sm flex-col gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={flow.retryLookup}
          >
            <ArrowLeft className="size-3.5" />
            返回角色查詢
          </Button>
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
      ) : flow.step === 'info' ? (
        <>
          <form onSubmit={flow.handleInfoSubmit} className="flex w-full max-w-xs sm:max-w-sm flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
              onClick={() => flow.setLookupPhase('search')}
            >
              <ArrowLeft className="size-3.5" />
              返回角色查詢
            </Button>
            <CharacterFormFields
              idPrefix="onboarding"
              name={flow.name}
              onNameChange={flow.setName}
              server={flow.server}
              onServerChange={flow.setServer}
              level={flow.level}
              onLevelChange={flow.setLevel}
              job={flow.job}
              onJobChange={flow.setJob}
            />
            <Button type="submit" disabled={!flow.canSubmit}>
              下一步
            </Button>
          </form>
        </>
      ) : flow.step === 'presets' ? (
        <div className="flex w-full max-w-sm sm:max-w-md lg:max-w-2xl flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => flow.setStep('info')}
          >
            <ArrowLeft className="size-3.5" />
            返回角色資訊
          </Button>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">套用預設任務</h2>
            <p className="text-sm text-muted-foreground">勾選要一併建立的每日/每週任務。</p>
          </div>

          <PresetTaskPicker
            selectedIds={flow.selectedPresetIds}
            onToggle={flow.togglePreset}
            characterLevel={flow.enteredLevel}
          />

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={flow.selectedPresetIds.size === 0}
              onClick={() =>
                flow.continueFromPresets(resolveSelectedPresetTasks(flow.selectedPresetIds, flow.enteredLevel))
              }
            >
              套用所選預設任務({flow.selectedPresetIds.size})
            </Button>
            <Button type="button" variant="outline" onClick={() => flow.continueFromPresets([])}>
              跳過，前往下一步
            </Button>
          </div>
        </div>
      ) : flow.step === 'bosses' ? (
        <div className="flex w-full max-w-sm sm:max-w-md lg:max-w-2xl flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => flow.setStep('presets')}
          >
            <ArrowLeft className="size-3.5" />
            返回預設任務
          </Button>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">套用預設 BOSS</h2>
            <p className="text-sm text-muted-foreground">勾選要一併追蹤的 BOSS 討伐難度。</p>
          </div>

          <BossCatalogPicker selections={flow.bossSelections} onToggleDifficulty={flow.toggleBossDifficulty} />

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={flattenBossSelections(flow.bossSelections).length === 0}
              onClick={() => flow.continueFromBosses(flattenBossSelections(flow.bossSelections))}
            >
              建立所選BOSS追蹤({flattenBossSelections(flow.bossSelections).length})
            </Button>
            <Button type="button" variant="outline" onClick={() => flow.continueFromBosses([])}>
              跳過，前往確認
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-sm sm:max-w-md lg:max-w-2xl flex-col gap-4 text-left">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1 self-start text-muted-foreground"
            onClick={() => flow.setStep('bosses')}
          >
            <ArrowLeft className="size-3.5" />
            返回預設 BOSS
          </Button>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">確認建立以下內容</h2>
            <p className="text-sm text-muted-foreground">確認無誤後即可建立角色，建立後可再自行調整。</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">預設任務 ( {flow.resolvedPresetTasks.length} )</p>
              <PresetTaskPreview tasks={flow.resolvedPresetTasks} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">BOSS ( {flow.resolvedBossSelections.length} )</p>
              <BossSelectionPreview selections={flow.resolvedBossSelections} />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => flow.createCharacter(flow.resolvedPresetTasks, flow.resolvedBossSelections)}
          >
            確認新增角色
          </Button>
        </div>
      )}
    </div>
  );
}
