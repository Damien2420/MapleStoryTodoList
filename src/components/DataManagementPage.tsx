import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { buildCurrentBackupPayloadJson } from '@/lib/backupPayload';
import { parseSavedSnapshot } from '@/lib/sync/restorePoints';
import type { RestoreSource, RestoreSourceKind } from '@/lib/sync/syncController';
import { describeSyncStatus, formatDateTime } from '@/lib/sync/syncText';
import { PendingLabel } from '@/components/PendingLabel';
import { useNow } from '@/hooks/useNow';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useSyncController, useSyncView } from '@/hooks/useSyncController';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';

type DeleteKind = 'local' | 'all';

// 確認文字與按鈕同名，使用者輸入的就是自己要按的動作
const DELETE_LABELS: Record<DeleteKind, string> = { local: '刪除本機紀錄', all: '刪除所有紀錄' };

// 還原點每一列的名稱與說明；未登入只有本機還原點，已登入只有雲端的兩份
type RestoreSlot = Exclude<RestoreSourceKind, 'file'>;
const RESTORE_SLOTS: Record<RestoreSlot, { name: string; note: string }> = {
  localRestorePoint: { name: '本機還原點', note: '還原、刪除角色或帳號前自動建立' },
  cloudRestorePoint: { name: '雲端還原點', note: '還原、刪除角色或帳號前自動建立' },
  dailySnapshot: { name: '每日快照', note: '今天第一次修改雲端前的內容' },
};
const SIGNED_IN_SLOTS: RestoreSlot[] = ['cloudRestorePoint', 'dailySnapshot'];
const SIGNED_OUT_SLOTS: RestoreSlot[] = ['localRestorePoint'];

const DANGER_LINE_BUTTON = 'border-destructive bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive dark:bg-transparent';
const DANGER_SOLID_BUTTON = 'bg-destructive text-(--destructive-foreground) hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90';

