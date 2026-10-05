import { useState, type ReactNode } from 'react';
import { BadgeCheck, Check, ChevronRight, Info } from 'lucide-react';
import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ASTRA, GENESIS, SOUL_QUESTS } from '@/data/weaponRates.data';
import type { WeaponProgress } from '@/hooks/useWeaponProgress';
import { toDisplay } from '@/lib/weapon/rates';
import {
  astraPercent,
  destinyCap,
  destinyNeed,
  destinyPercent,
  destinyPhaseOf,
  genesisNeed,
  genesisPercent,
  soulStageOf,
} from '@/lib/weapon/rules';
import { STORM_TRAINING_SERVER } from '@/lib/weapon/syncClears';
import type { ThisWeekRow } from '@/lib/weapon/thisWeek';
import { soloKey, UNIT, type AdjustPayload, type WeaponKind } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { BossTilePicker } from './BossTilePicker';
import { DifficultyTag } from './parts';
import { bossName, fmt, fmtUnits, WEAPON_META } from './weaponUi';

/** 「標記為已完成」入口的說明與確認畫面列出的影響 */
const COMPLETE_TEXT: Record<WeaponKind, { sub: string; effects: string[] }> = {
  soul: { sub: '已經滿級了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已滿級', '目前的等級、持有靈魂碎片與攻略紀錄會被取代'] },
  genesis: { sub: '已經解放了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已解放', '命運武器與阿斯特拉輔助武器隨即解鎖，可以開始設定'] },
  destiny: { sub: '已經完成二次解放了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已完成二次解放', '目前的階段與持有的敵對者的決心會被取代'] },
  astra: { sub: '已經取得阿斯特拉輔助武器了，就不用填下面的進度', effects: ['入口顯示 100%，視窗內標示為已取得', '目前的階段與兩種素材的持有量會被取代'] },
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
  const [view, setView] = useState<'form' | 'confirm'>('form');

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
  const atGate = levelValid && levelNum % 10 === 0 && levelNum < 100;
  const soulStage = levelValid ? soulStageOf(levelNum, atGate && gatePassed) : 1;
  const valid = !Number.isNaN(poolNum) && (kind !== 'astra' || !Number.isNaN(shardNum)) && (kind !== 'soul' || levelValid);

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
    if (kind === 'genesis') onSave({ payload: { weapon: 'genesis', stage, pool: poolNum }, profile: { genesisPass, stormTraining: challenger && stormTraining } });
    else if (kind === 'destiny') onSave({ payload: { weapon: 'destiny', stage, pool: poolNum } });
    else if (kind === 'astra') onSave({ payload: { weapon: 'astra', stage, trace: poolNum, shard: shardNum } });
    else onSave({ payload: { weapon: 'soul', level: levelNum, gatePassed: atGate && gatePassed, pool: poolNum, soloCleared: solo } });
  };

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

  // 本週已勾選、會計入這把武器的 BOSS:放在持有量欄位下方,提醒填遊戲當下的數量,這些不會再加一次
  const checkedRows = progress.thisWeek.weapons[kind].rows;
  const checkedNote = checkedRows.length > 0 && <CheckedBossNote kind={kind} rows={checkedRows} />;

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
        {checkedNote}
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
        {checkedNote}
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
        {checkedNote}
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
    const options = SOUL_QUESTS[soulStage];
    const optionKeys = options?.map((o) => soloKey(o.bossCatalogId, o.difficulty)) ?? [];
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
        {checkedNote}
        {atGate && (
          <label className="flex min-h-8 items-center gap-2 text-sm">
            <Checkbox checked={gatePassed} onCheckedChange={(v) => setGatePassed(v === true)} />
            已完成 {levelNum / 10 + 1} 階的升階任務（目前是 {levelNum / 10 + 1} 階）
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{options ? `Lv.${soulStage * 10} 升 ${soulStage + 1} 階的任務，單人擊破過哪幾隻？` : '升階任務'}</span>
          {options ? (
            <>
              <span className="text-xs text-muted-foreground">只需要下一次升階的任務，單人擊破過的會在升階時自動帶入。之後的任務會從清單勾選自動記錄（組隊人數 1 人才算）。</span>
              <BossTilePicker
                options={options}
                selected={solo.filter((k) => optionKeys.includes(k))}
                onToggle={(key) => setSolo((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))}
              />
            </>
          ) : (
            <div className="rounded-[9.6px] border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">已經是最高階，沒有需要記錄的升階任務。</div>
          )}
        </div>
      </>
    );
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
        <Button type="button" size="sm" disabled={!valid} onClick={save}>
          {isDone ? '改回進行中' : '儲存進度'}
        </Button>
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

/**
 * 持有量欄位下方的提醒:填遊戲當下的進度,並完整列出本週已勾選、不會再加一次的 BOSS
 * @param kind 武器(決定單位;阿斯特拉另外列出碎片)
 * @param rows 本週已勾選、會計入這把武器的擊破紀錄
 */
function CheckedBossNote({ kind, rows }: { kind: WeaponKind; rows: ThisWeekRow[] }) {
  const unit = WEAPON_META[kind].unit;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-start gap-1.5 text-xs leading-normal text-muted-foreground">
        <Info aria-hidden="true" className="mt-[3px] size-3 shrink-0" />
        請填入遊戲中當前的進度，BOSS 列表中已勾選的 BOSS 不會再加一次。
      </p>
      <ul aria-label="已勾選、不會再加一次的 BOSS" className="rounded-lg bg-surface-raised px-2.5 py-1 [&>li+li]:border-t [&>li+li]:border-border/70">
        {rows.map((r) => {
          const name = bossName(r.clear.bossCatalogId);
          return (
            <li key={r.clear.id} className="flex items-center gap-2 py-1.5 text-sm">
              <BossAvatar bossCatalogId={r.clear.bossCatalogId} name={name} />
              <span className="leading-[1.2] font-medium whitespace-nowrap">{name}</span>
              <DifficultyTag difficulty={r.clear.difficulty} />
              <span className="ml-auto flex flex-col items-end text-xs leading-tight whitespace-nowrap text-muted-foreground tabular-nums">
                {r.amount > 0 && (
                  <span>
                    +{fmtUnits(r.amount)} {unit}
                  </span>
                )}
                {(r.shard ?? 0) > 0 && <span>+{fmtUnits(r.shard!)} 碎片</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
