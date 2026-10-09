import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PendingLabel } from '@/components/PendingLabel';
import { ChoiceCards, type Choice } from '@/components/sync/ChoiceCards';
import { CompareTally, type TallySide } from '@/components/sync/CompareTally';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useSyncController, useSyncView } from '@/hooks/useSyncController';
import type { DataSnapshot } from '@/lib/sync/snapshot';
import { describeOverwrite, summarizeSnapshot } from '@/lib/sync/snapshotSummary';
import type { SyncController, SyncDialog } from '@/lib/sync/syncController';
import { describeOverwriteEffect, describeRestoreSource, formatDateTime, restoreSourceName } from '@/lib/sync/syncText';

type ContentProps<K extends SyncDialog['kind']> = {
  dialog: Extract<SyncDialog, { kind: K }>;
  busy: boolean;
  controller: SyncController;
};

/** 欄名下方的「最後修改時間」 */
function modifiedCaption(snapshot: DataSnapshot): string {
  const at = summarizeSnapshot(snapshot).lastModifiedAt;
  const time = at ? formatDateTime(at) : undefined;
  return time ? `${time} 修改` : '沒有修改紀錄';
}

/**
 * 比較畫面共用的版面：標題、（提示）、兩邊對齊比較、單選卡片、取消與確定。
 * 點卡片只是選取，按「確定」才執行選到的動作；預選項目由呼叫端決定。
 */
function CompareLayout<T extends string>(props: {
  title: string;
  description: string;
  notice?: string;
  left: TallySide;
  right: TallySide;
  choices: Choice<T>[];
  initial: T;
  busy: boolean;
  cancelLabel: string;
  hint: string;
  onCancel: () => void;
  /** 執行選到的動作；回傳的 Promise 結束時解除處理中 */
  onConfirm: (value: T) => Promise<unknown>;
}) {
  const [value, setValue] = useState<T>(props.initial);
  const { pending, run } = usePendingAction();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>{props.description}</DialogDescription>
      </DialogHeader>
      {props.notice && (
        <p role="status" className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {props.notice}
        </p>
      )}
      <CompareTally left={props.left} right={props.right} />
      <ChoiceCards legend="要怎麼處理" choices={props.choices} value={value} onChange={setValue} disabled={props.busy} />
      <DialogFooter className="items-stretch border-t pt-4 sm:items-center">
        <p className="text-center text-xs text-muted-foreground sm:mr-auto sm:text-left">{props.hint}</p>
        <Button variant="outline" disabled={props.busy} onClick={props.onCancel}>
          {props.cancelLabel}
        </Button>
        <Button
          disabled={props.busy || pending}
          aria-busy={pending}
          onClick={() => run(() => props.onConfirm(value))}
        >
          <PendingLabel pending={pending}>確定</PendingLabel>
        </Button>
      </DialogFooter>
    </>
  );
}

function FirstLoginContent({ dialog, busy, controller }: ContentProps<'firstLogin'>) {
  const stale = dialog.reason === 'stale';
  return (
    <CompareLayout
      title={stale ? '超過 90 天沒有同步' : '這台裝置和雲端都有資料'}
      description={stale ? '這台裝置太久沒連上雲端，先看兩邊的差異，再選一種處理方式。' : '先看兩邊的差異，再選一種處理方式。'}
      left={{ name: '這台裝置', caption: modifiedCaption(dialog.local), icon: 'device', snapshot: dialog.local }}
      right={{ name: '雲端', caption: modifiedCaption(dialog.cloud.snapshot), icon: 'cloud', snapshot: dialog.cloud.snapshot }}
      choices={[
        {
          value: 'merge',
          title: '合併兩邊的資料',
          recommended: true,
          description: '兩邊的角色、任務都保留。同一筆資料有差異時，採用較新的版本。',
          effect: '不會失去任何角色',
        },
        {
          value: 'cloud',
          title: '改用雲端資料',
          description: '這台裝置的資料換成雲端的版本，換掉之前會先存成雲端還原點。',
          effect: describeOverwriteEffect(describeOverwrite(dialog.local, dialog.cloud.snapshot), { subject: '這台裝置', version: '雲端' }),
          warn: true,
        },
      ]}
      initial="merge"
      busy={busy}
      cancelLabel="取消登入"
      hint="取消不會改動任何資料"
      onCancel={() => void controller.dismissDialog()}
      onConfirm={(value) => (value === 'merge' ? controller.chooseMerge() : controller.chooseCloud())}
    />
  );
}

