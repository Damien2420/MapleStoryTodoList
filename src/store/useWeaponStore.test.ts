import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { foldWeapons } from '@/lib/weapon/fold';
import { cancelStormTrainingOffChallenger } from '@/lib/weapon/syncClears';
import { adjust, at, clear, daily, SETTINGS, upgrade } from '@/lib/weapon/testUtils';
import { emptyWeaponState, RULES_VERSION } from '@/lib/weapon/types';
import { useCharacterStore } from '@/store/useCharacterStore';
import { isWeaponTracked, safeLocalStorage, useWeaponStore, WEAPON_STORAGE_KEY } from '@/store/useWeaponStore';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

/** 把測試資料的角色 id 從 c1 換成指定角色 */
function forCharacter<T extends { id: string; characterId: string }>(item: T, characterId: string): T {
  return { ...item, id: item.id.replace(/^c1:/, `${characterId}:`), characterId };
}

beforeEach(() => {
  useWeaponStore.getState().clearAll();
});

describe('useWeaponStore 刪除', () => {
  it('刪除角色只清掉該角色的設定、紀錄、事件與存檔點', () => {
    const store = useWeaponStore.getState();
    store.setProfile('c1', { genesisPass: true });
    store.setProfile('c2', { stormTraining: true });
    store.addEvent(adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 }));
    store.addEvent(forCharacter(adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 2, pool: 0 }), 'c2'));
    store.upsertClears(
      [clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() })],
      [daily(at(2026, 10, 1), 25)],
    );
    useWeaponStore.setState({
      checkpoints: [{ id: 'c1', state: emptyWeaponState(), watermark: '', rulesVersion: RULES_VERSION, updatedAt: '' }],
    });

    useWeaponStore.getState().removeCharacter('c1');

    const s = useWeaponStore.getState();
    expect(s.profiles.map((p) => p.id)).toEqual(['c2']);
    expect(s.events.map((e) => e.characterId)).toEqual(['c2']);
    expect(s.bossClears).toEqual([]);
    expect(s.dailyClears).toEqual([]);
    expect(s.checkpoints).toEqual([]);
  });

  it('刪除全部紀錄清空所有資料', () => {
    const store = useWeaponStore.getState();
    store.setProfile('c1', { genesisPass: true });
    store.addEvent(adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 }));
    store.clearAll();
    const s = useWeaponStore.getState();
    expect([s.profiles, s.bossClears, s.dailyClears, s.events, s.checkpoints]).toEqual([[], [], [], [], []]);
  });
});

describe('useWeaponStore 事件與設定', () => {
  it('同一階的升階事件 id 固定,重複升階只留一筆', () => {
    const store = useWeaponStore.getState();
    store.addEvent(upgrade(at(2026, 10, 1), 'genesis', 3));
    store.addEvent(upgrade(at(2026, 10, 2), 'genesis', 3));
    const events = useWeaponStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0].at).toBe(at(2026, 10, 2).toISOString());
  });

  it('設定沒有變化時不寫入新的 profiles 陣列', () => {
    useWeaponStore.getState().setProfile('c1', { genesisPass: true });
    const before = useWeaponStore.getState().profiles;
    useWeaponStore.getState().setProfile('c1', { genesisPass: true });
    expect(useWeaponStore.getState().profiles).toBe(before);
  });

  it('只有做過初始設定或標記完成的角色才算開啟追蹤', () => {
    expect(isWeaponTracked({ events: [upgrade(at(2026, 10, 1), 'genesis', 1)], checkpoints: [] }, 'c1')).toBe(false);
    expect(isWeaponTracked({ events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 })], checkpoints: [] }, 'c1')).toBe(true);
    expect(isWeaponTracked({ events: [adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 })], checkpoints: [] }, 'c2')).toBe(false);
  });
});

describe('暴風修練自動取消', () => {
  it('伺服器離開挑戰者時取消暴風修練,仍在挑戰者的角色不受影響', () => {
    useCharacterStore.setState({ characters: [], activeCharacterId: null, deletedIds: [] });
    const add = useCharacterStore.getState().addCharacter;
    const moved = add({ name: '甲', server: '挑戰者', level: 270, job: 'Warrior', source: 'manual' });
    const stay = add({ name: '乙', server: '挑戰者', level: 270, job: 'Warrior', source: 'manual' });
    useWeaponStore.getState().setProfile(moved, { stormTraining: true, genesisPass: true });
    useWeaponStore.getState().setProfile(stay, { stormTraining: true });

    useCharacterStore.getState().updateCharacter(moved, { server: '艾麗亞' });
    cancelStormTrainingOffChallenger();

    const profiles = useWeaponStore.getState().profiles;
    expect(profiles.find((p) => p.id === moved)).toMatchObject({ stormTraining: false, genesisPass: true });
    expect(profiles.find((p) => p.id === stay)).toMatchObject({ stormTraining: true });
  });
});

