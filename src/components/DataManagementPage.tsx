import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, Cloud, CloudUpload, Download, LogIn, LogOut, RotateCcw, Trash2, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
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
import { cn } from '@/lib/utils';
import { getSignedInEmail, isSignedIn, requestAccessToken, signOut } from '@/lib/googleDrive';
import {
  applyRestoredPayload,
  backupNow,
  checkBackupAvailability,
  clearDriveBackups,
  fetchLatestBackup,
  type BackupAvailability,
} from '@/lib/googleDriveBackup';
import { buildCurrentBackupPayloadJson, parseBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload, type MergeResult } from '@/lib/backupMerge';
import { useBackupStatus } from '@/hooks/useBackupStatus';
import { useStaleConfirm } from '@/hooks/useStaleConfirm';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useAccountStore } from '@/store/useAccountStore';
import { useSettingsStore } from '@/store/useSettingsStore';

const DELETE_ALL_CONFIRM_TEXT = '刪除';
const CLEAR_GOOGLE_DRIVE_TEXT = '清空';

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

/**
 * 把合併結果整理成提示文字:新增筆數一律顯示,更新/移除/略過只在有發生時才顯示;
 * 完全沒有變動時直接說明,避免使用者看到一串 0 以為匯入失敗(例如匯入比本機舊的備份)。
 * @param result mergeBackupPayload 的回傳結果
 * @returns 例如「新增 1 個帳號、2 個角色、0 筆任務、0 筆 BOSS 紀錄，更新 3 筆較新的紀錄」
 */
function describeMergeResult(result: MergeResult): string {
  const { addedAccounts, addedCharacters, addedTasks, addedBosses, updated, removedByTombstone, skippedByLocalTombstone } =
    result;
  if (addedAccounts + addedCharacters + addedTasks + addedBosses + updated + removedByTombstone === 0) {
    return skippedByLocalTombstone > 0
      ? `沒有需要更新的資料，略過 ${skippedByLocalTombstone} 筆此裝置已刪除的紀錄`
      : '沒有需要更新的資料，這台裝置的資料已經是最新的';
  }
  const parts = [`新增 ${addedAccounts} 個帳號、${addedCharacters} 個角色、${addedTasks} 筆任務、${addedBosses} 筆 BOSS 紀錄`];
  if (updated > 0) parts.push(`更新 ${updated} 筆較新的紀錄`);
  if (removedByTombstone > 0) parts.push(`同步移除 ${removedByTombstone} 筆已刪除的紀錄`);
  if (skippedByLocalTombstone > 0) parts.push(`略過 ${skippedByLocalTombstone} 筆此裝置已刪除的紀錄`);
  return parts.join('，');
}

