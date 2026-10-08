import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { AuthError } from '@/lib/auth/authClient';
import { CloudError } from '@/lib/sync/cloud/cloudStore';
import type { OverwriteImpact } from '@/lib/sync/snapshotSummary';
import {
  describeAppliedChanges,
  describeOverwriteEffect,
  describeRestoreSource,
  describeSyncError,
  describeSyncStatus,
  formatDateTime,
  formatSyncedAgo,
  restoreSourceName,
} from '@/lib/sync/syncText';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();
const impact = (overrides: Partial<OverwriteImpact>): OverwriteImpact => ({
  addedCharacterNames: [],
  removedCharacterNames: [],
  changedCharacterNames: [],
  newerCharacterNames: [],
  accountsChanged: false,
  ...overrides,
});

describe('formatSyncedAgo / formatDateTime', () => {
  it('一分鐘內為剛剛，一小時內為分鐘，一天內為小時，更久顯示日期時間', () => {
    expect(formatSyncedAgo(minutesAgo(0), NOW)).toBe('剛剛');
    expect(formatSyncedAgo(minutesAgo(2), NOW)).toBe('2 分鐘前');
    expect(formatSyncedAgo(minutesAgo(125), NOW)).toBe('2 小時前');
    expect(formatSyncedAgo(minutesAgo(3 * 24 * 60), NOW)).toBe(format(new Date(minutesAgo(3 * 24 * 60)), 'MM/dd HH:mm'));
  });

  it('無法解析的時間回傳 undefined', () => {
    expect(formatDateTime('not a date')).toBeUndefined();
  });
});

describe('describeSyncStatus', () => {
  it('依狀態回傳文字、色調與可用動作', () => {
    expect(describeSyncStatus({ kind: 'synced' }, minutesAgo(2), NOW)).toEqual({
      label: '已同步 · 2 分鐘前',
      tone: 'ok',
      action: 'syncNow',
    });
    expect(describeSyncStatus({ kind: 'synced' }, undefined, NOW).label).toBe('已同步');
    expect(describeSyncStatus(undefined, undefined, NOW)).toEqual({ label: '同步中…', tone: 'busy' });
    expect(describeSyncStatus({ kind: 'syncing' }, undefined, NOW)).toEqual({ label: '同步中…', tone: 'busy' });
    expect(describeSyncStatus({ kind: 'pending' }, undefined, NOW)).toEqual({ label: '有修改待同步', tone: 'busy' });
    expect(describeSyncStatus({ kind: 'offline' }, undefined, NOW)).toEqual({ label: '離線', tone: 'warn', action: 'syncNow' });
    expect(describeSyncStatus({ kind: 'reconnectRequired' }, undefined, NOW)).toEqual({
      label: '需要重新連線',
      tone: 'error',
      action: 'reconnect',
    });
    expect(describeSyncStatus({ kind: 'blocked', reason: 'resetDetected' }, undefined, NOW)).toEqual({
      label: '已暫停同步',
      tone: 'error',
    });
  });
});

describe('describeRestoreSource', () => {
  it('來源名稱前面加上存檔時間；沒有時間時只顯示名稱', () => {
    const savedAt = '2026-10-05T00:00:00.000Z';
    const time = format(new Date(savedAt), 'MM/dd HH:mm');
    expect(describeRestoreSource({ kind: 'file', savedAt })).toBe(`${time} 的備份檔案`);
    expect(describeRestoreSource({ kind: 'cloudRestorePoint', savedAt })).toBe(`${time} 的還原點`);
    expect(describeRestoreSource({ kind: 'localRestorePoint', savedAt })).toBe(`${time} 的還原點`);
    expect(describeRestoreSource({ kind: 'dailySnapshot', savedAt })).toBe(`${time} 的每日快照`);
    expect(describeRestoreSource({ kind: 'file', savedAt: '' })).toBe('備份檔案');
    expect(restoreSourceName('dailySnapshot')).toBe('每日快照');
  });
});

