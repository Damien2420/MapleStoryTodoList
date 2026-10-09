import { useState } from 'react';
import { ChevronRight, CircleAlert, Info } from 'lucide-react';
import { BossAvatar } from '@/components/BossAvatar';
import { Button } from '@/components/ui/button';
import type { WeaponThisWeek } from '@/lib/weapon/thisWeek';
import type { WeaponKind } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import { COARSE_HIT, DifficultyTag, InfoTip, MonthlyTag, Note, UnitText, VipTag } from './parts';
import { bossName, fmtUnits, WEAPON_META } from './weaponUi';

/** 各武器「本週已取得」的說明文字 */
const NOTES: Record<WeaponKind, string> = {
  soul: '只取本週打過的週王中給最多的那一隻的靈魂碎片數量。已包含在持有量裡，取消勾選會自動扣回。',
  genesis: '勾選當下就會將該BOSS能獲得的黑暗的痕跡加入，取消勾選會自動扣回。依照列表中設定的攻略人數平分。',
  destiny: '勾選當下就會將該BOSS能獲得的敵對者的決心加入，取消勾選會自動扣回。依照列表中設定的攻略人數平分。',
  astra: '勾選當下就已加進持有量，取消勾選會自動扣回。激戰的痕跡組隊時依照列表中設定的攻略人數平分；艾里溫碎片不平分，每日任務每天只算完成的最高地區。',
};

/** 手機不在卡片內捲動:超過這個筆數先收合,點「顯示其餘」才展開 */
const MOBILE_VISIBLE_ROWS = 4;

/** 各武器的持有上限文字(超過上限提示用) */
const CAP_TEXT: Partial<Record<WeaponKind, string>> = { genesis: '3,000', astra: '1,000' };

/**
 * 本週已取得卡片:只列已打的 BOSS,固定高度,清單超過時在卡片內捲動;
 * 沒有已打 BOSS 時分兩種:本週還沒打(顯示還能取得多少)、清單沒有追蹤來源 BOSS(引導前往 BOSS 清單)。
 * 被持有上限截掉的量固定在卡片底部。靈魂只有一隻,用不固定高度的精簡版
 * @param kind 武器
 * @param data 本週資料
 * @param mobile 是否為手機排版(說明直接顯示,不用 info 圖示)
 * @param destinyCap 命運目前階段的上限文字
 * @param atCap 目前持有量是否在上限(預設 true);升階扣掉後不在上限時,被截掉的量改成說明當時沒有計入,不再建議升階
 * @param onGoBossList 點「前往 BOSS 清單」時呼叫
 * @param onRates 點「各 BOSS 取得量」時呼叫
 * @param className 額外的 class(桌面由外層決定高度)
 */
