import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, Cloud, CloudUpload, Download, LogIn, LogOut, RotateCcw, Trash2, Upload, UserRound } from 'lucide-react';
import { toast } from 'sonner';
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
import { backupNow, checkBackupAvailability, restoreFromLatest, type BackupAvailability } from '@/lib/googleDriveBackup';
import { buildCurrentBackupPayloadJson, parseBackupPayload } from '@/lib/backupPayload';
import { mergeBackupPayload } from '@/lib/backupMerge';
import { useBackupStatus } from '@/hooks/useBackupStatus';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';

const DELETE_ALL_CONFIRM_TEXT = '刪除';

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

/** 資料管理頁面:本機/Google Drive 備份與還原、清除全部紀錄,取代主畫面內容顯示(非對話框),由 App.tsx 動態載入 */
export function DataManagementPage({ onBack }: { onBack: () => void }) {
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
  const [backupEmptyConfirmOpen, setBackupEmptyConfirmOpen] = useState(false);
  const { lastBackupAt, neverBackedUp, hasUnsavedChanges } = useBackupStatus();

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
      const result = mergeBackupPayload(payload);
      toast.success(
        `已匯入:新增 ${result.addedCharacters} 個角色、${result.addedTasks} 筆任務、${result.addedBosses} 筆 BOSS 紀錄`,
      );
      onBack();
    } catch {
      toast.error('檔案格式錯誤，匯入失敗');
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

  function isAllDataEmpty() {
    return (
      useCharacterStore.getState().characters.length === 0 &&
      useTaskStore.getState().tasks.length === 0 &&
      useBossStore.getState().bosses.length === 0
    );
  }

  async function performBackup() {
    setBackingUp(true);
    try {
      await backupNow();
      toast.success('備份成功');
      setAvailability(await checkBackupAvailability());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '備份失敗');
    } finally {
      setBackingUp(false);
    }
  }

  function handleBackupNow() {
    if (isAllDataEmpty()) {
      setBackupEmptyConfirmOpen(true);
      return;
    }
    performBackup();
  }

  function handleConfirmBackupEmpty() {
    setBackupEmptyConfirmOpen(false);
    performBackup();
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const result = await restoreFromLatest();
      toast.success(
        `已還原：新增 ${result.addedCharacters} 個角色、${result.addedTasks} 筆任務、${result.addedBosses} 筆 BOSS 紀錄`,
      );
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '還原失敗');
    } finally {
      setRestoring(false);
    }
  }

  function handleDeleteAllOpenChange(open: boolean) {
    setDeleteAllOpen(open);
    if (!open) setDeleteConfirmText('');
  }

  function handleDeleteAll() {
    useCharacterStore.setState({ characters: [], activeCharacterId: null });
    useTaskStore.setState({ tasks: [] });
    useBossStore.setState({ bosses: [] });
    setDeleteAllOpen(false);
    setDeleteConfirmText('');
    toast.success('已刪除全部角色紀錄');
    onBack();
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 sm:max-w-3xl sm:px-6 sm:pt-10">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-4 left-2 gap-1 text-muted-foreground sm:left-4"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5" />
        返回
      </Button>

      <div className="space-y-2 pt-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Cloud className="size-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">備份與還原</h2>
        <p className="text-sm text-muted-foreground">把角色、任務、BOSS 紀錄備份成檔案或上傳至雲端硬碟中，換裝置或清除瀏覽器資料後也能還原。</p>
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
            <Button type="button" variant="outline" className="gap-2" onClick={handleDownloadToComputer}>
              <Download className="size-4" />
              下載備份檔案到電腦
            </Button>
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
            <p className="text-xs text-muted-foreground">備份到你自己的 Google Drive，適合跨裝置同步。</p>
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
              <Button type="button" className="gap-2" disabled={backingUp} onClick={handleBackupNow}>
                {backingUp ? <Spinner className="size-4" /> : <Cloud className="size-4" />}
                {backingUp ? '備份中…' : '立即備份'}
              </Button>

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
            刪除本機所有角色、任務與 BOSS 紀錄,此動作無法復原,建議刪除前先備份。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteAllOpen(true)}
        >
          <Trash2 className="size-4" />
          刪除全部紀錄
        </Button>
      </div>

      <AlertDialog open={deleteAllOpen} onOpenChange={handleDeleteAllOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除全部角色紀錄?</AlertDialogTitle>
            <AlertDialogDescription>
              此動作會刪除本機所有角色、任務與 BOSS 進度紀錄,且無法復原。請在下方輸入「{DELETE_ALL_CONFIRM_TEXT}」以確認。
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

      <AlertDialog open={backupEmptyConfirmOpen} onOpenChange={setBackupEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>目前沒有任何角色資料</AlertDialogTitle>
            <AlertDialogDescription>
              目前沒有角色、任務或 BOSS 紀錄，確定要用這份空白資料覆蓋 Google Drive 上原本的備份嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBackupEmpty}>仍要備份</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DataManagementPage;
