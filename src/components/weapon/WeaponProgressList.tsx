import type { CSSProperties } from 'react';
import { ArrowUp, Check, Lock } from 'lucide-react';
import type { CharacterWeaponState } from '@/lib/weapon/types';
import { cn } from '@/lib/utils';
import { WEAPON_META, weaponColor, type WeaponListRow } from './weaponUi';

/**
 * 四把武器的進度清單(看板與角色頁入口共用):每行是名稱、進度條、階段文字三欄,欄寬由呼叫端的 grid 決定。
 * 進行中用各武器的顏色,待升階時階段文字加粗並加向上箭頭;完成打勾、未解鎖顯示鎖頭、未設定是一條淡虛線。
 * 只是畫面,螢幕閱讀器文字由呼叫端用 describeWeaponRows 補上
 * @param rows weaponListRows 的結果
 * @param state 四把武器的狀態(取得命運目前階段的顏色)
 * @param className grid 欄寬與字級
 * @param pairClassName 第二欄武器名稱的 class(排成兩組時用來拉開兩組的間距)
 */
export function WeaponProgressList({
  rows,
  state,
  className,
  pairClassName,
}: {
  rows: WeaponListRow[];
  state: CharacterWeaponState;
  className?: string;
  pairClassName?: string;
}) {
  return (
    <span aria-hidden="true" className={cn('grid items-center gap-x-2 gap-y-[7px]', className)}>
      {rows.map(({ kind, status, pct, label, waiting }, i) => {
        const dim = status === 'locked' || status === 'unset';
        return (
          <span key={kind} className="contents" style={{ '--bar': weaponColor(kind, state) } as CSSProperties}>
            <span className={cn('font-medium whitespace-nowrap', i % 2 === 1 && pairClassName, dim && 'text-muted-foreground')}>
              {WEAPON_META[kind].tab}
            </span>
            {status === 'locked' ? (
              <span className="flex items-center text-muted-foreground">
                <Lock className="size-3" />
              </span>
            ) : status === 'unset' ? (
              <span className="border-t border-dashed border-border" />
            ) : (
              <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-[color-mix(in_oklab,var(--bar)_22%,var(--card))]">
                <i className="absolute inset-y-0 left-0 rounded-[3px] bg-(--bar)" style={{ width: `${pct}%` }} />
              </span>
            )}
            <span
              className={cn(
                'flex items-center justify-end gap-[3px] whitespace-nowrap tabular-nums',
                dim ? 'text-muted-foreground' : 'text-(--bar)',
                waiting && 'font-bold',
                (status === 'done' || status === 'phase1done') && 'font-semibold',
              )}
            >
              {waiting && <ArrowUp className="size-3 shrink-0" strokeWidth={3} />}
              {(status === 'done' || status === 'phase1done') && <Check className="size-3 shrink-0" strokeWidth={3} />}
              {label}
            </span>
          </span>
        );
      })}
    </span>
  );
}
