import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as googleDrive from '@/lib/googleDrive';
import { applyRestoredPayload, backupNow, fetchLatestBackup } from '@/lib/googleDriveBackup';
import type { DriveBackupPayload } from '@/lib/backupPayload';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useBossStore } from '@/store/useBossStore';
import { useSettingsStore } from '@/store/useSettingsStore';

vi.mock('@/lib/googleDrive', () => ({
  findFileId: vi.fn(),
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
}));

const remoteTask = {
  id: 'remote-1',
  characterId: 'c1',
  name: '遠端任務',
  category: '日常',
  resetCycle: 'daily' as const,
  checked: false,
  lastResetAt: '2026-01-01T00:00:00.000Z',
  order: 0,
};

const localTask = {
  id: 'local-1',
  characterId: 'c1',
  name: '本機任務',
  category: '日常',
  resetCycle: 'daily' as const,
  checked: false,
  lastResetAt: '2026-01-01T00:00:00.000Z',
  order: 0,
};

describe('backupNow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
    useTaskStore.setState({ tasks: [], deletedIds: [] });
    useBossStore.setState({ bosses: [], deletedIds: [] });
    useSettingsStore.setState({ lastBackupAt: undefined, lastLocalChangeAt: undefined });
  });

  it('上傳前先合併 Drive 現有內容,本機與遠端的新增互相疊加後才上傳', async () => {
    useTaskStore.setState({ tasks: [localTask], deletedIds: [] });

    vi.mocked(googleDrive.findFileId).mockResolvedValue('file-1');
    vi.mocked(googleDrive.downloadFile).mockResolvedValue(
      JSON.stringify({
        version: 4,
        createdAt: '2026-01-01T00:00:00.000Z',
        characters: [],
        characterTombstones: [],
        tasks: [remoteTask],
        taskTombstones: [],
        bosses: [],
        bossTombstones: [],
      }),
    );
    vi.mocked(googleDrive.uploadFile).mockResolvedValue(undefined);

    await backupNow();

    expect(
      useTaskStore
        .getState()
        .tasks.map((t) => t.id)
        .sort(),
    ).toEqual(['local-1', 'remote-1']);

    const latestUpload = vi
      .mocked(googleDrive.uploadFile)
      .mock.calls.find(([name]) => name === 'backup-latest.json');
    expect(latestUpload).toBeDefined();
    const uploadedPayload = JSON.parse(latestUpload![1]);
    expect(uploadedPayload.tasks.map((t: { id: string }) => t.id).sort()).toEqual(['local-1', 'remote-1']);
    expect(useSettingsStore.getState().lastBackupAt).toBeDefined();
  });

  it('第一次備份(Drive 上還沒有任何檔案)時不會嘗試下載,直接上傳本機快照', async () => {
    vi.mocked(googleDrive.findFileId).mockResolvedValue(undefined);
    vi.mocked(googleDrive.uploadFile).mockResolvedValue(undefined);

    await backupNow();

    expect(googleDrive.downloadFile).not.toHaveBeenCalled();
    expect(googleDrive.uploadFile).toHaveBeenCalledWith('backup-latest.json', expect.any(String));
  });

  it('下載 Drive 現有備份失敗時中止,不會上傳任何內容', async () => {
    vi.mocked(googleDrive.findFileId).mockResolvedValue('file-1');
    vi.mocked(googleDrive.downloadFile).mockRejectedValue(new Error('network error'));

    await expect(backupNow()).rejects.toThrow('network error');
    expect(googleDrive.uploadFile).not.toHaveBeenCalled();
  });

  it('上傳失敗時中止,不能誤判成備份成功而更新 lastBackupAt', async () => {
    vi.mocked(googleDrive.findFileId).mockResolvedValue(undefined);
    vi.mocked(googleDrive.uploadFile).mockRejectedValue(new Error('upload error'));

    await expect(backupNow()).rejects.toThrow('upload error');
    expect(useSettingsStore.getState().lastBackupAt).toBeUndefined();
  });
});

function emptyPayload(overrides: Partial<DriveBackupPayload> = {}): DriveBackupPayload {
  return {
    version: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    characters: [],
    characterTombstones: [],
    tasks: [],
    taskTombstones: [],
    bosses: [],
    bossTombstones: [],
    ...overrides,
  };
}

describe('fetchLatestBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('下載並解析 Drive 上最新的備份內容,不做任何合併', async () => {
    vi.mocked(googleDrive.findFileId).mockResolvedValue('file-1');
    vi.mocked(googleDrive.downloadFile).mockResolvedValue(JSON.stringify(emptyPayload({ tasks: [remoteTask] })));

    const payload = await fetchLatestBackup();

    expect(payload.tasks).toEqual([remoteTask]);
    expect(useTaskStore.getState().tasks).toEqual([]);
  });

  it('Drive 上還沒有備份紀錄時丟出錯誤', async () => {
    vi.mocked(googleDrive.findFileId).mockResolvedValue(undefined);
    await expect(fetchLatestBackup()).rejects.toThrow('尚未有備份紀錄');
  });
});

describe('applyRestoredPayload', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
    useTaskStore.setState({ tasks: [], deletedIds: [] });
    useBossStore.setState({ bosses: [], deletedIds: [] });
    useSettingsStore.setState({ lastBackupAt: undefined, lastLocalChangeAt: undefined });
  });

  it('合併備份內容進本機 store,本機沒有尚未備份的異動時更新 lastBackupAt', () => {
    const result = applyRestoredPayload(emptyPayload({ tasks: [remoteTask] }));

    expect(result.addedTasks).toBe(1);
    expect(useTaskStore.getState().tasks).toEqual([remoteTask]);
    expect(useSettingsStore.getState().lastBackupAt).toBeDefined();
  });

  it('本機本來就有尚未備份的異動時,還原後不更新 lastBackupAt,避免蓋掉那筆異動', () => {
    useSettingsStore.setState({
      lastBackupAt: '2026-01-01T00:00:00.000Z',
      lastLocalChangeAt: '2026-01-02T00:00:00.000Z',
    });

    applyRestoredPayload(emptyPayload());

    expect(useSettingsStore.getState().lastBackupAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