describe('describeOverwriteEffect', () => {
  const full = impact({
    removedCharacterNames: ['白砂'],
    addedCharacterNames: ['阿月'],
    changedCharacterNames: ['小黑', '小白'],
    newerCharacterNames: ['小白'],
  });

  it('依序寫出失去、加入的角色，再寫進度會改變與較新會被蓋掉的角色', () => {
    expect(describeOverwriteEffect(full, { subject: '這台裝置', version: '雲端' })).toBe(
      '這台裝置會失去「白砂」、加入「阿月」；「小黑」在這台裝置的進度會改成雲端的狀態；「小白」在這台裝置有較新的進度，會被雲端的狀態蓋掉',
    );
  });

  it('還原時用「找回」，且不提醒較新的進度', () => {
    expect(describeOverwriteEffect(full, { version: '每日快照', addedVerb: '找回', warnNewer: false })).toBe(
      '會失去「白砂」、找回「阿月」；「小黑」「小白」的進度會改成每日快照的狀態',
    );
  });

  it('超過 3 個角色時只列前 3 個並寫出總數', () => {
    const many = impact({ removedCharacterNames: ['甲', '乙', '丙', '丁'] });
    expect(describeOverwriteEffect(many, { subject: '雲端', version: '這台裝置' })).toBe('雲端會失去「甲」「乙」「丙」等 4 個角色');
  });

  it('只有進度或帳號設定不同時直接寫出；沒有變動時明說', () => {
    expect(describeOverwriteEffect(impact({ changedCharacterNames: ['白砂'] }), { subject: '這台裝置', version: '雲端' })).toBe(
      '「白砂」在這台裝置的進度會改成雲端的狀態',
    );
    expect(describeOverwriteEffect(impact({ accountsChanged: true }), { subject: '這台裝置', version: '雲端' })).toBe(
      '這台裝置的帳號設定會改成雲端的狀態',
    );
    expect(describeOverwriteEffect(impact({}), { subject: '這台裝置', version: '雲端' })).toBe('這台裝置不會有任何變更');
  });
});

describe('describeAppliedChanges', () => {
  const base = { addedCharacterNames: [], removedCharacterNames: [], changedCharacterNames: [], accountsChanged: false };

  it('依序寫出新增、移除的角色，以及進度更新的角色', () => {
    expect(
      describeAppliedChanges({ ...base, addedCharacterNames: ['阿月'], removedCharacterNames: ['小黑'], changedCharacterNames: ['白砂'] }),
    ).toBe('已從雲端同步：新增「阿月」、移除「小黑」；「白砂」的進度已更新');
    expect(describeAppliedChanges({ ...base, addedCharacterNames: ['甲', '乙', '丙', '丁'] })).toBe('已從雲端同步：新增「甲」「乙」「丙」等 4 個角色');
  });

  it('只有帳號設定不同時寫帳號設定', () => {
    expect(describeAppliedChanges({ ...base, accountsChanged: true })).toBe('已從雲端同步：帳號設定已更新');
  });
});

describe('describeSyncError', () => {
  it('使用者自己關閉登入視窗時不顯示提示，其他錯誤轉成中文說明', () => {
    expect(describeSyncError(new AuthError('popupClosed', 'x'))).toBeUndefined();
    expect(describeSyncError(new AuthError('popupBlocked', 'x'))).toBe('瀏覽器擋住了 Google 登入視窗，請允許彈出視窗後再試一次');
    expect(describeSyncError(new AuthError('missingDriveScope', 'x'))).toBe(
      '請在 Google 登入畫面勾選 Google 雲端硬碟的權限，才能同步資料',
    );
    expect(describeSyncError(new AuthError('network', 'x'))).toBe('無法連線，請確認網路後再試一次');
    expect(describeSyncError(new CloudError('network', 'x'))).toBe('無法連線到 Google 雲端硬碟，請稍後再試');
    expect(describeSyncError(new Error('boom'))).toBe('發生未預期的錯誤，請稍後再試');
  });

  it('瀏覽器儲存空間不足時提示先下載備份檔案', () => {
    expect(describeSyncError(new DOMException('full', 'QuotaExceededError'))).toBe('瀏覽器儲存空間不足，無法建立還原點，請先下載備份檔案');
  });
});
