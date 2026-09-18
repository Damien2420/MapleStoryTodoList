import { describe, expect, it } from 'vitest';
import { buildBackupPayload, CURRENT_VERSION, migrateToLatest, parseBackupPayload } from '@/lib/backupPayload';

describe('buildBackupPayload', () => {
  it('組出的 payload 帶有目前版本號與三份墓碑清單', () => {
    const payload = buildBackupPayload({
      characters: [],
      characterTombstones: [{ id: 'c1', deletedAt: '2026-01-01T00:00:00.000Z' }],
      tasks: [],
      taskTombstones: [],
      bosses: [],
      bossTombstones: [],
      accounts: [],
      accountTombstones: [],
    });
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.characterTombstones).toEqual([{ id: 'c1', deletedAt: '2026-01-01T00:00:00.000Z' }]);
  });
});

describe('parseBackupPayload migration v3 -> v4', () => {
  it('舊版 v3 備份(沒有墓碑欄位)升版後三份墓碑清單皆為空陣列', () => {
    const v3Json = JSON.stringify({
      version: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [{ id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' }],
      tasks: [],
      bosses: [],
    });
    const payload = parseBackupPayload(v3Json);
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.characterTombstones).toEqual([]);
    expect(payload.taskTombstones).toEqual([]);
    expect(payload.bossTombstones).toEqual([]);
    expect(payload.characters).toHaveLength(1);
  });

  it('v1 舊備份可以一路升版到最新版本', () => {
    const v1Json = JSON.stringify({
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [{ id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0 }],
      tasks: [],
      bosses: [],
    });
    const payload = parseBackupPayload(v1Json);
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.characters[0].source).toBe('manual');
    expect(payload.characterTombstones).toEqual([]);
  });

  it('v1 舊備份帶 BOSS 資料時,完整走過 v1->v5 每一步遷移:補上 partySize、拿掉 order、其餘欄位不變', () => {
    const v1Json = JSON.stringify({
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [],
      tasks: [],
      bosses: [
        {
          id: 'b1',
          characterId: 'c1',
          bossName: 'testBoss',
          difficulty: '簡單',
          resetCycle: 'weekly',
          crystalValue: 100,
          checked: false,
          lastResetAt: '2026-01-01T00:00:00.000Z',
          order: 3,
        },
      ],
    });
    const payload = parseBackupPayload(v1Json);
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.bosses).toHaveLength(1);
    expect(payload.bosses[0]).not.toHaveProperty('order');
    expect(payload.bosses[0]).toMatchObject({
      id: 'b1',
      characterId: 'c1',
      bossName: 'testBoss',
      difficulty: '簡單',
      resetCycle: 'weekly',
      crystalValue: 100,
      partySize: 1,
      checked: false,
      lastResetAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('parseBackupPayload migration v4 -> v5', () => {
  it('舊版 v4 備份的 bosses 有 order 欄位,升版後被移除', () => {
    const v4Json = JSON.stringify({
      version: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [],
      characterTombstones: [],
      tasks: [],
      taskTombstones: [],
      bosses: [
        {
          id: 'b1',
          characterId: 'c1',
          bossName: 'testBoss',
          difficulty: '簡單',
          resetCycle: 'weekly',
          crystalValue: 100,
          partySize: 1,
          checked: false,
          lastResetAt: '2026-01-01T00:00:00.000Z',
          order: 0,
        },
      ],
      bossTombstones: [],
    });
    const payload = parseBackupPayload(v4Json);
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.bosses[0]).not.toHaveProperty('order');
  });
});

describe('parseBackupPayload migration v5 -> v6', () => {
  it('舊版 v5 備份(沒有帳號欄位)升版後帳號與帳號墓碑皆為空陣列,其餘資料不受影響', () => {
    const v5Json = JSON.stringify({
      version: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      characters: [{ id: 'c1', name: 'A', server: '艾麗亞', level: 1, job: 'Warrior', order: 0, source: 'manual' }],
      characterTombstones: [],
      tasks: [],
      taskTombstones: [],
      bosses: [],
      bossTombstones: [],
    });
    const payload = parseBackupPayload(v5Json);
    expect(payload.version).toBe(CURRENT_VERSION);
    expect(payload.accounts).toEqual([]);
    expect(payload.accountTombstones).toEqual([]);
    expect(payload.characters).toHaveLength(1);
  });
});

describe('migrateToLatest 錯誤分支', () => {
  it('版本號比目前支援的最新版還新時,中止並丟出錯誤,不能誤把未來版本的欄位當現有版本解析', () => {
    expect(() => migrateToLatest({ version: CURRENT_VERSION + 1 })).toThrow(
      '此備份由較新版本的 app 建立,請更新 app 後再還原',
    );
  });

  it('版本號沒有對應的 migration 函式時,中止並丟出錯誤,不能靜默略過造成資料結構不完整', () => {
    expect(() => migrateToLatest({ version: 0 })).toThrow('不支援從版本 0 升級,請更新 app 或改用該版本的 app 還原');
  });
});
