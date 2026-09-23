import { useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown, Pencil, Plus } from 'lucide-react';
import { BoardCharacterRow } from '@/components/BoardCharacterRow';
import { BoardSortableRows } from '@/components/BoardSortableRows';
import { CrystalAmount } from '@/components/CrystalAmount';
import { VipTierDialog } from '@/components/VipTierDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { validateAccountName } from '@/lib/accountName';
import type { BoardAccountGroup, BoardRevenueColumn } from '@/lib/characterBoard';
import { VIP_TIER_BADGE_CLASSES, VIP_TIER_LABELS } from '@/lib/vipBossCatalog';
import { VIP_TIER_ICONS } from '@/lib/vipTierIcons';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/store/useAccountStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { Account } from '@/types';

/* 討伐收益合計中使用的中文敘述 */
const REVENUE_COLUMN_LABELS: Record<BoardRevenueColumn['cycle'], string> = {
  daily: '本日',
  weekly: '本週',
  monthly: '本月',
};

/**
 * 帳號的討伐收益合計橫條:日/週/月各一欄,每欄是合計金額加「已討伐 x/y 隻」與細進度線;沒有任何一欄成立時整條不 render。
 * 已討伐隻數只算一般王(不含 VIP),跟金額口徑不同,這個不對稱與角色頁 DashboardSummary 的既有行為一致。
 * 是帳號標題的兄弟層,不是子層:放進標題裡會被右側按鈕擠窄,跟下面的角色列對不齊。
 * 容器寬度不足時從橫向三欄改成一週期一列,金額欄固定寬、靠右,讓每條進度線在同一個位置結束。
 */
