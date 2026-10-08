import { format } from 'date-fns';
import { AuthError } from '@/lib/auth/authClient';
import { isQuotaError } from '@/lib/quotaError';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import type { OverwriteImpact } from '@/lib/sync/snapshotSummary';
import type { RestoreSourceInfo, RestoreSourceKind } from '@/lib/sync/syncController';
import type { AppliedChanges } from '@/lib/sync/syncEngine';
import type { SyncStatus } from '@/lib/sync/syncScheduler';

/** 狀態顯示的色調：正常、進行中、警告（會自動重試）、需要使用者處理 */
export type StatusTone = 'ok' | 'busy' | 'warn' | 'error';

/** 同步狀態在畫面上的呈現 */
export interface SyncStatusView {
  label: string;
  tone: StatusTone;
  /** 這個狀態下提供的按鈕：立即同步或重新連線 */
  action?: 'syncNow' | 'reconnect';
}

/**
 * 把 ISO 時間格式化成 `MM/dd HH:mm`（使用者所在時區）。
 * @param iso ISO 8601 時間字串
 * @returns 格式化結果；無法解析時回傳 undefined
 */
export function formatDateTime(iso: string): string | undefined {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : format(new Date(ms), 'MM/dd HH:mm');
}

/**
 * 「已同步 · 2 分鐘前」的相對時間。
 * @param at 上次成功同步的時間
 * @param now 現在時間
 * @returns 剛剛、N 分鐘前、N 小時前，超過一天顯示日期時間
 */
