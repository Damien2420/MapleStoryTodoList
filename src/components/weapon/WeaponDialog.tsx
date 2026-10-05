import { useState, type ReactNode } from 'react';
import { Check, Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DESTINY, GENESIS } from '@/data/weaponRates.data';
import { useMediaQuery, WEAPON_WIDE_QUERY } from '@/hooks/useMediaQuery';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import type { JumpList } from '@/lib/listJump';
import { destinyCap, destinyPhaseOf, soulStageOf } from '@/lib/weapon/rules';
import { STORM_TRAINING_SERVER } from '@/lib/weapon/syncClears';
import { WEAPON_KINDS, type WeaponEvent, type WeaponKind } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import type { BossCycleKey } from '@/store/useListFilterStore';
import { useWeaponStore } from '@/store/useWeaponStore';
import type { Character } from '@/types';
import { AstraDailyStrip } from './AstraDailyStrip';
import { BoostStatusRow } from './BoostStatusRow';
import { BossQuestCard } from './BossQuestCard';
import { EstimateTimeline } from './EstimateTimeline';
import { FullEstimateDialog } from './FullEstimateDialog';
import { HoldingStats } from './HoldingStats';
import { SoulQuestCard } from './SoulQuestCard';
import { StageProgressBar } from './StageProgressBar';
import { ThisWeekCard } from './ThisWeekCard';
import { UpgradeConfirmDialog } from './UpgradeConfirmDialog';
import { WeaponRatesDialog } from './WeaponRatesDialog';
import { WeaponSetupDialog, type SetupResult } from './WeaponSetupDialog';
import { WeaponStatusView } from './WeaponStatusView';
import { fmt, headModel, timelineModel, WEAPON_META } from './weaponUi';

/** 疊在武器管理視窗上方的小視窗 */
type Overlay = { type: 'setup' | 'upgrade' | 'rates' | 'full'; kind: WeaponKind } | null;

/**
 * 武器管理視窗:四把武器各一個 Tab。桌面拓寬到 820px 分成兩欄,時間軸橫跨底部;手機單欄,標題與 Tab 固定、內容在視窗內捲動
 * @param character 角色
 * @param progress useWeaponProgress 的結果
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 * @param onJump 「前往 BOSS／任務清單」時呼叫(先關閉視窗)
 */