function AccountRevenueStrip({ columns }: { columns: BoardRevenueColumn[] }) {
  if (columns.length === 0) return null;

  return (
    <div className="mb-3 flex items-stretch rounded-[10px] bg-muted px-3.5 py-2.5 @max-[712px]:flex-col">
      <div className="mr-1 flex flex-col justify-center gap-[3px] border-r border-border pr-4 @max-[712px]:mr-0 @max-[712px]:mb-2 @max-[712px]:flex-row @max-[712px]:items-center @max-[712px]:justify-between @max-[712px]:gap-2 @max-[712px]:border-r-0 @max-[712px]:border-b @max-[712px]:pr-0 @max-[712px]:pb-2">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold tracking-wide text-boss-foreground">
          <img src="/coin.png" alt="" className="size-4 shrink-0" />
          討伐收益合計
        </span>
        <span className="text-[10.5px] text-muted-foreground">已討伐 / 追蹤中</span>
      </div>
      <div className="flex min-w-0 flex-1 @max-[712px]:flex-none @max-[712px]:flex-col">
        {columns.map((column) => (
          <div
            key={column.cycle}
            className="flex min-w-0 flex-1 flex-col gap-1 border-border px-3.5 not-first:border-l @max-[712px]:flex-none @max-[712px]:flex-row @max-[712px]:items-center @max-[712px]:gap-2 @max-[712px]:px-0 @max-[712px]:py-1.5 @max-[712px]:not-first:border-t @max-[712px]:not-first:border-l-0"
          >
            <span className="text-[10.5px] font-semibold text-muted-foreground @max-[712px]:order-1 @max-[712px]:flex-none @max-[712px]:text-[11px] @max-[712px]:text-foreground">
              {REVENUE_COLUMN_LABELS[column.cycle]}
            </span>
            <CrystalAmount
              value={column.revenue}
              className="text-[17px] @max-[712px]:order-3 @max-[712px]:min-w-[116px] @max-[712px]:flex-none @max-[712px]:justify-end @max-[712px]:text-[15px]"
            />
            <span className="flex items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground @max-[712px]:order-2 @max-[712px]:min-w-0 @max-[712px]:flex-1">
              <b className="font-bold text-boss-foreground">{column.bossDone}</b>/{column.bossTotal} 隻
              <Progress
                value={column.bossTotal > 0 ? (column.bossDone / column.bossTotal) * 100 : 0}
                className="h-1 max-w-[72px] flex-1 @max-[712px]:max-w-none"
                indicatorClassName="bg-boss-foreground"
                aria-label={`${REVENUE_COLUMN_LABELS[column.cycle]}已討伐 ${column.bossDone}/${column.bossTotal} 隻`}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 帳號標題就地重新命名:標題變成輸入框,Enter 或失焦確認,Esc 取消;空白或名稱不合法時失焦會還原成原名,
 * Enter 遇到不合法則留在輸入框並顯示原因。驗證規則與新增帳號共用 validateAccountName。
 * @param props.account 要重新命名的帳號
 * @param props.onDone 結束編輯(不論確認或取消)時呼叫
 */
function RenameAccountForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const accounts = useAccountStore((s) => s.accounts);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const [name, setName] = useState(account.name);
  // 避免 Enter/Esc 收尾後,輸入框卸載觸發的 blur 又重複確認一次
  const settled = useRef(false);
  const error = validateAccountName(name, accounts, account.id);

  function finish() {
    settled.current = true;
    onDone();
  }

  function commit() {
    if (settled.current) return;
    const trimmed = name.trim();
    if (trimmed && !error && trimmed !== account.name) updateAccount(account.id, { name: trimmed });
    finish();
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        autoFocus
        value={name}
        aria-label={`重新命名帳號:${account.name}`}
        aria-invalid={error !== null}
        className="h-8 w-52 text-base font-bold"
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (error === null) commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish();
          }
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * 帳號的 VIP 入口:已設定顯示等級徽章(可點擊修改),未設定顯示虛線的「設定 VIP」按鈕;
 * 有配額時另顯示「VIP 重置券 已用/上限」與細進度線。
 * VIP 屬於帳號,底下所有角色共用重置券配額;未歸類不是真的帳號,不會渲染這個入口。
 * 放在摺疊清單內、討伐收益合計下方,跟排序角色按鈕同一行,跟著收合一起藏起來,不佔標題列的空間。
 * @param props.account 所屬帳號
 * @param props.quota 帳號的重置券用量;沒有配額時為 undefined
 */
function AccountVipEntry({ account, quota }: { account: Account; quota: BoardAccountGroup['vipQuota'] }) {
  const [open, setOpen] = useState(false);
  const vipTier = account.vipTier;
  const vipTierIconSrc = vipTier && VIP_TIER_ICONS[vipTier];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {vipTier && vipTierIconSrc ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`修改VIP等級:目前是${VIP_TIER_LABELS[vipTier]}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50',
                VIP_TIER_BADGE_CLASSES[vipTier],
              )}
            >
              <img src={vipTierIconSrc} alt="" className="size-3" />
              {VIP_TIER_LABELS[vipTier]}
              <Pencil className="size-2.5 opacity-70" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>修改 VIP 等級</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setOpen(true)}
          className="gap-1 border border-dashed border-border text-muted-foreground"
        >
          <Plus className="size-3" />
          設定 VIP
        </Button>
      )}
      {quota && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          VIP 重置券
          <b className={cn('tabular-nums', quota.used >= quota.cap ? 'text-vip-accent-text' : 'text-foreground')}>
            {quota.used}/{quota.cap}
          </b>
          <Progress
            value={quota.cap > 0 ? Math.min(100, (quota.used / quota.cap) * 100) : 0}
            className="h-1 w-14"
            indicatorClassName="bg-vip-accent-text"
            aria-label={`VIP 重置券已使用 ${quota.used}/${quota.cap}`}
          />
        </span>
      )}
      <VipTierDialog account={account} open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface BoardAccountSectionProps {
  group: BoardAccountGroup;
  /** 目前是否收合;由呼叫端用 resolveAccountCollapsed 算好傳入 */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * 看板上的一個帳號區塊:標題(收合按鈕、角色數、「今日已完成」徽章、重新命名)、
 * 討伐收益合計橫條、VIP 入口與排序角色按鈕(同一行)、角色列。
 * 收合會連同收益橫條、VIP 入口與排序角色按鈕一起藏起來,只留標題,所以收合是從明細降級成摘要,不是只藏角色列。
 * 只有「箭頭加帳號名稱」這顆按鈕可以收合,不是整個標題列。
 * 排序模式會強制展開,角色列改成可拖曳排序、不可點擊;放開後用 applyCharacterLayout 寫回這個帳號內的順序。
 * @param props.group 帳號區塊資料;未歸類是合成分組(account 為 null),沒有 VIP、不能重新命名
 * @param props.collapsed 目前是否收合
 * @param props.onToggleCollapse 使用者點擊收合按鈕時呼叫
 */
export function BoardAccountSection({ group, collapsed, onToggleCollapse }: BoardAccountSectionProps) {
  const applyCharacterLayout = useCharacterStore((s) => s.applyCharacterLayout);
  const [renaming, setRenaming] = useState(false);
  const [sortingRequested, setSortingRequested] = useState(false);
  const account = group.account;
  // 少於兩隻角色沒東西可排,角色被搬走導致不足時自動離開排序模式
  const sorting = sortingRequested && group.rows.length >= 2;
  const showRows = !collapsed || sorting;

  return (
    <section className="border-t border-border pt-7 first:border-t-0 first:pt-0">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {renaming && account ? (
          <RenameAccountForm account={account} onDone={() => setRenaming(false)} />
        ) : (
          <h2 className="text-base">
            <button
              type="button"
              aria-expanded={showRows}
              disabled={sorting}
              onClick={onToggleCollapse}
              className="-ml-1.5 inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', !showRows && '-rotate-90')}
              />
              <span className={cn('font-bold', account === null && 'font-semibold text-muted-foreground')}>{group.name}</span>
              <span className="text-[12.5px] font-normal text-muted-foreground">{group.rows.length} 位角色</span>
              {group.allDone && (
                <Badge variant="secondary" className="gap-1 border-transparent bg-done text-done-foreground">
                  <Check className="size-2.5" strokeWidth={3} />
                  今日已完成
                </Badge>
              )}
            </button>
          </h2>
        )}

        {account && !renaming && !sorting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`重新命名帳號:${group.name}`}
                className="text-muted-foreground"
                onClick={() => setRenaming(true)}
              >
                <Pencil className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重新命名</TooltipContent>
          </Tooltip>
        )}
      </div>

      {sorting && (
        <p role="status" className="mb-2.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          排序中，拖曳左側握把，或點選握把後按空白鍵拿起、用上下方向鍵移動來調整順序，完成排序後按「完成」。
        </p>
      )}

      {showRows && (
        <>
          <AccountRevenueStrip columns={group.revenueColumns} />

          {(account || group.rows.length >= 2) && (
            <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {account && <AccountVipEntry account={account} quota={group.vipQuota} />}

              {group.rows.length >= 2 && (
                <div className="ml-auto">
                  <Button
                    type="button"
                    variant={sorting ? 'default' : 'ghost'}
                    size="xs"
                    className={cn('gap-1', !sorting && 'text-muted-foreground')}
                    onClick={() => setSortingRequested(!sorting)}
                  >
                    {sorting ? (
                      <>
                        <Check className="size-3" />
                        完成
                      </>
                    ) : (
                      <>
                        <ArrowUpDown className="size-3" />
                        排序角色
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {group.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              這個帳號還沒有角色
            </p>
          ) : sorting ? (
            <BoardSortableRows
              rows={group.rows}
              onReorder={(ids) => applyCharacterLayout([{ accountId: account?.id ?? null, characterIds: ids }])}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <BoardCharacterRow key={row.character.id} row={row} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