describe('safeLocalStorage', () => {
  it('超過容量時不丟錯,只提示一次', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => safeLocalStorage.setItem('k', 'v')).not.toThrow();
    expect(() => safeLocalStorage.setItem('k', 'v')).not.toThrow();
    expect(toast.error).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('舊版 Firefox 的容量錯誤名稱也會被辨識', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED');
    });
    expect(() => safeLocalStorage.setItem('k', 'v')).not.toThrow();
    spy.mockRestore();
  });

  it('其他錯誤照常丟出', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => safeLocalStorage.setItem('k', 'v')).toThrow('boom');
    spy.mockRestore();
  });
});

describe('useWeaponStore 壓縮', () => {
  it('壓縮前後狀態一致,舊紀錄與存檔點在同一次寫入完成', () => {
    const store = useWeaponStore.getState();
    store.addEvent(adjust(at(2026, 6, 4), { weapon: 'genesis', stage: 1, pool: 100 }));
    store.upsertClears(
      [
        clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 6, 5).toISOString() }),
        clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 9, 25).toISOString() }),
      ],
      [],
    );
    const fold = () => {
      const s = useWeaponStore.getState();
      return foldWeapons({ checkpoint: s.checkpoints[0], bossClears: s.bossClears, dailyClears: s.dailyClears, events: s.events, settings: SETTINGS }).state;
    };
    const before = fold();
    const writes: number[] = [];
    const unsub = useWeaponStore.subscribe(() => writes.push(1));

    useWeaponStore.getState().compact(at(2026, 10, 2), SETTINGS);
    unsub();

    const s = useWeaponStore.getState();
    expect(writes).toHaveLength(1);
    expect(s.checkpoints).toHaveLength(1);
    expect(s.events).toEqual([]);
    expect(s.bossClears).toHaveLength(1);
    expect(fold()).toEqual(before);

    // 沒有可壓縮的資料時不寫入
    const again: number[] = [];
    const unsub2 = useWeaponStore.subscribe(() => again.push(1));
    useWeaponStore.getState().compact(at(2026, 10, 2), SETTINGS);
    unsub2();
    expect(again).toEqual([]);
  });

  it('沒有可壓縮的資料時回傳 false', () => {
    expect(useWeaponStore.getState().compact(at(2026, 10, 2), SETTINGS)).toBe(false);
  });
});

describe('useWeaponStore 載入損毀的資料', () => {
  const load = async (raw: unknown) => {
    localStorage.setItem(WEAPON_STORAGE_KEY, JSON.stringify({ state: raw, version: 1 }));
    await useWeaponStore.persist.rehydrate();
    return useWeaponStore.getState();
  };

  it('欄位是 null 或不是陣列時退回空陣列,isWeaponTracked 與壓縮不會崩潰', async () => {
    const s = await load({ events: null, bossClears: {}, dailyClears: 'x', profiles: 3, checkpoints: null });
    expect([s.events, s.bossClears, s.dailyClears, s.profiles, s.checkpoints]).toEqual([[], [], [], [], []]);
    expect(isWeaponTracked(s, 'c1')).toBe(false);
    expect(() => s.compact(at(2026, 10, 2), SETTINGS)).not.toThrow();
  });

  it('陣列裡缺 id 或 characterId 的項目會被丟掉', async () => {
    const good = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const s = await load({ events: [null, 1, { id: 'x' }, good] });
    expect(s.events).toEqual([good]);
  });

  it('存檔點缺少武器欄位時補成預設值,fold 不會崩潰', async () => {
    const s = await load({ checkpoints: [{ id: 'c1', watermark: '', rulesVersion: 1, updatedAt: '', state: { genesis: { status: 'active' } } }] });
    const cp = s.checkpoints[0];
    expect(cp.state.soul.status).toBe('unset');
    expect(cp.state.genesis).toMatchObject({ status: 'active', stage: 1, pool: 0 });
    const rec = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() });
    expect(() => foldWeapons({ checkpoint: cp, bossClears: [rec], dailyClears: [], events: [], settings: SETTINGS })).not.toThrow();
  });

  it('載入舊版（version 1）資料時保留內容並補上空的墓碑；墓碑會持久化', async () => {
    const good = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const s = await load({ events: [good] });
    expect(s.events).toEqual([good]);
    expect(s.deletedIds).toEqual([]);

    useWeaponStore.setState({ deletedIds: [{ id: 'event:x', deletedAt: '2026-10-01T00:00:00.000Z' }] });
    const saved = JSON.parse(localStorage.getItem(WEAPON_STORAGE_KEY)!) as { state: { deletedIds: unknown }; version: number };
    expect(saved.version).toBe(2);
    expect(saved.state.deletedIds).toEqual([{ id: 'event:x', deletedAt: '2026-10-01T00:00:00.000Z' }]);
  });
});
