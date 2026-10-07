import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, Check, ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/animate-ui/components/radix/radio-group';
import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ASTRA, GENESIS, SOUL_LEVEL_COSTS, SOUL_QUESTS } from '@/data/weaponRates.data';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { soulAfterAdjust } from '@/lib/weapon/fold';
import { clearAmounts, toDisplay } from '@/lib/weapon/rates';
import {
  astraPercent,
  destinyCap,
  destinyNeed,
  destinyPercent,
  destinyPhaseOf,
  genesisNeed,
  genesisPercent,
  soulAtGate,
  soulCostBetween,
  soulLevelUp,
  soulNextCost,
  soulStageOf,
} from '@/lib/weapon/rules';
import { STORM_TRAINING_SERVER } from '@/lib/weapon/syncClears';
import type { ThisWeekRow } from '@/lib/weapon/thisWeek';
import { soloKey, UNIT, type AdjustPayload, type SoulState, type WeaponKind } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import type { BossDifficulty, Character } from '@/types';
import { BossTilePicker } from './BossTilePicker';
import { COARSE_HIT, DifficultyTag, MonthlyTag, VipTag } from './parts';
import { bossName, fmt, fmtUnits, WEAPON_META } from './weaponUi';

/** 「標記為已完成」入口的說明與確認畫面列出的影響 */
const COMPLETE_TEXT: Record<WeaponKind, { sub: string; effects: string[] }> = {
  soul: { sub: '已經滿級了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已滿級', '目前的等級、持有靈魂碎片與攻略紀錄會被取代'] },
  genesis: { sub: '已經解放了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已解放', '命運武器與阿斯特拉輔助武器隨即解鎖，可以開始設定'] },
  destiny: { sub: '已經完成二次解放了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已完成二次解放', '目前的階段與持有的敵對者的決心會被取代'] },
  astra: { sub: '已經取得阿斯特拉輔助武器了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已取得', '目前的階段與兩種素材的持有量會被取代'] },
};

/** 調整進度時,分隔線下方的紅色提示:儲存後填的值會取代目前進度 */
const OVERWRITE_TEXT: Record<WeaponKind, string> = {
  soul: '儲存後，目前進度會被這裡填的等級與靈魂碎片取代',
  genesis: '儲存後，目前進度會被這裡填的階段與黑暗痕跡取代',
  destiny: '儲存後，目前進度會被這裡填的階段與敵對者的決心取代',
  astra: '儲存後，目前進度會被這裡填的階段、激戰的痕跡與艾里溫碎片取代',
};

/** 第二步說明中的素材名稱:short 指 BOSS 給的,held 指目前持有的 */
const PICK_MATERIAL: Record<Exclude<WeaponKind, 'soul'>, { short: string; held: string }> = {
  genesis: { short: '痕跡', held: '黑暗痕跡' },
  destiny: { short: '決心', held: '敵對者的決心' },
  astra: { short: '痕跡與碎片', held: '激戰的痕跡與艾里溫碎片' },
};

/** 儲存表單時交給呼叫端的內容 */
export interface SetupResult {
  payload: AdjustPayload;
  /** 創世的痕跡加成(角色層級設定) */
  profile?: { genesisPass: boolean; stormTraining: boolean };
}

/**
 * 初始設定與調整進度(共用同一個表單):最上方是「標記為已完成」入口,點下去在同一個視窗內切到確認畫面;
 * 已完成的武器改成說明目前狀態,填寫進度並儲存即改回進行中
 * @param kind 武器
 * @param progress useWeaponProgress 的結果
 * @param character 角色(暴風修練只對挑戰者伺服器顯示)
 * @param open 是否開啟
 * @param onOpenChange 開關變動時呼叫
 * @param onSave 儲存進度時呼叫
 * @param onComplete 確認標記完成時呼叫
 */