export function WeaponDialog({
  character,
  progress,
  open,
  onOpenChange,
  onJump,
}: {
  character: Character;
  progress: WeaponProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (cycle: BossCycleKey, lists: JumpList[]) => void;
}) {
  const wide = useMediaQuery(WEAPON_WIDE_QUERY);
  // 預設開在第一把進行中的武器,都沒有時開在靈魂
  const [tab, setTab] = useState<WeaponKind>(() => WEAPON_KINDS.find((k) => progress.status[k] === 'active') ?? 'soul');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const addEvent = useWeaponStore((s) => s.addEvent);
  const setProfile = useWeaponStore((s) => s.setProfile);

  /** 建立事件並寫入 store */
  const emit = (kind: WeaponEvent['kind'], weapon: WeaponKind, payload?: WeaponEvent['payload'], fixedId?: string) => {
    const at = new Date().toISOString();
    addEvent({ id: fixedId ?? `${character.id}:${weapon}:${kind}:${crypto.randomUUID()}`, characterId: character.id, weapon, kind, payload, at, updatedAt: at });
  };

  const handleSave = (kind: WeaponKind, result: SetupResult) => {
    if (result.profile) setProfile(character.id, result.profile);
    emit('adjust', kind, result.payload);
    setOverlay(null);
  };
  const handleUpgrade = (kind: WeaponKind, soulQuestKey?: string) => {
    const s = progress.state;
    const fromStage =
      kind === 'soul' ? soulStageOf(s.soul.level, false) : kind === 'genesis' ? s.genesis.stage : kind === 'destiny' ? s.destiny.stage : s.astra.stage;
    const phase = kind === 'destiny' ? destinyPhaseOf(fromStage) : 1;
    emit('upgrade', kind, { fromStage, soulQuestKey }, `${character.id}:${kind}:up:${phase}:${fromStage}`);
    setOverlay(null);
  };
  const jump = (cycle: BossCycleKey, list: JumpList) => {
    onOpenChange(false);
    onJump(cycle, [list]);
  };

  const panel = (kind: WeaponKind): ReactNode => {
    const status = progress.status[kind];
    if (status !== 'active') {
      return (
        <WeaponStatusView
          kind={kind}
          status={status}
          onSetup={() => setOverlay({ type: 'setup', kind })}
          onStartPhase2={() => emit('destinyPhase2', 'destiny')}
          unlock={{ genesisDone: progress.state.genesis.status === 'done', level: character.level }}
          onGoGenesis={() => setTab('genesis')}
        />
      );
    }
    return <ActivePanel kind={kind} progress={progress} character={character} wide={wide} setOverlay={setOverlay} jump={jump} />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-5 sm:max-w-md md:max-w-[820px] md:gap-[18px] md:p-6">
        <div className="flex min-w-0 items-baseline gap-2 pr-8">
          <DialogTitle className="shrink-0 text-base font-semibold">武器管理</DialogTitle>
          <DialogDescription className="truncate text-sm">{character.name}</DialogDescription>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as WeaponKind)} className="flex min-h-0 flex-col gap-4 md:gap-[18px]">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-[10px]">
            {WEAPON_KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="min-w-0 gap-1 px-1 py-[5px] text-sm pointer-coarse:min-h-11">
                {WEAPON_META[k].tab}
                {progress.status[k] === 'locked' && <Lock aria-label="尚未解鎖" className="size-3 text-muted-foreground" />}
                {progress.status[k] === 'done' && <Check aria-label="已完成" className="size-3 text-secondary-foreground" strokeWidth={3} />}
              </TabsTrigger>
            ))}
          </TabsList>
          {WEAPON_KINDS.map((k) => (
            <TabsContent
              key={k}
              value={k}
              // 最小高度讓鎖定、未設定等較短的分頁和進行中的分頁差不多高,切換分頁時視窗不會忽大忽小
              className="-mx-5 min-h-[min(32rem,55dvh)] overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin] data-[state=active]:flex data-[state=active]:flex-col md:-mx-6 md:min-h-[22rem] md:px-6"
            >
              {panel(k)}
            </TabsContent>
          ))}
        </Tabs>

        {overlay?.type === 'setup' && (
          <WeaponSetupDialog
            kind={overlay.kind}
            progress={progress}
            character={character}
            open
            onOpenChange={(o) => !o && setOverlay(null)}
            onSave={(r) => handleSave(overlay.kind, r)}
            onComplete={() => {
              emit('complete', overlay.kind);
              setOverlay(null);
            }}
          />
        )}
        {overlay?.type === 'upgrade' && (
          <UpgradeConfirmDialog
            kind={overlay.kind}
            progress={progress}
            open
            onOpenChange={(o) => !o && setOverlay(null)}
            onConfirm={(key) => handleUpgrade(overlay.kind, key)}
          />
        )}
        {overlay?.type === 'rates' && <WeaponRatesDialog kind={overlay.kind} open onOpenChange={(o) => !o && setOverlay(null)} />}
        {overlay?.type === 'full' && (overlay.kind === 'soul' || overlay.kind === 'destiny') && (
          <FullEstimateDialog kind={overlay.kind} progress={progress} open onOpenChange={(o) => !o && setOverlay(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 進行中武器的內容:桌面兩欄(左欄進度與任務、右欄本週已取得;靈魂左右對調),時間軸橫跨底部;手機單欄
 */
function ActivePanel({
  kind,
  progress,
  character,
  wide,
  setOverlay,
  jump,
}: {
  kind: WeaponKind;
  progress: WeaponProgress;
  character: Character;
  wide: boolean;
  setOverlay: (o: Overlay) => void;
  jump: (cycle: BossCycleKey, list: JumpList) => void;
}) {
  const head = headModel(kind, progress);
  const timeline = timelineModel(kind, progress);
  const { state } = progress;
  const soul = kind === 'soul';
  const tw = progress.thisWeek.weapons[kind];
  const upgrade = () => setOverlay({ type: 'upgrade', kind });
  const showFull = (soul && soulStageOf(state.soul.level, state.soul.gatePassed) < 10) || (kind === 'destiny' && destinyPhaseOf(state.destiny.stage) === 1);

  const headPart = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xl leading-[1.1] font-bold whitespace-nowrap tabular-nums">
          {head.stage}
          <small className="ml-1 text-sm font-medium text-muted-foreground">
            {head.stageSub}
            {head.waiting && (
              <>
                {' · '}
                <span className="font-semibold text-secondary-foreground">待升階</span>
              </>
            )}
          </small>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOverlay({ type: 'setup', kind })}
          className="relative -mr-2 shrink-0 text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']"
        >
          <Pencil aria-hidden="true" />
          {WEAPON_META[kind].adjust}
        </Button>
      </div>
      <StageProgressBar segments={head.segments} current={head.current} percent={head.percent} percentLabel={head.percentLabel} />
      {kind === 'genesis' && (
        <BoostStatusRow
          genesisPass={progress.profile.genesisPass}
          stormTraining={progress.profile.stormTraining}
          challenger={character.server === STORM_TRAINING_SERVER}
        />
      )}
    </div>
  );

  const card = (
    <ThisWeekCard
      kind={kind}
      data={tw}
      mobile={!wide}
      destinyCap={fmt(destinyCap(state.destiny.stage))}
      onGoBossList={() => jump('weekly', 'boss')}
      onRates={() => setOverlay({ type: 'rates', kind })}
      className={wide && !soul ? 'flex-1' : undefined}
    />
  );

  const quest =
    kind === 'genesis' ? (
      <BossQuestCard
        heading="BOSS 任務"
        name={GENESIS.quests[state.genesis.stage - 1].name}
        bossCatalogId={GENESIS.quests[state.genesis.stage - 1].bossCatalogId}
        ready={head.waiting}
        onUpgrade={upgrade}
      />
    ) : kind === 'destiny' ? (
      <BossQuestCard
        heading="BOSS 任務"
        name={DESTINY.quests[state.destiny.stage - 1].name}
        bossCatalogId={DESTINY.quests[state.destiny.stage - 1].bossCatalogId}
        ready={head.waiting}
        onUpgrade={upgrade}
      />
    ) : kind === 'astra' ? (
      <BossQuestCard heading="升階條件" name="兩種素材都達到本階需求" ready={head.waiting} onUpgrade={upgrade} />
    ) : null;
  const daily = kind === 'astra' && <AstraDailyStrip daily={progress.thisWeek.daily} onGoTaskList={() => jump('daily', 'task')} />;
  const timelinePart = (
    <EstimateTimeline
      // 換武器或資料變動後節點數量可能不同,重新掛載以清掉固定的選取
      key={`${kind}-${timeline.ticks.length}-${timeline.value}`}
      model={timeline}
      desktop={wide}
      fullLabel={showFull ? (soul ? '查看滿等預估時間軸' : '查看完整預估時間軸') : undefined}
      onFull={() => setOverlay({ type: 'full', kind })}
    />
  );

  if (wide) {
    return (
      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-stretch gap-6">
          <div className="flex min-w-0 flex-col gap-3.5">
            {headPart}
            <HoldingStats stats={head.stats} />
            {soul ? (
              card
            ) : (
              <>
                {quest}
                {daily}
              </>
            )}
          </div>
          {/* 右欄不參與列高計算,高度等於左欄;本週已取得清單再多也只在卡片內捲動 */}
          <div className={cn('flex min-w-0 flex-col', !soul && '[contain:size]')}>
            {soul ? (
              <SoulQuestCard soul={state.soul} onUpgrade={upgrade} className="flex-1" />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">{card}</div>
            )}
          </div>
        </div>
        {timelinePart}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {headPart}
      <HoldingStats stats={head.stats} />
      {/* 待升階時升階任務卡排在本週已取得之前,不用捲到最底才看到按鈕 */}
      {soul ? (
        <>
          {head.waiting && <SoulQuestCard soul={state.soul} onUpgrade={upgrade} />}
          {card}
          {!head.waiting && <SoulQuestCard soul={state.soul} onUpgrade={upgrade} />}
        </>
      ) : (
        <>
          {head.waiting && quest}
          {daily}
          {card}
          {!head.waiting && quest}
        </>
      )}
      {timelinePart}
    </div>
  );
}