export function ThisWeekCard({
  kind,
  data,
  mobile,
  destinyCap,
  atCap = true,
  onGoBossList,
  onRates,
  className,
}: {
  kind: WeaponKind;
  data: WeaponThisWeek;
  mobile: boolean;
  destinyCap?: string;
  atCap?: boolean;
  onGoBossList: () => void;
  onRates: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const unit = WEAPON_META[kind].unit;
  const compact = kind === 'soul';
  const capText = kind === 'destiny' ? destinyCap : CAP_TEXT[kind];
  const collapse = mobile && !expanded && data.rows.length > MOBILE_VISIBLE_ROWS;
  const shownRows = collapse ? data.rows.slice(0, MOBILE_VISIBLE_ROWS) : data.rows;
  const hiddenCount = data.rows.length - shownRows.length;

  const ratesLink = (
    <button
      type="button"
      onClick={onRates}
      className="relative -mr-1 inline-flex h-6 shrink-0 items-center gap-1 self-end rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']"
    >
      <Info aria-hidden="true" className="size-3.5" />
      各 BOSS 取得量
      <ChevronRight aria-hidden="true" className="size-3.5" />
    </button>
  );

  const title = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold">
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        本週已取得
        {!mobile && <InfoTip text={NOTES[kind]} />}
      </span>
      {!compact && (
        <span className="text-secondary-foreground tabular-nums">
          +{fmtUnits(data.total)}
          <UnitText>{unit}</UnitText>
          {kind === 'astra' && (
            <>
              {' '}+{fmtUnits(data.shardTotal)}
              <UnitText>碎片</UnitText>
            </>
          )}
        </span>
      )}
    </div>
  );

  if (compact) {
    const row = data.rows[0];
    return (
      <div className={cn('flex shrink-0 flex-col gap-1.5 rounded-xl bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))] px-3.5 py-3', className)}>
        {title}
        {mobile && <Note>{NOTES[kind]}</Note>}
        {row ? (
          <ul className="flex flex-col">
            <BossRow kind={kind} row={row} unit={unit} />
          </ul>
        ) : (
          <p className="flex min-h-[34px] items-center text-xs text-muted-foreground">
            本週還沒有計入會給靈魂的週王
          </p>
        )}
        {ratesLink}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-1.5 rounded-xl bg-[color-mix(in_oklch,var(--secondary)_35%,var(--popover))] px-3.5 py-3',
        className,
      )}
    >
      {title}
      {mobile && <Note>{NOTES[kind]}</Note>}
      {data.rows.length > 0 ? (
        <>
          <ul
            // 桌面在卡片內捲動;手機沒有內層捲動,改成收合
            tabIndex={mobile ? undefined : 0}
            aria-label="本週已打的 BOSS"
            className={cn(
              'rounded-md outline-none [&>li+li]:border-t [&>li+li]:border-border/70',
              !mobile &&
                '-mr-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/50',
            )}
          >
            {shownRows.map((row) => (
              <BossRow key={row.clear.id} kind={kind} row={row} unit={unit} />
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="h-8 w-full shrink-0 rounded-md text-xs font-medium pointer-coarse:h-11 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              顯示其餘 {hiddenCount} 隻
            </button>
          )}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-[9px] border border-dashed border-border p-2 text-center">
          {data.untracked ? (
            <>
              <b className="text-sm font-semibold">清單中沒有會計入的 BOSS</b>
              <span className="max-w-[26ch] text-xs text-muted-foreground">
                在 BOSS 清單追蹤相關的 BOSS 後，勾選就會自動計入，也能推算預估時間。
              </span>
              <Button type="button" variant="outline" size="sm" className={cn('mt-1.5', COARSE_HIT)} onClick={onGoBossList}>
                前往 BOSS 清單
              </Button>
            </>
          ) : (
            <>
              {/* 設定前勾的 BOSS 不列出,所以不能說「還沒打」 */}
              <b className="text-sm font-semibold">本週還沒有計入的 BOSS</b>
              <span className="text-xs text-muted-foreground">清單中追蹤的 BOSS 全部打完，本週還能取得</span>
              <span className="text-lg font-bold text-secondary-foreground tabular-nums">
                +{fmtUnits(data.potential)}
                <UnitText>{unit}</UnitText>
              </span>
            </>
          )}
        </div>
      )}
      {data.capLoss > 0 && capText && (
        <div
          role="note"
          className="flex shrink-0 items-start gap-1.5 rounded-lg bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))] px-2 py-1.5 text-xs leading-[1.45] text-muted-foreground"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-destructive" />
          {atCap ? (
            <span>
              超過上限 {capText}，<b className="font-semibold text-destructive tabular-nums">{fmtUnits(data.capLoss)} {unit}</b>
              未計入，建議先升階
            </span>
          ) : (
            // 升階後已不在上限:被截掉的量不會補回,只說明當時沒有計入(上限可能已換成新階段的,不寫數字)
            <span>
              本週打王時已達上限，<b className="font-semibold text-destructive tabular-nums">{fmtUnits(data.capLoss)} {unit}</b>沒有計入
            </span>
          )}
        </div>
      )}
      {ratesLink}
    </div>
  );
}

/** 單一 BOSS 列:頭像、名稱、難度、(VIP)、(月王)、(平分人數)、計入量 */
function BossRow({ kind, row, unit }: { kind: WeaponKind; row: WeaponThisWeek['rows'][number]; unit: string }) {
  const name = bossName(row.clear.bossCatalogId);
  return (
    <li className="flex items-center gap-2 py-[5px] text-sm">
      <BossAvatar bossCatalogId={row.clear.bossCatalogId} name={name} />
      <span className="leading-[1.2] font-medium whitespace-nowrap">{name}</span>
      <DifficultyTag difficulty={row.clear.difficulty} />
      {row.clear.isVip && <VipTag />}
      {row.monthly && <MonthlyTag />}
      {row.split && (
        <span title={`${row.split} 人組隊平分`} className="ml-auto text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
          ÷{row.split}
        </span>
      )}
      {kind === 'astra' ? (
        <b className={cn('flex flex-col items-end leading-tight font-semibold whitespace-nowrap text-secondary-foreground tabular-nums', row.split ? 'ml-1.5' : 'ml-auto')}>
          {row.amount > 0 && (
            <span>
              +{fmtUnits(row.amount)}
              <UnitText>痕跡</UnitText>
            </span>
          )}
          {(row.shard ?? 0) > 0 && (
            <span>
              +{fmtUnits(row.shard!)}
              <UnitText>碎片</UnitText>
            </span>
          )}
        </b>
      ) : (
        <b className={cn('font-semibold whitespace-nowrap text-secondary-foreground tabular-nums', row.split ? 'ml-1.5' : 'ml-auto')}>
          +{fmtUnits(row.amount)}
          <UnitText>{unit}</UnitText>
        </b>
      )}
    </li>
  );
}