export function WeaponSetupDialog({
  kind,
  progress,
  character,
  open,
  onOpenChange,
  onSave,
  onComplete,
}: {
  kind: WeaponKind;
  progress: WeaponProgress;
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: SetupResult) => void;
  onComplete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-5 sm:max-w-md">
        {open && (
          <SetupBody kind={kind} progress={progress} character={character} onCancel={() => onOpenChange(false)} onSave={onSave} onComplete={onComplete} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 數字輸入轉成非負整數;空白或格式錯誤為 NaN */
function parseAmount(text: string): number {
  const cleaned = text.trim();
  if (!/^\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/**
 * 持有量欄位的錯誤文字
 * @param text 輸入的文字
 * @returns 錯誤說明;格式正確時為 undefined
 */
function amountError(text: string): string | undefined {
  if (text.trim() === '') return '請輸入持有量，沒有就填 0';
  return Number.isNaN(parseAmount(text)) ? '只能輸入數字' : undefined;
}

function SetupBody({
  kind,
  progress,
  character,
  onCancel,
  onSave,
  onComplete,
}: {
  kind: WeaponKind;
  progress: WeaponProgress;
  character: Character;
  onCancel: () => void;
  onSave: (result: SetupResult) => void;
  onComplete: () => void;
}) {
  const { state, profile } = progress;
  const status = state[kind].status;
  const isDone = status === 'done';
  const isAdjust = status !== 'unset';
  const name = WEAPON_META[kind].name;
  const [view, setView] = useState<'form' | 'confirm' | 'quest' | 'pick' | 'auto'>('form');
  // 最後一步:本週已勾選的 BOSS,使用者選擇填的值還沒包含、要再加上的(靈魂只有本週給最多的那一隻)
  const pending = progress.thisWeek.weapons[kind].cycleRows;
  const hasPick = pending.length > 0;
  const [picked, setPicked] = useState<string[]>([]);

  // 預填目前的狀態;已完成的武器預填最後一階、持有 0
  const [stage, setStage] = useState(() =>
    kind === 'genesis' ? (isDone ? 8 : state.genesis.stage) : kind === 'destiny' ? (isDone ? 6 : state.destiny.stage) : isDone ? 3 : state.astra.stage,
  );
  const [pool, setPool] = useState(() =>
    String(isDone ? 0 : toDisplay(kind === 'genesis' ? state.genesis.pool : kind === 'destiny' ? state.destiny.pool : kind === 'soul' ? state.soul.pool : state.astra.trace)),
  );
  const [shard, setShard] = useState(() => String(isDone ? 0 : toDisplay(state.astra.shard)));
  const [level, setLevel] = useState(() => String(isDone ? 100 : state.soul.level));
  const [gatePassed, setGatePassed] = useState(state.soul.gatePassed);
  const [solo, setSolo] = useState<string[]>(state.soul.soloCleared);
  const [autoLevel, setAutoLevel] = useState(state.soul.autoLevel !== false);
  const [genesisPass, setGenesisPass] = useState(profile.genesisPass);
  const [stormTraining, setStormTraining] = useState(profile.stormTraining);
  const challenger = character.server === STORM_TRAINING_SERVER;
  // 離開過的欄位才顯示錯誤,打字途中不會一直跳錯
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (id: string) => setTouched((prev) => (prev[id] ? prev : { ...prev, [id]: true }));

  const poolNum = parseAmount(pool);
  const shardNum = parseAmount(shard);
  const levelNum = Number(level);
  const levelValid = Number.isInteger(levelNum) && levelNum >= 1 && levelNum <= 100;
  const atGate = kind === 'soul' && levelValid && levelNum % 10 === 0 && levelNum < 100;
  const soulStage = levelValid ? soulStageOf(levelNum, atGate && gatePassed) : 1;
  const valid = !Number.isNaN(poolNum) && (kind !== 'astra' || !Number.isNaN(shardNum)) && (kind !== 'soul' || levelValid);
  // 靈魂儲存後的結果(含選擇加入的本週週王與自動升級),和 fold 用同一個函式算
  const soulPayload: Extract<AdjustPayload, { weapon: 'soul' }> = {
    weapon: 'soul',
    level: levelNum,
    gatePassed: atGate && gatePassed,
    pool: poolNum,
    soloCleared: solo,
    autoLevel,
  };
  const soulAdded = kind === 'soul' && hasPick && picked.includes(pending[0].clear.id) ? pending[0].amount : 0;
  const soulAfter = kind === 'soul' && valid ? soulAfterAdjust(state.soul, soulPayload, soulAdded) : undefined;
  const autoLevels = !!soulAfter && autoLevel && soulAfter.level > levelNum;
  // 第一步之後的步驟,按「下一步」時依當下填的值決定(輸入途中視窗內容不會變動):
  // 靈魂停在升階關卡(Lv.10、20…90)時問升階任務;本週有已勾選的 BOSS 時問要不要加在填的值上;
  // 儲存後會自動升級時,最後先確認要升到幾級
  const steps: ('quest' | 'pick' | 'auto')[] = [
    ...(atGate ? (['quest'] as const) : []),
    ...(hasPick ? (['pick'] as const) : []),
    ...(autoLevels ? (['auto'] as const) : []),
  ];
  const nextOf = (v: 'form' | 'quest' | 'pick' | 'auto') => steps[v === 'form' ? 0 : steps.indexOf(v) + 1];
  const backOf = (v: 'quest' | 'pick' | 'auto') => () => setView(steps[steps.indexOf(v) - 1] ?? 'form');

  if (view === 'confirm') {
    return (
      <>
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="text-base font-semibold">確認標記為已完成</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5 rounded-[9.6px] bg-surface-raised px-3 py-2.5 text-sm">
          {COMPLETE_TEXT[kind].effects.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-secondary-foreground" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => setView('form')}>
            返回
          </Button>
          <Button type="button" size="sm" onClick={onComplete}>
            確認標記完成
          </Button>
        </DialogFooter>
      </>
    );
  }

  const save = () => {
    if (!valid) return;
    // 只帶目前還在待選清單裡的(第二步開著時清單可能因取消勾選而變動)
    const includeClearIds = hasPick ? picked.filter((id) => pending.some((r) => r.clear.id === id)) : [];
    if (kind === 'genesis') onSave({ payload: { weapon: 'genesis', stage, pool: poolNum, includeClearIds }, profile: { genesisPass, stormTraining: challenger && stormTraining } });
    else if (kind === 'destiny') onSave({ payload: { weapon: 'destiny', stage, pool: poolNum, includeClearIds } });
    else if (kind === 'astra') onSave({ payload: { weapon: 'astra', stage, trace: poolNum, shard: shardNum, includeClearIds } });
    else onSave({ payload: { ...soulPayload, includeClearIds } });
  };
  const saveLabel = isDone ? '改回進行中' : '儲存進度';
  // 步驟的主要按鈕:後面還有步驟就到下一步,沒有就儲存
  const primaryButton = (from: 'form' | 'quest' | 'pick' | 'auto') => {
    const next = nextOf(from);
    return next ? (
      <Button type="button" size="sm" disabled={!valid} onClick={() => setView(next)}>
        下一步
        <ChevronRight aria-hidden="true" />
      </Button>
    ) : (
      <Button type="button" size="sm" disabled={!valid} onClick={save}>
        {saveLabel}
      </Button>
    );
  };

  if (view === 'quest' && atGate) {
    const options = SOUL_QUESTS[soulStageOf(levelNum, false)] ?? [];
    const optionKeys = options.map((o) => soloKey(o.bossCatalogId, o.difficulty));
    return (
      <SoulQuestStep
        level={levelNum}
        options={options}
        gatePassed={gatePassed}
        onGatePassedChange={setGatePassed}
        selected={solo.filter((k) => optionKeys.includes(k))}
        onToggle={(key) => setSolo((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))}
        onBack={backOf('quest')}
        primary={primaryButton('quest')}
      />
    );
  }

  if (view === 'pick' && kind === 'soul' && hasPick && soulAfter) {
    const row = pending[0];
    return (
      <SoulPickStep
        row={row}
        add={picked.includes(row.clear.id)}
        onAddChange={(add) => setPicked(add ? [row.clear.id] : [])}
        base={poolNum}
        level={levelNum}
        after={soulAfter}
        onBack={backOf('pick')}
        primary={primaryButton('pick')}
      />
    );
  }

  if (view === 'auto' && soulAfter && autoLevels) {
    return (
      <SoulAutoLevelStep
        level={levelNum}
        after={soulAfter}
        onBack={backOf('auto')}
        primary={primaryButton('auto')}
      />
    );
  }

  if (view === 'pick' && kind !== 'soul') {
    // 創世的量依這次表單上的通行證 / 暴風修練換算,和儲存後的結果一致
    const amountOf = (r: ThisWeekRow) =>
      kind === 'genesis' ? clearAmounts({ ...r.clear, genesisPass, stormTraining: challenger && stormTraining }).genesis : r.amount;
    return (
      <PickStep
        kind={kind}
        rows={pending}
        amountOf={amountOf}
        picked={picked}
        onPickedChange={setPicked}
        base={poolNum}
        baseShard={kind === 'astra' ? shardNum : undefined}
        cap={kind === 'genesis' ? GENESIS.cap : kind === 'destiny' ? destinyCap(stage) : ASTRA.traceCap}
        saveLabel={saveLabel}
        onBack={() => setView('form')}
        onSave={save}
      />
    );
  }

  const stageItems = (stages: number[]) =>
    stages.map((s) => (
      <SelectItem key={s} value={String(s)}>
        第 {s} 階
      </SelectItem>
    ));
  // 用專案的 Select 元件(跟著主題配色);原生 select 在深色模式下展開的選單會是白底白字
  const stageSelect = (count: number, grouped = false) => (
    <Field label="目前階段" htmlFor="ws-stage">
      <Select value={String(stage)} onValueChange={(v) => setStage(Number(v))}>
        <SelectTrigger id="ws-stage" className="w-full rounded-[9.6px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {grouped ? (
            <>
              <SelectGroup>
                <SelectLabel>第一階段：升級成命運武器</SelectLabel>
                {stageItems([1, 2, 3])}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>第二階段：二次解放</SelectLabel>
                {stageItems([4, 5, 6])}
              </SelectGroup>
            </>
          ) : (
            stageItems(Array.from({ length: count }, (_, i) => i + 1))
          )}
        </SelectContent>
      </Select>
    </Field>
  );
  const amountInput = (id: string, label: string, value: string, onChange: (v: string) => void, suffix?: string) => {
    const error = touched[id] ? amountError(value) : undefined;
    return (
      <Field label={label} htmlFor={id} error={error}>
        <div className="relative">
          <input
            id={id}
            inputMode="numeric"
            className={cn(INPUT, 'tabular-nums', suffix && 'pr-16')}
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => touch(id)}
          />
          {suffix && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
        </div>
      </Field>
    );
  };

  let fields: ReactNode;
  let preview: ReactNode = null;
  if (kind === 'genesis') {
    const need = genesisNeed(stage);
    const pct = Number.isNaN(poolNum) ? 0 : Math.round(genesisPercent({ status: 'active', stage, pool: Math.min(poolNum, GENESIS.cap) * UNIT }));
    fields = (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          {stageSelect(8)}
          {amountInput('ws-pool', '持有黑暗痕跡', pool, setPool, `/ ${fmt(GENESIS.cap)}`)}
        </div>
      </>
    );
    preview = Number.isNaN(poolNum) ? null : (
      <>
        第 {stage} 階需求 <B>{fmt(need)}</B>，目前持有 <B>{fmt(poolNum)}</B>。
        {poolNum >= need ? '完成 BOSS 任務後即可升階，' : <>還差 <B>{fmt(need - poolNum)}</B>，</>}整體進度 <B>{pct}%</B>。
        {poolNum > GENESIS.cap && <Warn>持有上限是 {fmt(GENESIS.cap)}，超過的部分不會計入。</Warn>}
      </>
    );
  } else if (kind === 'destiny') {
    const need = destinyNeed(stage);
    const cap = destinyCap(stage);
    const pct = Number.isNaN(poolNum) ? 0 : Math.round(destinyPercent({ status: 'active', stage, pool: Math.min(poolNum, cap) * UNIT }));
    const phaseName = destinyPhaseOf(stage) === 1 ? '第一階段' : '第二階段';
    fields = (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          {stageSelect(6, true)}
          {amountInput('ws-pool', '持有敵對者的決心', pool, setPool, `/ ${fmt(cap)}`)}
        </div>
      </>
    );
    preview = Number.isNaN(poolNum) ? null : (
      <>
        第 {stage} 階需求 <B>{fmt(need)}</B>，目前持有 <B>{fmt(poolNum)}</B>，
        {poolNum >= need ? '已足夠，完成決戰任務後即可升階' : <>還差 <B>{fmt(need - poolNum)}</B></>}。{phaseName}進度 <B>{pct}%</B>。
        {poolNum > cap && <Warn>{phaseName}的持有上限是 {fmt(cap)}，超過的部分不會計入。</Warn>}
      </>
    );
  } else if (kind === 'astra') {
    const traceNeed = ASTRA.traceNeeds[stage - 1];
    const shardNeed = ASTRA.shardNeeds[stage - 1];
    const ok = !Number.isNaN(poolNum) && !Number.isNaN(shardNum);
    const pct = ok ? Math.round(astraPercent({ status: 'active', stage, trace: Math.min(poolNum, ASTRA.traceCap) * UNIT, shard: shardNum * UNIT })) : 0;
    const left = (have: number, need: number) => (have >= need ? '已足夠' : <>還差 <B>{fmt(need - have)}</B></>);
    fields = (
      <>
        {stageSelect(3)}
        <div className="grid grid-cols-2 gap-2.5">
          {amountInput('ws-pool', '持有激戰的痕跡', pool, setPool, `/ ${fmt(ASTRA.traceCap)}`)}
          {amountInput('ws-shard', '持有艾里溫碎片', shard, setShard)}
        </div>
      </>
    );
    preview = ok ? (
      <>
        第 {stage} 階需求痕跡 <B>{fmt(traceNeed)}</B>（{left(poolNum, traceNeed)}）、碎片 <B>{fmt(shardNeed)}</B>（{left(shardNum, shardNeed)}）。兩種都湊齊並完成遊戲中的任務後即可升階，整體進度 <B>{pct}%</B>。
        {poolNum > ASTRA.traceCap && <Warn>激戰的痕跡持有上限是 {fmt(ASTRA.traceCap)}，超過的部分不會計入。</Warn>}
      </>
    ) : null;
  } else {
    const levelError = touched['ws-level'] && !levelValid ? '等級需在 1~100 之間' : undefined;
    fields = (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="目前等級" htmlFor="ws-level" error={levelError}>
            <div className="relative">
              <input
                id="ws-level"
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                className={cn(INPUT, 'pr-12 tabular-nums')}
                value={level}
                aria-invalid={!!levelError}
                aria-describedby={levelError ? 'ws-level-error' : undefined}
                onChange={(e) => setLevel(e.target.value)}
                onBlur={() => touch('ws-level')}
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{soulStage} 階</span>
            </div>
          </Field>
          {amountInput('ws-pool', '持有靈魂碎片', pool, setPool)}
        </div>
        <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
          <label htmlFor="ws-auto" className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">碎片足夠時自動升級</span>
            <span id="ws-auto-desc" className="text-xs leading-normal text-muted-foreground">
              打完週王碎片夠了就自動升到下一級。想自己決定灌多少（例如留一些用在其他功能）就關掉，改成手動升級。
            </span>
          </label>
          <Switch id="ws-auto" checked={autoLevel} onCheckedChange={setAutoLevel} aria-describedby="ws-auto-desc" className="mt-0.5" />
        </div>
      </>
    );
    if (soulAfter) {
      const lv = soulAfter.level;
      const held = toDisplay(soulAfter.pool);
      const cost = soulNextCost(lv);
      // 自動升級關閉時,碎片最多能升到的等級
      const reach = soulLevelUp(soulAfter).level;
      preview =
        lv >= 100 ? (
          '已滿級。'
        ) : autoLevels ? (
          <>
            儲存後會自動升到 <B>Lv.{lv}</B>，剩 <B>{fmt(held)}</B> 碎片。
          </>
        ) : !autoLevel && reach > lv ? (
          <>
            照填的值儲存。碎片夠升到 <B>Lv.{reach}</B>，之後可以在武器視窗按「升級」記錄。
          </>
        ) : soulAtGate(soulAfter) ? (
          <>停在 Lv.{lv}，完成升階任務後才能繼續升級。</>
        ) : (
          <>
            升到 Lv.{lv + 1} 需要 <B>{fmt(cost)}</B>，還差 <B>{fmt(cost - held)}</B>。
          </>
        );
    }
  }

  const boostFields = kind === 'genesis' && (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-sm font-medium">痕跡加成</span>
      <label className="flex min-h-8 items-center gap-2 text-sm">
        <Checkbox checked={genesisPass} onCheckedChange={(v) => setGenesisPass(v === true)} />
        套用創世通行證（痕跡 ×3）
      </label>
      {challenger && (
        <>
          <label className="flex min-h-8 items-center gap-2 text-sm">
            <Checkbox checked={stormTraining} onCheckedChange={(v) => setStormTraining(v === true)} />
            套用暴風修練
          </label>
          <span className="-mt-1.5 pl-6 text-xs text-muted-foreground">使用創世通行證時，2 人組隊的 BOSS 不平分痕跡。</span>
        </>
      )}
    </div>
  );

  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">
          {isAdjust ? '調整' : '設定'}
          {name}進度
        </DialogTitle>
        <DialogDescription>{isAdjust ? '修改後會覆蓋目前的紀錄。' : '輸入遊戲中目前的狀態，之後會依清單的勾選自動累積。'}</DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        {isDone ? (
          <div className="flex items-start gap-2 rounded-xl bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))] px-3 py-2.5">
            <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
            <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
              <span className="text-sm font-medium">目前標記為已完成</span>
              <span className="text-xs text-muted-foreground">
                填寫下面的進度並儲存，就會改回進行中。{kind === 'genesis' && '命運與阿斯特拉會重新鎖定，已記錄的進度會保留。'}
              </span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setView('confirm')}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-sm font-medium">標記為已完成</span>
              <span className="text-xs text-muted-foreground">{COMPLETE_TEXT[kind].sub}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        <div className="flex items-center gap-2.5 text-xs whitespace-nowrap text-muted-foreground before:flex-1 before:border-t before:border-border after:flex-1 after:border-t after:border-border">
          {isDone ? '改回進行中' : '或輸入目前進度'}
        </div>
        {isAdjust && (
          <p
            role="note"
            className="flex items-start gap-1.5 rounded-lg border border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_10%,var(--popover))] px-2.5 py-2 text-xs leading-normal text-destructive"
          >
            <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {OVERWRITE_TEXT[kind]}
          </p>
        )}
        <div className="flex flex-col gap-3.5">
          {fields}
          {preview && <div className="rounded-lg bg-surface-raised px-2.5 py-2 text-xs text-muted-foreground">{preview}</div>}
          {boostFields}
        </div>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
        {primaryButton('form')}
      </DialogFooter>
    </>
  );
}

/** 表單輸入框樣式(和專案 Input 一致:手機 16px 避免 iOS 放大) */
const INPUT =
  'h-9 w-full min-w-0 rounded-[9.6px] border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/**
 * 表單欄位:標籤 + 輸入,有錯誤時在輸入框正下方顯示錯誤文字(id 為 `${htmlFor}-error`,給輸入框的 aria-describedby 用)
 * @param label 標籤
 * @param htmlFor 輸入框 id
 * @param error 錯誤文字,沒有時不顯示
 * @param children 輸入框
 */
function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <span id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

/** BOSS 列的頭像、名稱與標籤(難度、VIP、月王) */
function BossLabel({ row }: { row: ThisWeekRow }) {
  const name = bossName(row.clear.bossCatalogId);
  return (
    <>
      <BossAvatar bossCatalogId={row.clear.bossCatalogId} name={name} />
      <span className="leading-[1.2] font-medium whitespace-nowrap">{name}</span>
      <DifficultyTag difficulty={row.clear.difficulty} />
      {row.clear.isVip && <VipTag />}
      {row.monthly && <MonthlyTag />}
    </>
  );
}

/**
 * BOSS 清單外框:最多顯示約 4 隻,超過在清單內捲動;下方還有沒顯示的 BOSS 時在底部顯示向下箭頭,捲到底就隱藏
 * @param label 清單的無障礙名稱
 * @param count 項目數(變動時重新判斷是否顯示箭頭)
 * @param children 清單項目(li)
 */
function ScrollList({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const updateScrollHint = () => {
    const el = listRef.current;
    if (el) setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  };
  useLayoutEffect(updateScrollHint, [count]);
  return (
    // 可捲動所以要能用鍵盤 focus
    <div className="relative">
      <ul
        ref={listRef}
        onScroll={updateScrollHint}
        tabIndex={0}
        aria-label={label}
        className="max-h-39 overflow-y-auto overscroll-contain rounded-lg bg-surface-raised px-2.5 py-1 outline-none [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/50 [&>li+li]:border-t [&>li+li]:border-border/70"
      >
        {children}
      </ul>
      {/* 只是提示,不攔截點擊與捲動;漸層底色與清單相同,蓋住最後一列的下緣 */}
      {canScrollDown && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end justify-center rounded-b-lg bg-linear-to-b from-transparent to-surface-raised pb-0.5"
        >
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * 調整進度第二步:列出本週已勾選、還沒計入持有量的 BOSS,勾選的會再加進持有量(填的值不包含它們)
 * @param kind 武器(靈魂沒有第二步)
 * @param rows 待選的擊破紀錄(本週期所有已勾選的)
 * @param amountOf 單筆的計入量(1/60 單位);創世依表單上的加成換算
 * @param picked 已勾選的擊破紀錄 id
 * @param onPickedChange 勾選變動時呼叫
 * @param base 第一步填的持有量(遊戲內整數)
 * @param baseShard 阿斯特拉第一步填的艾里溫碎片
 * @param cap 持有上限(阿斯特拉為激戰的痕跡)
 * @param saveLabel 儲存按鈕文字
 * @param onBack 回到第一步
 * @param onSave 儲存
 */
function PickStep({
  kind,
  rows,
  amountOf,
  picked,
  onPickedChange,
  base,
  baseShard,
  cap,
  saveLabel,
  onBack,
  onSave,
}: {
  kind: Exclude<WeaponKind, 'soul'>;
  rows: ThisWeekRow[];
  amountOf: (r: ThisWeekRow) => number;
  picked: string[];
  onPickedChange: (ids: string[]) => void;
  base: number;
  baseShard?: number;
  cap: number;
  saveLabel: string;
  onBack: () => void;
  onSave: () => void;
}) {
  const { unit, material } = WEAPON_META[kind];
  const text = PICK_MATERIAL[kind];
  const chosen = rows.filter((r) => picked.includes(r.clear.id));
  const allPicked = chosen.length === rows.length;
  const add = chosen.reduce((s, r) => s + amountOf(r), 0);
  const addShard = chosen.reduce((s, r) => s + (r.shard ?? 0), 0);
  const total = base * UNIT + add;
  const toggle = (id: string) => onPickedChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const line = 'flex justify-between gap-3 text-xs text-muted-foreground tabular-nums';
  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">本週已打的 BOSS</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-1">
            <p>下方是本週在 BOSS 列表已勾選（已攻略）的 BOSS。</p>
            {/* 圖例:用和清單相同的勾選框外觀帶出「不勾選 / 勾選」,關鍵字維持次要文字色,不跟標題搶層級 */}
            <div className="flex flex-col gap-1 text-xs leading-normal">
              <p className="flex items-start gap-1.5">
                <span aria-hidden="true" className="mt-[2px] size-3.5 shrink-0 rounded-[4px] border border-muted-foreground/60" />
                <span className="shrink-0 font-medium">不勾選</span>
                <ArrowRight aria-label="則" className="mt-[2px] size-3.5 shrink-0 opacity-70" />
                <span>不將這些 BOSS 的{text.short}加入目前持有的{text.held}</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span aria-hidden="true" className="mt-[2px] grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-primary text-primary-foreground">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
                <span className="shrink-0 font-medium">勾選</span>
                <ArrowRight aria-label="則" className="mt-[2px] size-3.5 shrink-0 opacity-70" />
                <span>會再將這些 BOSS 的{text.short}加入目前持有的{text.held}</span>
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">本週已勾選 {rows.length} 隻</span>
          <button
            type="button"
            onClick={() => onPickedChange(allPicked ? [] : rows.map((r) => r.clear.id))}
            className={cn('rounded-md px-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50', COARSE_HIT)}
          >
            {allPicked ? '全部取消' : '全部勾選'}
          </button>
        </div>
        <ScrollList label="本週已勾選的 BOSS" count={rows.length}>
          {rows.map((r) => {
            const on = picked.includes(r.clear.id);
            return (
              <li key={r.clear.id}>
                <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
                  {/* 清單底色(surface-raised)和預設邊框色太接近,未勾選時加深邊框才看得到 */}
                  <Checkbox checked={on} onCheckedChange={() => toggle(r.clear.id)} className="border-muted-foreground/60" />
                  <BossLabel row={r} />
                  <span
                    className={cn(
                      'ml-auto flex flex-col items-end text-xs leading-tight whitespace-nowrap tabular-nums',
                      on ? 'font-semibold text-secondary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {amountOf(r) > 0 && (
                      <span>
                        +{fmtUnits(amountOf(r))} {unit}
                      </span>
                    )}
                    {(r.shard ?? 0) > 0 && <span>+{fmtUnits(r.shard!)} 碎片</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ScrollList>
        <div aria-live="polite" className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
          <div className={line}>
            <span>上一步輸入的{material}</span>
            <span>{fmt(base)}</span>
          </div>
          <div className={line}>
            <span>加上勾選的</span>
            <span>+{fmtUnits(add)}</span>
          </div>
          <div className="mt-0.5 flex justify-between gap-3 border-t border-dashed border-border pt-1.5 text-sm font-semibold tabular-nums">
            <span>儲存後持有</span>
            <span>
              {fmtUnits(Math.min(total, cap * UNIT))}
              {total > cap * UNIT && <span className="ml-1 text-xs font-normal text-muted-foreground">（已達上限）</span>}
            </span>
          </div>
          {baseShard !== undefined && (
            <div className="flex justify-between gap-3 text-sm font-semibold tabular-nums">
              <span>儲存後艾里溫碎片</span>
              <span>{fmtUnits(baseShard * UNIT + addShard)}</span>
            </div>
          )}
        </div>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          上一步
        </Button>
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * 二選一的單選卡片:整張卡片都能點,選中時框線與底色改用主色(和新增角色的帳號選擇一致)
 * @param label 群組的無障礙名稱
 * @param value 目前選中的值
 * @param onChange 選擇改變時呼叫
 * @param options 選項:值、標題與說明
 */
function ChoiceCards({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; title: string; desc: ReactNode }[];
}) {
  const idPrefix = useId();
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={onChange} className="flex flex-col gap-2">
      {options.map((o) => {
        const id = `${idPrefix}-${o.value}`;
        return (
          // label 對應按鈕 id,讓整張卡片都能點選
          <label
            key={o.value}
            htmlFor={id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem id={id} value={o.value} className="mt-0.5" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{o.title}</span>
              <span className="text-xs leading-normal text-muted-foreground">{o.desc}</span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

/**
 * 靈魂調整進度的升階任務步驟:只在等級停在 Lv.10、20…90 時出現。
 * 選「已經升階」時 BOSS 選擇區保留位置、變淡停用,切換選項時視窗高度不變
 * @param level 填的等級
 * @param options 這次升階任務可單人擊破的 BOSS
 * @param gatePassed 是否已經升階
 * @param onGatePassedChange 切換升階狀態時呼叫
 * @param selected 已單人擊破過的 key(`${bossCatalogId}|${difficulty}`)
 * @param onToggle 點擊某一隻 BOSS 時呼叫
 * @param onBack 回到上一步
 * @param primary 主要按鈕(下一步或儲存)
 */
function SoulQuestStep({
  level,
  options,
  gatePassed,
  onGatePassedChange,
  selected,
  onToggle,
  onBack,
  primary,
}: {
  level: number;
  options: { bossCatalogId: string; difficulty: BossDifficulty }[];
  gatePassed: boolean;
  onGatePassedChange: (passed: boolean) => void;
  selected: string[];
  onToggle: (key: string) => void;
  onBack: () => void;
  primary: ReactNode;
}) {
  const nextStage = level / 10 + 1;
  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">Lv.{level} 的升階任務</DialogTitle>
        <DialogDescription>
          Lv.{level} 要先完成升階任務才能升到 {nextStage} 階。目前的狀況是？
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        <ChoiceCards
          label={`Lv.${level} 升階任務狀態`}
          value={gatePassed ? 'passed' : 'pending'}
          onChange={(v) => onGatePassedChange(v === 'passed')}
          options={[
            { value: 'passed', title: `已經升到 ${nextStage} 階`, desc: `任務完成並升階了，之後從 Lv.${level + 1} 開始累積` },
            { value: 'pending', title: '還沒升階', desc: '單人擊破過下面任一隻，就能直接升階' },
          ]}
        />
        <fieldset disabled={gatePassed} className={cn('flex flex-col gap-2 rounded-lg bg-surface-raised px-3 py-2.5 transition-opacity', gatePassed && 'opacity-50')}>
          <legend className="sr-only">單人擊破過的 BOSS</legend>
          <span className="text-xs text-muted-foreground">
            {gatePassed ? '已經升階，不需要選擇' : '單人擊破過哪幾隻？（之後清單中 1 人攻略的會自動記錄）'}
          </span>
          <BossTilePicker options={options} selected={selected} onToggle={onToggle} />
        </fieldset>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          上一步
        </Button>
        {primary}
      </DialogFooter>
    </>
  );
}

/**
 * 靈魂調整進度的本週週王步驟:靈魂碎片一週只算給最多的那一隻,讓使用者選擇調整視窗填的數量有沒有包含它
 * @param row 本週給最多的擊破紀錄
 * @param add 是否要加在填的數量上(還沒包含)
 * @param onAddChange 切換選項時呼叫
 * @param base 調整視窗填的靈魂碎片(遊戲內整數)
 * @param level 調整視窗填的等級
 * @param after 儲存後的靈魂狀態(含自動升級)
 * @param onBack 回到上一步
 * @param primary 主要按鈕(下一步或儲存)
 */
function SoulPickStep({
  row,
  add,
  onAddChange,
  base,
  level,
  after,
  onBack,
  primary,
}: {
  row: ThisWeekRow;
  add: boolean;
  onAddChange: (add: boolean) => void;
  base: number;
  level: number;
  after: SoulState;
  onBack: () => void;
  primary: ReactNode;
}) {
  const amount = fmtUnits(row.amount);
  const added = add ? row.amount : 0;
  const leveled = after.level > level;
  const line = 'flex justify-between gap-3 text-xs text-muted-foreground tabular-nums';
  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">本週打過的週王</DialogTitle>
        <DialogDescription>靈魂碎片每週只算給最多的那一隻。調整視窗填的數量，有沒有包含這一隻的碎片？</DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        <div className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2 text-sm">
          <BossLabel row={row} />
          <span className="ml-auto text-xs font-semibold whitespace-nowrap text-secondary-foreground tabular-nums">+{amount} 碎片</span>
        </div>
        <ChoiceCards
          label="調整視窗填的數量是否已包含本週週王"
          value={add ? 'add' : 'included'}
          onChange={(v) => onAddChange(v === 'add')}
          options={[
            { value: 'included', title: '已經包含', desc: '調整視窗填的數量已經算進這週的碎片，不再加入' },
            { value: 'add', title: '還沒包含', desc: `儲存後再加上${bossName(row.clear.bossCatalogId)}的 +${amount} 碎片` },
          ]}
        />
        <div aria-live="polite" className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
          <div className={line}>
            <span>調整視窗輸入的靈魂碎片</span>
            <span>{fmt(base)}</span>
          </div>
          <div className={line}>
            <span>加上本週週王</span>
            <span>+{fmtUnits(added)}</span>
          </div>
          {/* 不論有沒有升級都佔一行,切換選項時視窗高度不變 */}
          <div className={line}>
            <span>{leveled ? `自動升到 Lv.${after.level}` : '升級'}</span>
            <span>{leveled ? `−${fmt(soulCostBetween(level, after.level))}` : '不升級'}</span>
          </div>
          <div className="mt-0.5 flex justify-between gap-3 border-t border-dashed border-border pt-1.5 text-sm font-semibold tabular-nums">
            <span>儲存後持有</span>
            <span>{fmtUnits(after.pool)}</span>
          </div>
        </div>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          上一步
        </Button>
        {primary}
      </DialogFooter>
    </>
  );
}

/**
 * 靈魂調整進度的最後一步:自動升級開啟且儲存後會升級時,列出會升到幾級、每級花掉的碎片,確認後才儲存
 * @param level 調整視窗填的等級
 * @param after 儲存後的靈魂狀態
 * @param onBack 回到上一步
 * @param primary 主要按鈕(儲存)
 */
function SoulAutoLevelStep({ level, after, onBack, primary }: { level: number; after: SoulState; onBack: () => void; primary: ReactNode }) {
  const spent = soulCostBetween(level, after.level);
  const levels = Array.from({ length: after.level - level }, (_, i) => level + 1 + i);
  const line = 'flex justify-between gap-3 text-xs text-muted-foreground tabular-nums';
  return (
    <>
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle className="text-base font-semibold">確認自動升級</DialogTitle>
        <DialogDescription>
          自動升級已開啟，儲存後會用持有的碎片從 Lv.{level} 升到 Lv.{after.level}。遊戲裡還沒灌這些碎片的話，可以回到調整視窗關閉自動升級。
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-0.5 [scrollbar-width:thin]">
        <ul className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
          <li className={line}>
            <span>升級前持有</span>
            <span>{fmtUnits(after.pool + spent * UNIT)}</span>
          </li>
          {levels.map((lv) => (
            <li key={lv} className={line}>
              <span>
                Lv.{lv - 1} → {lv}
              </span>
              <span>−{fmt(SOUL_LEVEL_COSTS[lv])}</span>
            </li>
          ))}
          <li className="mt-0.5 flex justify-between gap-3 border-t border-dashed border-border pt-1.5 text-sm font-semibold tabular-nums">
            <span>升到 Lv.{after.level} 後持有</span>
            <span>{fmtUnits(after.pool)}</span>
          </li>
        </ul>
      </div>
      <DialogFooter className="flex-row justify-between border-t border-border pt-3 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          上一步
        </Button>
        {primary}
      </DialogFooter>
    </>
  );
}

/** 預覽中的數字 */
function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-foreground tabular-nums">{children}</b>;
}

/** 預覽中的警告 */
function Warn({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-destructive">{children}</span>;
}