export function formatSyncedAgo(at: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(at)) / 60_000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} 小時前`;
  return formatDateTime(at) ?? '';
}

/**
 * 同步狀態的顯示文字（只在已登入時顯示）。還沒收到第一個狀態時視為同步中。
 * @param status 排程器回報的狀態
 * @param lastSyncedAt 上次成功同步時間
 * @param now 現在時間
 */
export function describeSyncStatus(status: SyncStatus | undefined, lastSyncedAt: string | undefined, now: Date): SyncStatusView {
  switch (status?.kind) {
    case undefined:
    case 'syncing':
      return { label: '同步中…', tone: 'busy' };
    case 'synced':
      return {
        label: lastSyncedAt ? `已同步 · ${formatSyncedAgo(lastSyncedAt, now)}` : '已同步',
        tone: 'ok',
        action: 'syncNow',
      };
    case 'pending':
      return { label: '有修改待同步', tone: 'busy' };
    case 'offline':
      return { label: '離線', tone: 'warn', action: 'syncNow' };
    case 'reconnectRequired':
      return { label: '需要重新連線', tone: 'error', action: 'reconnect' };
    case 'blocked':
      return { label: '已暫停同步', tone: 'error' };
  }
}

const SOURCE_NAMES: Record<RestoreSourceKind, string> = {
  file: '備份檔案',
  localRestorePoint: '還原點',
  cloudRestorePoint: '還原點',
  dailySnapshot: '每日快照',
};

/**
 * 還原來源種類的名稱。
 * @param kind 來源種類
 * @returns 備份檔案、還原點或每日快照
 */
export function restoreSourceName(kind: RestoreSourceKind): string {
  return SOURCE_NAMES[kind];
}

/**
 * 還原來源的名稱，例如「10/05 08:00 的每日快照」。
 * @param source 來源種類與存檔時間
 */
export function describeRestoreSource(source: RestoreSourceInfo): string {
  const name = restoreSourceName(source.kind);
  const time = formatDateTime(source.savedAt);
  return time ? `${time} 的${name}` : name;
}

/** 影響說明最多列出幾個角色名稱 */
const NAME_LIMIT = 3;

function characterList(names: string[]): string {
  const quoted = names
    .slice(0, NAME_LIMIT)
    .map((name) => `「${name}」`)
    .join('');
  return names.length > NAME_LIMIT ? `${quoted}等 ${names.length} 個角色` : quoted;
}

/** describeOverwriteEffect 的句子參數 */
export interface OverwriteEffectOptions {
  /** 被取代的一方，例如「這台裝置」「雲端」；省略時句子直接從「會」開始 */
  subject?: string;
  /** 取代進來的版本，例如「雲端」「這台裝置」「每日快照」 */
  version: string;
  /** 取代後多出來的角色用什麼動詞；還原時用「找回」 */
  addedVerb?: '加入' | '找回';
  /** 是否另外提醒「較新的進度會被蓋掉」；還原本來就是要回到舊的狀態，傳 false */
  warnNewer?: boolean;
}

/**
 * 選項卡上「選了之後會發生什麼」的句子，依序寫出失去、加入的角色，進度會改變的角色，以及較新進度會被蓋掉的角色。
 * @param impact describeOverwrite 的結果
 * @param options 主詞、取代進來的版本、動詞與是否提醒較新的進度
 * @returns 例如「這台裝置會加入「阿月」；「白砂」在這台裝置的進度會改成雲端的狀態」
 */
export function describeOverwriteEffect(impact: OverwriteImpact, options: OverwriteEffectOptions): string {
  const { subject = '', version, addedVerb = '加入', warnNewer = true } = options;
  const where = subject ? `在${subject}` : '';
  const clauses: string[] = [];

  const characters: string[] = [];
  if (impact.removedCharacterNames.length > 0) characters.push(`失去${characterList(impact.removedCharacterNames)}`);
  if (impact.addedCharacterNames.length > 0) characters.push(`${addedVerb}${characterList(impact.addedCharacterNames)}`);
  if (characters.length > 0) clauses.push(`${subject}會${characters.join('、')}`);

  const newer = warnNewer ? impact.newerCharacterNames : [];
  const changed = impact.changedCharacterNames.filter((name) => !newer.includes(name));
  if (changed.length > 0) clauses.push(`${characterList(changed)}${where}的進度會改成${version}的狀態`);
  if (newer.length > 0) clauses.push(`${characterList(newer)}${where}有較新的進度，會被${version}的狀態蓋掉`);

  if (impact.accountsChanged) clauses.push(`${clauses.length === 0 && subject ? `${subject}的` : ''}帳號設定會改成${version}的狀態`);
  return clauses.length > 0 ? clauses.join('；') : `${subject}不會有任何變更`;
}

/**
 * 從雲端合併進本機後顯示的提示。空裝置登入載入雲端資料、其他裝置修改後同步過來，都用同一句開頭。
 * @param changes 這輪套用的變更（以角色為單位）
 * @returns 例如「已從雲端同步：新增「阿月」；「白砂」的進度已更新」
 */
export function describeAppliedChanges(changes: AppliedChanges): string {
  const clauses: string[] = [];
  const characters: string[] = [];
  if (changes.addedCharacterNames.length > 0) characters.push(`新增${characterList(changes.addedCharacterNames)}`);
  if (changes.removedCharacterNames.length > 0) characters.push(`移除${characterList(changes.removedCharacterNames)}`);
  if (characters.length > 0) clauses.push(characters.join('、'));
  if (changes.changedCharacterNames.length > 0) clauses.push(`${characterList(changes.changedCharacterNames)}的進度已更新`);
  if (changes.accountsChanged) clauses.push('帳號設定已更新');
  return clauses.length > 0 ? `已從雲端同步：${clauses.join('；')}` : '已從雲端同步';
}

/**
 * 把登入、同步過程的錯誤轉成給使用者看的訊息。
 * @param error 捕捉到的錯誤
 * @returns 訊息；使用者自己關閉登入視窗時回傳 undefined（不需要提示）
 */
export function describeSyncError(error: unknown): string | undefined {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'popupClosed':
        return undefined;
      case 'popupBlocked':
        return '瀏覽器擋住了 Google 登入視窗，請允許彈出視窗後再試一次';
      case 'missingDriveScope':
        return '請在 Google 登入畫面勾選 Google 雲端硬碟的權限，才能同步資料';
      case 'signedOut':
      case 'reconnectRequired':
        return 'Google 登入已失效，請重新登入';
      case 'network':
        return '無法連線，請確認網路後再試一次';
      case 'server':
        return '登入服務暫時無法使用，請稍後再試';
    }
  }
  if (error instanceof CloudError) return '無法連線到 Google 雲端硬碟，請稍後再試';
  if (isQuotaError(error)) return '瀏覽器儲存空間不足，無法建立還原點，請先下載備份檔案';
  console.error('[sync] unexpected error', error);
  return '發生未預期的錯誤，請稍後再試';
}
