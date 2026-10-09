import { useEffect, useRef } from 'react';
import { ClockArrowUp, CloudAlert, CloudOff, RefreshCw } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { CircleCheckIcon, type CircleCheckIconHandle } from '@/components/ui/circle-check';
import { CloudSyncIcon } from '@/components/ui/cloud-sync';
import { PauseIcon } from '@/components/ui/pause';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/useNow';
import { useSyncController, useSyncView } from '@/hooks/useSyncController';
import type { SyncStatus } from '@/lib/sync/syncScheduler';
import { describeSyncStatus, formatSyncedAgo } from '@/lib/sync/syncText';
import { cn } from '@/lib/utils';

/** 還沒收到第一個狀態時視為同步中 */
type StatusKind = SyncStatus['kind'];

/** Popover 標題：狀態名稱（tooltip 用的 label 會帶上時間） */
const STATUS_TITLES: Record<StatusKind, string> = {
  synced: '已同步',
  syncing: '同步中…',
  pending: '有修改待同步',
  offline: '離線',
  reconnectRequired: '需要重新連線',
  blocked: '已暫停同步',
};

/** Popover 第二行的說明；已同步時改顯示最後同步時間 */
const STATUS_DETAILS: Record<Exclude<StatusKind, 'synced'>, string> = {
  syncing: '正在與雲端交換資料',
  pending: '修改會在幾秒內同步到雲端',
  offline: '連線恢復後會自動同步',
  reconnectRequired: 'Google 授權已失效，修改暫存在這台裝置',
  blocked: '需要先處理跳出的視窗，才能繼續同步',
};

// 頂欄是深森綠底，綠色與紅色都要用較亮的版本才看得清楚
const OK_ICON = 'text-[oklch(0.82_0.14_150)]';
const ERROR_ICON = 'text-[oklch(0.78_0.17_25)]';

/** 已同步圖示：每次切換成已同步時元件會重新掛載，掛載時播放一次打勾動畫；hover 時也會再播一次 */
function SyncedIcon() {
  const ref = useRef<CircleCheckIconHandle>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!reduceMotion) void ref.current?.startAnimation();
  }, [reduceMotion]);
  return <CircleCheckIcon ref={ref} size={16} className={OK_ICON} onMouseEnter={() => void ref.current?.startAnimation()} />;
}

function StatusIcon({ kind }: { kind: StatusKind }) {
  switch (kind) {
    case 'synced':
      return <SyncedIcon />;
    case 'syncing':
      return <CloudSyncIcon size={16} loop />;
    case 'pending':
      return <ClockArrowUp className="size-4" />;
    case 'offline':
      return <CloudOff className="size-4" />;
    case 'reconnectRequired':
      return <CloudAlert className={cn('size-4', ERROR_ICON)} />;
    case 'blocked':
      return <PauseIcon size={16} />;
  }
}

/**
 * Header 右側的同步狀態，只在已登入時顯示。桌機與手機都只顯示圖示：
 * 桌機 hover 時在圖示下方顯示 tooltip，點擊（手機點擊）開啟 Popover，顯示完整狀態與可用的動作。
 * 需要重新連線或已暫停時，桌機在圖示旁另外放一顆處理按鈕。
 * @param className 頂欄按鈕的配色 class（由 Header 傳入）
 */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const controller = useSyncController();
  const signedIn = useSyncView((s) => s.auth.kind === 'signedIn');
  const status = useSyncView((s) => s.status);
  const lastSyncedAt = useSyncView((s) => s.lastSyncedAt);
  const busy = useSyncView((s) => s.busy);
  const now = useNow(60_000);

  if (!signedIn) return null;
  const kind: StatusKind = status?.kind ?? 'syncing';
  const view = describeSyncStatus(status, lastSyncedAt, now);
  const detail = kind === 'synced' ? (lastSyncedAt ? `最後同步 ${formatSyncedAgo(lastSyncedAt, now)}` : undefined) : STATUS_DETAILS[kind];

  // 重新連線要開 Google 登入視窗；已暫停時重新同步一次，讓對話框再次出現
  const action =
    kind === 'reconnectRequired'
      ? { label: '重新連線', run: () => void controller.signIn() }
      : kind === 'blocked'
        ? { label: '處理', run: () => void controller.syncNow() }
        : view.action === 'syncNow'
          ? { label: '立即同步', run: () => void controller.syncNow() }
          : undefined;

  return (
    <>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={cn('rounded-full', className)} aria-label={`同步狀態：${view.label}`}>
                <StatusIcon kind={kind} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{view.label}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="flex w-64 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className={cn('text-sm font-semibold', kind === 'reconnectRequired' && 'text-destructive')}>{STATUS_TITLES[kind]}</p>
            {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
          </div>
          {action && (
            <Button size="sm" className="w-full gap-1.5" disabled={busy} onClick={action.run}>
              {action.label === '立即同步' && <RefreshCw className="size-3.5" />}
              {action.label}
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {(kind === 'reconnectRequired' || kind === 'blocked') && (
        <Button
          size="sm"
          variant={kind === 'reconnectRequired' ? 'default' : 'outline'}
          className={cn(
            'hidden sm:inline-flex',
            kind === 'blocked' && 'border-sidebar-foreground/35 bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
          disabled={busy}
          onClick={action!.run}
        >
          {action!.label}
        </Button>
      )}
    </>
  );
}
