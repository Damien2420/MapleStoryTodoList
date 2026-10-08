import { describe, expect, it } from 'vitest';
import { adjust, at, clear, daily } from './testUtils';
import {
  emptyWeaponSnapshot,
  emptyWeaponState,
  RULES_VERSION,
  weaponTombstoneId,
  type WeaponCheckpoint,
  type WeaponProfile,
  type WeaponSnapshot,
} from './types';
import { mergeWeaponSnapshots, pickCheckpoint } from './weaponMerge';

const NONE = new Set<string>();
const iso = (d: Date) => d.toISOString();
const snap = (overrides: Partial<WeaponSnapshot> = {}): WeaponSnapshot => ({ ...emptyWeaponSnapshot(), ...overrides });
const profile = (id: string, updatedAt: Date, genesisPass = false): WeaponProfile => ({
  id,
  genesisPass,
  stormTraining: false,
  updatedAt: iso(updatedAt),
});
const checkpoint = (id: string, watermark: Date, updatedAt: Date, pool = 0): WeaponCheckpoint => ({
  id,
  watermark: iso(watermark),
  updatedAt: iso(updatedAt),
  rulesVersion: RULES_VERSION,
  state: { ...emptyWeaponState(), genesis: { status: 'active', stage: 1, pool } },
});

describe('mergeWeaponSnapshots', () => {
  it('逐筆合併取 updatedAt 較新者，本機沒有的加入；沒有任何變化時回傳本機原本的物件', () => {
    const local = snap({ profiles: [profile('c1', at(2026, 10, 1))] });
    const remote = snap({ profiles: [profile('c1', at(2026, 10, 2), true), profile('c2', at(2026, 10, 1))] });
    expect(mergeWeaponSnapshots(local, remote, NONE).profiles).toEqual(remote.profiles);

    const same = snap({ profiles: [profile('c1', at(2026, 10, 2), true)] });
    expect(mergeWeaponSnapshots(same, snap(), NONE)).toBe(same);
  });

  it('武器墓碑：紀錄比墓碑新時保留紀錄並移除墓碑，否則移除紀錄；種類前綴讓同 id 的設定不受存檔點墓碑影響', () => {
    const restoredAt = at(2026, 10, 5);
    const oldClear = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: iso(at(2026, 10, 2)) });
    const newClear = clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: iso(at(2026, 10, 6)) });
    const local = snap({ bossClears: [oldClear, newClear], profiles: [profile('c1', at(2026, 10, 1))] });
    const remote = snap({
      tombstones: [
        { id: weaponTombstoneId('bossClear', oldClear.id), deletedAt: iso(restoredAt) },
        { id: weaponTombstoneId('bossClear', newClear.id), deletedAt: iso(restoredAt) },
        { id: weaponTombstoneId('checkpoint', 'c1'), deletedAt: iso(restoredAt) },
      ],
    });
    const merged = mergeWeaponSnapshots(local, remote, NONE);
    expect(merged.bossClears).toEqual([newClear]);
    expect(merged.profiles).toEqual(local.profiles);
    expect(merged.tombstones.map((t) => t.id)).toEqual([
      weaponTombstoneId('bossClear', oldClear.id),
      weaponTombstoneId('checkpoint', 'c1'),
    ]);
  });

  it('早於勝出存檔點 watermark 的紀錄與事件丟棄；被未壓縮校正事件引用的擊破保留', () => {
    const cp = checkpoint('c1', at(2026, 9, 3, 0), at(2026, 10, 5));
    const oldBoss = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: iso(at(2026, 9, 1)) });
    const keptBoss = clear({ bossCatalogId: 'will', difficulty: '困難', firstClearedAt: iso(at(2026, 9, 2)) });
    const newBoss = clear({ bossCatalogId: 'lucid', difficulty: '困難', firstClearedAt: iso(at(2026, 9, 10)) });
    const oldDaily = daily(at(2026, 9, 1), 25);
    const newDaily = daily(at(2026, 9, 10), 25);
    const oldEvent = adjust(at(2026, 9, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const newEvent = adjust(at(2026, 9, 10), { weapon: 'genesis', stage: 2, pool: 0, includeClearIds: [keptBoss.id] });
    const local = snap({
      bossClears: [oldBoss, keptBoss, newBoss],
      dailyClears: [oldDaily, newDaily],
      events: [oldEvent, newEvent],
    });
    const merged = mergeWeaponSnapshots(local, snap({ checkpoints: [cp] }), NONE);
    expect(merged.checkpoints).toEqual([cp]);
    expect(merged.bossClears).toEqual([keptBoss, newBoss]);
    expect(merged.dailyClears).toEqual([newDaily]);
    expect(merged.events).toEqual([newEvent]);
  });

  it('已刪除角色的設定、紀錄、事件與存檔點全部移除', () => {
    const local = snap({
      profiles: [profile('c1', at(2026, 10, 1)), profile('c2', at(2026, 10, 1))],
      checkpoints: [checkpoint('c1', at(2026, 9, 3), at(2026, 10, 5))],
      bossClears: [clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: iso(at(2026, 10, 1)) })],
      dailyClears: [daily(at(2026, 10, 1), 25)],
      events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 })],
    });
    expect(mergeWeaponSnapshots(local, snap(), new Set(['c1']))).toEqual(snap({ profiles: [profile('c2', at(2026, 10, 1))] }));
  });
});

describe('pickCheckpoint', () => {
  it('依 updatedAt 取較新的：還原進來的存檔點即使 watermark 較舊也勝出，結果與比較順序無關', () => {
    const restored = checkpoint('c1', at(2026, 8, 6), at(2026, 10, 9), 10);
    const compacted = checkpoint('c1', at(2026, 9, 3), at(2026, 10, 5), 99);
    expect(pickCheckpoint(restored, compacted)).toBe(restored);
    expect(pickCheckpoint(compacted, restored)).toBe(restored);
  });

  it('updatedAt 相同時 watermark 較新者勝；都相同時兩個順序選出同一份', () => {
    const a = checkpoint('c1', at(2026, 9, 3), at(2026, 10, 5), 1);
    const b = checkpoint('c1', at(2026, 8, 27), at(2026, 10, 5), 2);
    expect(pickCheckpoint(a, b)).toBe(a);
    expect(pickCheckpoint(b, a)).toBe(a);
    const c = checkpoint('c1', at(2026, 9, 3), at(2026, 10, 5), 3);
    expect(pickCheckpoint(a, c)).toBe(pickCheckpoint(c, a));
  });

  it('watermark 晚於 updatedAt 的存檔點不合理，輸給合理的那份', () => {
    const broken = checkpoint('c1', at(2026, 12, 1), at(2026, 10, 9));
    const ok = checkpoint('c1', at(2026, 9, 3), at(2026, 10, 5));
    expect(pickCheckpoint(broken, ok)).toBe(ok);
    expect(pickCheckpoint(ok, broken)).toBe(ok);
  });
});
