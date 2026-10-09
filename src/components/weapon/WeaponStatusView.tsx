import { BadgeCheck, Check, ChevronRight, Circle, Lock, Pencil, Sword } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ASTRA, DESTINY } from '@/data/weaponRates.data';
import type { WeaponViewStatus } from '@/hooks/useWeaponProgress';
import type { WeaponKind } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import { WEAPON_META } from './weaponUi';

/** 已完成時的標題與說明 */
const DONE_TEXT: Record<WeaponKind, { label: string; note: string }> = {
  soul: { label: '已滿級', note: '靈魂武器已達 Lv.100。如果標錯了，可以按下方的「調整進度」改回進行中。' },
  genesis: { label: '已解放', note: '命運武器與阿斯特拉輔助武器已解鎖。如果標錯了，可以按下方的「調整進度」改回進行中。' },
  destiny: { label: '已完成二次解放', note: '如果標錯了，可以按下方的「調整進度」改回進行中。' },
  astra: { label: '已取得', note: '如果標錯了，可以按下方的「調整進度」改回進行中。' },
};

/**
 * 不是進行中的武器內容:未解鎖、未設定、已完成、命運第一階段完成
 * @param kind 武器
 * @param status 畫面上的狀態
 * @param onSetup 未設定時按「設定初始進度」、其他狀態按「調整進度」時呼叫
 * @param onStartPhase2 命運第一階段完成時按「開始第二階段」呼叫
 * @param unlock 未解鎖時列出的解鎖條件:創世是否完成、角色目前等級
 * @param onGoGenesis 未解鎖且創世還沒完成時,按「前往創世武器」呼叫
 */
export function WeaponStatusView({
  kind,
  status,
  onSetup,
  onStartPhase2,
  unlock,
  onGoGenesis,
}: {
  kind: WeaponKind;
  status: Exclude<WeaponViewStatus, 'active'>;
  onSetup: () => void;
  onStartPhase2: () => void;
  unlock: { genesisDone: boolean; level: number };
  onGoGenesis: () => void;
}) {
  const name = WEAPON_META[kind].name;
  const minLevel = kind === 'destiny' ? DESTINY.minLevel : ASTRA.minLevel;
  const icon = (Icon: typeof Lock, done = false) => (
    <span
      className={cn(
        'grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground',
        done && 'bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))] text-secondary-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
  const adjustButton = (variant: 'outline' | 'ghost') => (
    <Button type="button" variant={variant} size="sm" onClick={onSetup} className={cn(variant === 'ghost' && 'text-muted-foreground')}>
      <Pencil aria-hidden="true" />
      調整進度
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-3 py-7 text-center">
      {status === 'locked' && (
        <>
          {icon(Lock)}
          <b className="font-semibold">{name}尚未解鎖</b>
          <p className="max-w-[30ch] text-sm text-muted-foreground">請先滿足以下兩個條件</p>
          <ul className="flex flex-col gap-1.5 text-left text-sm">
            {[
              { ok: unlock.genesisDone, text: '完成創世武器的解放' },
              { ok: unlock.level >= minLevel, text: `角色達到 Lv.${minLevel}（目前 Lv.${unlock.level}）` },
            ].map(({ ok, text }) => (
              <li key={text} className={cn('flex items-center gap-2', ok ? 'text-secondary-foreground' : 'text-muted-foreground')}>
                {ok ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : <Circle aria-hidden="true" className="size-4" />}
                <span>{text}</span>
                <span className="sr-only">{ok ? '已達成' : '尚未達成'}</span>
              </li>
            ))}
          </ul>
          {!unlock.genesisDone && (
            <Button type="button" variant="outline" size="sm" onClick={onGoGenesis}>
              前往創世武器
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </>
      )}
      {status === 'unset' && (
        <>
          {icon(Sword)}
          <b className="font-semibold">還沒設定{name}的進度</b>
          <p className="max-w-[30ch] text-sm text-muted-foreground">先輸入目前的階段和持有量，之後就會依清單的勾選自動累積。</p>
          <Button type="button" size="sm" onClick={onSetup}>
            設定初始進度
          </Button>
        </>
      )}
      {status === 'done' && (
        <>
          {icon(BadgeCheck, true)}
          <b className="font-semibold">
            {name}
            {DONE_TEXT[kind].label}
          </b>
          <p className="max-w-[30ch] text-sm text-muted-foreground">{DONE_TEXT[kind].note}</p>
          {adjustButton('outline')}
        </>
      )}
      {status === 'phase1done' && (
        <>
          {icon(BadgeCheck, true)}
          <b className="font-semibold">已升級成命運武器</b>
          <p className="max-w-[25em] text-sm leading-relaxed text-pretty text-muted-foreground">
            第一階段的 3 個決戰任務都完成了。
            <br />
            接下來是第二階段：二次解放。
            <br />
            決心從&nbsp;0&nbsp;開始累積，上限提高到&nbsp;15,000。
          </p>
          <Button type="button" size="sm" onClick={onStartPhase2}>
            開始第二階段
            <ChevronRight aria-hidden="true" />
          </Button>
          {adjustButton('ghost')}
        </>
      )}
    </div>
  );
}