/** 資料管理頁面(路由 /backup):本機/Google Drive 備份與還原、清除全部紀錄,取代主畫面內容顯示(非對話框),由 App.tsx 動態載入 */
export function DataManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [email, setEmail] = useState(getSignedInEmail());
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [availability, setAvailability] = useState<BackupAvailability>();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [clearDriveOpen, setClearDriveOpen] = useState(false);
  const [clearDriveConfirmText, setClearDriveConfirmText] = useState('');
  const [clearingDrive, setClearingDrive] = useState(false);
  const { lastBackupAt, neverBackedUp, hasUnsavedChanges } = useBackupStatus();
  const { confirmIfStale, staleConfirmDialog } = useStaleConfirm();

  // 空資料防護:沒有任何紀錄時,消費資料的操作(下載備份、同步、刪除全部)不開放;產生資料的操作(匯入)不受影響
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);
  const hasTasks = useTaskStore((s) => s.tasks.length > 0);
  const hasBosses = useBossStore((s) => s.bosses.length > 0);
  const hasAccounts = useAccountStore((s) => s.accounts.length > 0);
  const hasAnyData = hasCharacters || hasTasks || hasBosses || hasAccounts;
  // 同步按鈕:本機沒資料時原則上停用(那時同步等於從雲端匯入);但一筆一筆刪光所有資料時,
  // 這些刪除(墓碑)還沒同步出去,仍要能同步,否則雲端與其他裝置會一直保留被刪的資料。
  // 「刪除全部」會把 lastLocalChangeAt 一併清掉,所以不會因此重新啟用
  const canSync = hasAnyData || hasUnsavedChanges;

  useEffect(() => {
    if (!signedIn) return;
    checkBackupAvailability()
      .then(setAvailability)
      .catch(() => toast.error('無法查詢 Drive 備份狀態，請稍後再試'));
  }, [signedIn]);

  function handleDownloadToComputer() {
    downloadTextAsFile(
      buildCurrentBackupPayloadJson(),
      `maplestory-todolist-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  // 返回鈕:站內導覽進來的(key 不是 'default')就回上一頁;直接開書籤或重新整理沒有站內上一頁,改導向首頁,避免 navigate(-1) 把人丟出網站
  function handleBack() {
    if (location.key !== 'default') navigate(-1);
    else navigate(ROUTES.root);
  }

  // 匯入/還原/刪除全部這類會改資料的操作完成後離開:用 replace 取代 /backup 這一筆歷史,
  // 否則使用者按返回會回到剛執行完破壞性操作的頁面
  function leaveAfterDataChange() {
    navigate(ROUTES.root, { replace: true });
  }

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const content = await file.text();
      const payload = parseBackupPayload(content);
      const proceed = await confirmIfStale(payload.createdAt, 'import');
      if (!proceed) return;
      const result = mergeBackupPayload(payload);
      toast.success(`已匯入：${describeMergeResult(result)}`);
      leaveAfterDataChange();
    } catch (error) {
      // JSON.parse 失敗會丟出英文的 SyntaxError,不適合直接顯示;只有版本相關的錯誤才顯示原始訊息
      toast.error(error instanceof Error && !(error instanceof SyntaxError) ? error.message : '檔案格式錯誤，匯入失敗');
    } finally {
      setImporting(false);
    }
  }

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await requestAccessToken();
      setSignedIn(true);
      setEmail(getSignedInEmail());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登入失敗');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setSignedIn(false);
      setEmail(undefined);
      setAvailability(undefined);
    } catch {
      toast.error('登出失敗，請稍後再試');
    } finally {
      setSigningOut(false);
    }
  }

  /**
   * 與 Google Drive 同步:先把雲端上其他裝置的資料合併進本機,再把合併結果上傳(backupNow)。
   * 本機沒有資料、也沒有尚未同步的異動時按鈕停用,因為那時同步等於從雲端匯入,應該改用「從 Google Drive 中匯入」。
   */
  async function handleSync() {
    setBackingUp(true);
    try {
      // 按下同步的當下先關掉任何還顯示中的刪除復原 toast,避免同步完成後使用者再點復原,
      // 導致一筆已經同步進這次備份的刪除紀錄被無聲復活
      toast.dismiss();
      const proceed = await confirmIfStale(lastBackupAt, 'backup');
      if (!proceed) return;
      await backupNow();
      toast.success('同步完成');
      setAvailability(await checkBackupAvailability());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '同步失敗');
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const payload = await fetchLatestBackup();
      const proceed = await confirmIfStale(payload.createdAt, 'import');
      if (!proceed) return;
      const result = applyRestoredPayload(payload);
      toast.success(`已從 Google Drive 匯入：${describeMergeResult(result)}`);
      leaveAfterDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '匯入失敗');
    } finally {
      setRestoring(false);
    }
  }

  function handleDeleteAllOpenChange(open: boolean) {
    setDeleteAllOpen(open);
    if (!open) setDeleteConfirmText('');
  }

  /**
   * 只清空這台裝置的資料,不寫墓碑,所以不會把刪除同步到 Google Drive 或其他裝置;
   * 既有墓碑保留,避免無聲撤銷使用者先前單獨做過、但還沒同步出去的刪除。
   */
  function handleDeleteAll() {
    useCharacterStore.setState({ characters: [], activeCharacterId: null });
    useTaskStore.setState({ tasks: [] });
    useBossStore.setState({ bosses: [] });
    useAccountStore.setState({ accounts: [] });
    // 必須放在所有清空動作之後:上面每次清空都會經由 trackLocalChange 寫入 lastLocalChangeAt,要在最後一併重設
    useSettingsStore.setState({ lastBackupAt: undefined, lastLocalChangeAt: undefined });
    setDeleteAllOpen(false);
    setDeleteConfirmText('');
    toast.success('已刪除這台裝置上的全部紀錄');
    leaveAfterDataChange();
  }

  function handleClearDriveOpenChange(open: boolean) {
    setClearDriveOpen(open);
    if (!open) setClearDriveConfirmText('');
  }

  async function handleClearDrive() {
    setClearingDrive(true);
    try {
      await clearDriveBackups();
      setAvailability({ latest: false });
      handleClearDriveOpenChange(false);
      toast.success('已清空 Google Drive 上的備份');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '清空 Google Drive 備份失敗');
    } finally {
      setClearingDrive(false);
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 sm:max-w-3xl sm:px-6 sm:pt-10">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-4 left-2 gap-1 text-muted-foreground sm:left-4"
        onClick={handleBack}
      >
        <ArrowLeft className="size-3.5" />
        返回
      </Button>

      <div className="space-y-2 pt-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Cloud className="size-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">備份與同步</h2>
        <p className="text-sm text-muted-foreground">把帳號、角色、任務、BOSS 紀錄備份成檔案或與 Google Drive 同步，換裝置或清除瀏覽器資料後可以再匯入。</p>
        <p className="text-xs text-muted-foreground">
          匯入與同步都是與雲端資料整理後合併，不會整份覆蓋：兩邊都有的紀錄將會保留較新的版本，已在這台裝置刪除的紀錄不會被加回來。
        </p>
        <span
          className={cn(
            'mx-auto inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            neverBackedUp || hasUnsavedChanges
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          )}
        >
          {neverBackedUp || hasUnsavedChanges ? (
            <AlertTriangle className="size-3.5 shrink-0" />
          ) : (
            <CloudUpload className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 truncate">
            {neverBackedUp
              ? '尚未備份角色資料'
              : hasUnsavedChanges
                ? `有異動尚未備份・上次備份於 ${format(new Date(lastBackupAt!), 'yyyy/MM/dd HH:mm')}`
                : `資料已備份・上次備份於 ${format(new Date(lastBackupAt!), 'yyyy/MM/dd HH:mm')}`}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="flex flex-col gap-3 sm:flex-1">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">本機備份檔案</h3>
            <p className="text-xs text-muted-foreground">直接匯出/匯入檔案儲存在本機上，不需要登入 Google。</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!hasAnyData}
              onClick={handleDownloadToComputer}
            >
              <Download className="size-4" />
              下載備份檔案到電腦
            </Button>
            {!hasAnyData && <p className="text-xs text-muted-foreground">目前沒有可備份的資料</p>}
            <Button type="button" variant="outline" className="gap-2" disabled={importing} onClick={handleChooseFile}>
              <Upload className="size-4" />
              {importing ? '匯入中…' : '從檔案匯入'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
        </div>

        <Separator className="sm:hidden" />
        <Separator orientation="vertical" className="hidden sm:block" />

        <div className="flex flex-col gap-3 sm:flex-1">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">Google Drive 備份</h3>
            <p className="text-xs text-muted-foreground">
              與你的 Google Drive 資料同步。同步時會先將此裝置的資料合併雲端上的資料後再上傳。
            </p>
            {signedIn && email && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  {email}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  disabled={signingOut}
                  onClick={handleSignOut}
                >
                  <LogOut className="size-3.5" />
                  切換帳號
                </Button>
              </div>
            )}
          </div>

          {!signedIn ? (
            <Button type="button" className="gap-2" disabled={signingIn} onClick={handleSignIn}>
              <LogIn className="size-4" />
              {signingIn ? '登入中…' : '登入 Google'}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button type="button" className="gap-2" disabled={backingUp || !canSync} onClick={handleSync}>
                {backingUp ? <Spinner className="size-4" /> : <Cloud className="size-4" />}
                {backingUp ? '同步中…' : '與 Google Drive 同步'}
              </Button>
              {!canSync && (
                <p className="text-xs text-muted-foreground">
                  這台裝置目前沒有資料，要取得雲端資料請使用「從 Google Drive 中匯入」。
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!availability?.latest || restoring}
                onClick={handleRestore}
              >
                <RotateCcw className="size-4" />
                {restoring ? '匯入中…' : '從 Google Drive 中匯入'}
              </Button>
              {availability && !availability.latest && (
                <p className="text-xs text-muted-foreground">Google Drive 中尚未有備份紀錄</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-destructive">清除紀錄</h3>
          <p className="text-xs text-muted-foreground">
            {'刪除這台裝置上所有帳號、角色、任務與 BOSS 紀錄，此動作無法復原。Google Drive 上的備份不受影響，' +
              '之後同步或匯入時，雲端上的資料會再合併回這台裝置。如果想讓所有裝置一起重新開始，' +
              '請先清空 Google Drive 備份，並在其他裝置上也刪除全部紀錄。'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!hasAnyData}
          onClick={() => setDeleteAllOpen(true)}
        >
          <Trash2 className="size-4" />
          刪除全部紀錄
        </Button>
        {!hasAnyData && <p className="text-xs text-muted-foreground">目前沒有任何紀錄可刪除</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-destructive">清空 Google Drive 備份</h3>
          <p className="text-xs text-muted-foreground">
            永久刪除 Google Drive 上保存的所有備份(包含刪除紀錄)，此動作無法復原。這台裝置與其他裝置上的資料不受影響。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!signedIn || !availability?.latest}
          onClick={() => setClearDriveOpen(true)}
        >
          <Trash2 className="size-4" />
          清空 Google Drive 備份
        </Button>
        {!signedIn ? (
          <p className="text-xs text-muted-foreground">需要先登入 Google 才能清空雲端備份</p>
        ) : (
          availability &&
          !availability.latest && <p className="text-xs text-muted-foreground">Google Drive 中沒有備份可清空</p>
        )}
      </div>

      <AlertDialog open={deleteAllOpen} onOpenChange={handleDeleteAllOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這台裝置上的全部紀錄?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作會刪除這台裝置上所有帳號、角色、任務與 BOSS 進度紀錄,且無法復原。Google Drive 上的備份不會被刪除，之後同步或匯入時雲端資料會重新合併回來。請在下方輸入「{DELETE_ALL_CONFIRM_TEXT}」以確認。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={`請輸入「${DELETE_ALL_CONFIRM_TEXT}」`}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConfirmText !== DELETE_ALL_CONFIRM_TEXT}
              onClick={handleDeleteAll}
            >
              刪除全部紀錄
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearDriveOpen} onOpenChange={handleClearDriveOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空 Google Drive 上的備份?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作會永久刪除{email ? ` ${email} 的` : ''} Google Drive 上保存的所有備份與刪除紀錄，且無法復原。各裝置上的資料不會被刪除，之後任何一台裝置同步時會重新建立備份。請在下方輸入「{CLEAR_GOOGLE_DRIVE_TEXT}」以確認。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={clearDriveConfirmText}
            onChange={(e) => setClearDriveConfirmText(e.target.value)}
            placeholder={`請輸入「${CLEAR_GOOGLE_DRIVE_TEXT}」`}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingDrive}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearDriveConfirmText !== CLEAR_GOOGLE_DRIVE_TEXT || clearingDrive}
              onClick={(e) => {
                // 刪除是非同步的,阻止 AlertDialogAction 預設的立即關閉,等刪除完成後再由 handleClearDrive 關閉
                e.preventDefault();
                void handleClearDrive();
              }}
            >
              {clearingDrive ? '清空中…' : '清空 Google Drive 備份'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {staleConfirmDialog}
    </div>
  );
}

export default DataManagementPage;