function ConfirmOverwriteContent({ dialog, busy, controller }: ContentProps<'confirmOverwrite'>) {
  const restoredAt = formatDateTime(dialog.restoredAt);
  return (
    <CompareLayout
      title="雲端要用哪一份資料？"
      description="你在未登入時還原過資料。沒選的那一份會先存成雲端還原點，之後還能找回。"
      left={{ name: '這台裝置的資料', caption: restoredAt ? `${restoredAt} 還原` : '未登入時還原', icon: 'device', snapshot: dialog.local }}
      right={{ name: '雲端', caption: modifiedCaption(dialog.cloud.snapshot), icon: 'cloud', snapshot: dialog.cloud.snapshot }}
      choices={[
        {
          value: 'device',
          title: '使用這台裝置的資料',
          description: '雲端換成這台裝置的版本，其他裝置同步後也會變成這份。',
          effect: describeOverwriteEffect(describeOverwrite(dialog.cloud.snapshot, dialog.local), { subject: '雲端', version: '這台裝置' }),
          warn: true,
        },
        {
          value: 'cloud',
          title: '改用雲端資料',
          description: '放棄這次還原，這台裝置改用雲端的版本。',
          effect: '這台裝置的資料會先存成雲端還原點',
        },
      ]}
      initial="device"
      busy={busy}
      cancelLabel="取消登入"
      hint="取消會保留這台裝置的資料，下次登入再選"
      onCancel={() => void controller.dismissDialog()}
      onConfirm={(value) => (value === 'device' ? controller.chooseDevice() : controller.chooseCloud())}
    />
  );
}

function RestoreContent({ dialog, busy, controller }: ContentProps<'restore'>) {
  const signedIn = dialog.mode === 'signedIn';
  const sourceName = restoreSourceName(dialog.source.kind);
  const currentName = signedIn ? '目前的資料' : '這台裝置的資料';
  return (
    <CompareLayout
      title="要還原成哪一份資料？"
      description="先看兩邊的差異，再決定要不要還原。"
      notice={dialog.refreshed ? '雲端資料剛被其他裝置更新，已重新比較' : undefined}
      left={{ name: currentName, caption: modifiedCaption(dialog.current), icon: signedIn ? 'cloud' : 'device', snapshot: dialog.current }}
      right={{ name: describeRestoreSource(dialog.source), caption: '要還原的資料', icon: 'history', snapshot: dialog.target }}
      choices={[
        {
          value: 'keep',
          title: `維持${currentName}`,
          description: '不還原，什麼都不會改。',
          effect: '不做任何變更',
        },
        {
          value: 'restore',
          title: `還原成${sourceName}`,
          description: signedIn
            ? `這台裝置與雲端都換成${sourceName}的版本，其他裝置同步後也會變成這份。`
            : `這台裝置換成${sourceName}的版本，之後登入時會再確認雲端要用哪一份。`,
          effect: describeOverwriteEffect(describeOverwrite(dialog.current, dialog.target), { version: sourceName, addedVerb: '找回', warnNewer: false }),
          warn: true,
        },
      ]}
      initial="restore"
      busy={busy}
      cancelLabel="取消"
      hint={signedIn ? '還原前，目前雲端的資料會先存成雲端還原點' : '還原前，這台裝置的資料會先存成還原點'}
      onCancel={() => void controller.dismissDialog()}
      onConfirm={(value) => (value === 'restore' ? controller.confirmRestore() : controller.dismissDialog())}
    />
  );
}

/**
 * 全站對話框，掛在 AppLayout：登入與同步可能發生在任何頁面。
 * 開關完全由控制器的 dialog 狀態決定；使用者關閉視窗時交給 dismissDialog 判斷代表什麼。
 */
export function SyncDialogs() {
  const controller = useSyncController();
  const dialog = useSyncView((s) => s.dialog);
  const busy = useSyncView((s) => s.busy);
  const reset = usePendingAction();
  const dismiss = (open: boolean) => {
    if (!open) void controller.dismissDialog();
  };

  return (
    <>
      <Dialog
        open={dialog?.kind === 'firstLogin' || dialog?.kind === 'confirmOverwrite' || dialog?.kind === 'restore'}
        onOpenChange={dismiss}
      >
        <DialogContent className="gap-5 sm:max-w-3xl">
          {/* key：換成另一個對話框（例如還原重新比較）時重設預選項目 */}
          {dialog?.kind === 'firstLogin' && <FirstLoginContent key="firstLogin" dialog={dialog} busy={busy} controller={controller} />}
          {dialog?.kind === 'confirmOverwrite' && (
            <ConfirmOverwriteContent key="confirmOverwrite" dialog={dialog} busy={busy} controller={controller} />
          )}
          {dialog?.kind === 'restore' && (
            <RestoreContent key={`restore-${dialog.refreshed}`} dialog={dialog} busy={busy} controller={controller} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog?.kind === 'reset'} onOpenChange={dismiss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>雲端資料已被重置</AlertDialogTitle>
            <AlertDialogDescription>
              其他裝置執行了「刪除所有紀錄」，這台裝置還保有重置前的資料。要繼續用這個 Google 帳號同步，就必須重置這台裝置；
              不重置的話會登出，資料只留在這台裝置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>不重置並登出</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy || reset.pending}
              aria-busy={reset.pending}
              onClick={(e) => {
                // 重置是非同步的，阻止預設的立即關閉（關閉會被當成不重置並登出）
                e.preventDefault();
                reset.run(() => controller.resetDevice());
              }}
            >
              <PendingLabel pending={reset.pending}>重置此裝置</PendingLabel>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.kind === 'formatTooNew'} onOpenChange={dismiss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>網站已經更新</AlertDialogTitle>
            <AlertDialogDescription>
              雲端資料是用較新版本的網站儲存的，請重新整理頁面後再同步。重新整理之前，修改只會保存在這台裝置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>稍後</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.reload()}>重新整理</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