/** 觸發瀏覽器把一段文字內容當成檔案下載,用完即釋放暫存的 object URL */
function downloadTextAsFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 資料管理頁的一張卡片區塊 */
function Section({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${danger ? 'border-destructive/40' : 'border-border'}`}
    >
      <h3 className={`text-sm font-semibold ${danger ? 'text-destructive' : 'text-foreground'}`}>{title}</h3>
      {children}
    </section>
  );
}

/** 卡片內的一列：左邊標題加小字說明，右邊放動作按鈕；列與列之間用分隔線 */
function Line({ title, detail, children }: { title: ReactNode; detail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border py-2 first-of-type:border-t-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex w-full gap-2 *:flex-1 sm:w-auto sm:*:flex-none">{children}</div>
    </div>
  );
}

/** 資料管理頁面(路由 /backup):Google 帳號、備份檔案、還原點、清除紀錄;由 App.tsx 動態載入 */
export function DataManagementPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controller = useSyncController();
  const auth = useSyncView((s) => s.auth);
  const status = useSyncView((s) => s.status);
  const lastSyncedAt = useSyncView((s) => s.lastSyncedAt);
  const busy = useSyncView((s) => s.busy);
  const dialogOpen = useSyncView((s) => s.dialog !== undefined);
  const now = useNow(60_000);
  const signedIn = auth.kind === 'signedIn';
  const email = auth.kind === 'signedIn' ? auth.user?.email : undefined;

  const [sources, setSources] = useState<RestoreSource[]>();
  const [sourcesFailed, setSourcesFailed] = useState(false);
  const [deleteKind, setDeleteKind] = useState<DeleteKind>();
  const [confirmText, setConfirmText] = useState('');
  const deleting = usePendingAction();

  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);
  const hasTasks = useTaskStore((s) => s.tasks.length > 0);
  const hasBosses = useBossStore((s) => s.bosses.length > 0);
  const hasAccounts = useAccountStore((s) => s.accounts.length > 0);
  const hasAnyData = hasCharacters || hasTasks || hasBosses || hasAccounts;

  // 登入狀態改變、或對話框關閉（還原、刪除可能產生新的還原點）時重新查詢還原點
  useEffect(() => {
    if (auth.kind === 'checking' || dialogOpen) return;
    let cancelled = false;
    controller.listRestoreSources().then(
      (list) => {
        if (cancelled) return;
        setSources(list);
        setSourcesFailed(false);
      },
      () => {
        if (!cancelled) setSourcesFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [controller, auth.kind, dialogOpen]);

  function handleDownloadToComputer() {
    downloadTextAsFile(
      buildCurrentBackupPayloadJson(),
      `maplestory-todolist-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const saved = parseSavedSnapshot(await file.text());
    if (!saved) {
      toast.error('檔案格式錯誤，或是由較新版本的網站產生，無法還原');
      return;
    }
    await controller.startRestore(saved.snapshot, { kind: 'file', savedAt: saved.savedAt });
  }

  function closeDelete() {
    setDeleteKind(undefined);
    setConfirmText('');
  }

  async function handleConfirmDelete() {
    const kind = deleteKind;
    const done = kind === 'all' ? await controller.deleteAll() : await controller.deleteLocal();
    if (!done) return;
    closeDelete();
    toast.success(kind === 'all' ? '已刪除所有裝置上的紀錄' : '已刪除這台裝置上的紀錄');
    // 用 replace 取代 /backup 這一筆歷史,避免使用者按返回回到剛執行完破壞性操作的頁面
    navigate(ROUTES.root, { replace: true });
  }

  /** 還原點一列的小字：時間加建立時機；讀取中、讀取失敗或尚未建立時顯示對應文字 */
  function restoreDetail(source: RestoreSource | undefined, kind: RestoreSlot): string {
    if (sourcesFailed) return '無法讀取，請稍後再試';
    if (sources === undefined) return '讀取中';
    if (!source) return '尚未建立';
    return `${formatDateTime(source.savedAt)} · ${RESTORE_SLOTS[kind].note}`;
  }

  const statusView = signedIn ? describeSyncStatus(status, lastSyncedAt, now) : undefined;
  const deleteLabel = deleteKind ? DELETE_LABELS[deleteKind] : '';
  const deleteDescriptions =
    deleteKind === 'all'
      ? ['雲端與這台裝置的資料都會清空，其他裝置下次同步時會被通知並重置。', '刪除前會把目前雲端的資料存成還原點，可以從資料管理頁還原。']
      : signedIn
        ? ['這台裝置的所有資料會被清空，並登出 Google。雲端與其他裝置的資料不受影響。', '會先把還沒同步的修改推送上去，推送失敗就不會刪除。']
        : ['這台裝置的所有帳號、角色、任務與 BOSS 紀錄會被清空，無法復原。'];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h2 className="text-lg font-semibold text-foreground">備份與同步</h2>

      <Section title="Google 帳號">
        {!signedIn ? (
          <>
            <p className="text-sm text-muted-foreground">
              登入後，這台裝置的資料會自動同步到你的 Google Drive，在其他裝置登入同一個帳號就能看到。
            </p>
            <div>
              <Button type="button" disabled={busy || auth.kind === 'checking'} onClick={() => void controller.signIn()}>
                登入 Google
              </Button>
            </div>
          </>
        ) : (
          <Line title={email ?? 'Google 帳號'} detail={statusView?.label}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              // 登入後會馬上同步一次，同步中再按沒有意義
              disabled={status === undefined || status.kind === 'syncing'}
              onClick={() => void controller.syncNow()}
            >
              立即同步
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void controller.signOut()}>
              登出
            </Button>
          </Line>
        )}
      </Section>

      <Section title="備份檔案">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={!hasAnyData} onClick={handleDownloadToComputer}>
            下載備份檔案到電腦
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            從檔案還原
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
        </div>
        <p className="text-xs text-muted-foreground">從檔案還原會完全取代目前的資料，不是合併。選檔後先顯示兩份資料的比較。</p>
      </Section>

      <Section title="還原點">
        <div>
          {(signedIn ? SIGNED_IN_SLOTS : SIGNED_OUT_SLOTS).map((kind) => {
            const source = sources?.find((s) => s.kind === kind);
            return (
              <Line key={kind} title={RESTORE_SLOTS[kind].name} detail={restoreDetail(source, kind)}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !source}
                  onClick={() => source && void controller.startRestore(source.snapshot, source)}
                >
                  還原
                </Button>
              </Line>
            );
          })}
        </div>
      </Section>

      <Section title="清除紀錄" danger>
        <div>
          <Line
            title="刪除本機紀錄"
            detail={
              signedIn
                ? '先推送未同步的修改，再登出並清空這台裝置。雲端資料保留。'
                : '清空這台裝置上所有帳號、角色、任務與 BOSS 紀錄。'
            }
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={DANGER_LINE_BUTTON}
              disabled={busy || (!signedIn && !hasAnyData)}
              onClick={() => setDeleteKind('local')}
            >
              {DELETE_LABELS.local}
            </Button>
          </Line>
          {signedIn && (
            <Line title="刪除所有紀錄" detail="清空雲端與這台裝置，其他裝置會被通知重置。刪除前會建立雲端還原點。">
              <Button type="button" size="sm" className={DANGER_SOLID_BUTTON} disabled={busy} onClick={() => setDeleteKind('all')}>
                {DELETE_LABELS.all}
              </Button>
            </Line>
          )}
        </div>
      </Section>

      <AlertDialog open={deleteKind !== undefined} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{deleteLabel}</AlertDialogTitle>
            {deleteDescriptions.map((text) => (
              <AlertDialogDescription key={text}>{text}</AlertDialogDescription>
            ))}
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-confirm" className="text-xs font-semibold text-foreground">
              輸入「{deleteLabel}」以確認
            </label>
            <Input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={DANGER_SOLID_BUTTON}
              disabled={confirmText !== deleteLabel || busy || deleting.pending}
              aria-busy={deleting.pending}
              onClick={(e) => {
                // 刪除是非同步的,阻止預設的立即關閉,完成後由 handleConfirmDelete 關閉
                e.preventDefault();
                deleting.run(handleConfirmDelete);
              }}
            >
              <PendingLabel pending={deleting.pending}>{deleteLabel}</PendingLabel>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DataManagementPage;
