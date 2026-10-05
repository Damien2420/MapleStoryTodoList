import { describe, expect, it } from 'vitest';
import { deriveClears, type DeriveInput } from './deriveClears';
import type { BossClear, DailyClear } from './types';
import { at, boss, SETTINGS, task } from './testUtils';

const NOW = at(2026, 10, 2, 12);
const PROFILE = { genesisPass: false, stormTraining: false };

/** 套用 derive 結果(以 id upsert),模擬 store 的寫入 */
function apply(clears: BossClear[], dailies: DailyClear[], input: Omit<DeriveInput, 'bossClears' | 'dailyClears'>) {
  const r = deriveClears({ ...input, bossClears: clears, dailyClears: dailies });
  const map = new Map(clears.map((c) => [c.id, c]));
  r.bossClears.forEach((c) => map.set(c.id, c));
  const dmap = new Map(dailies.map((d) => [d.id, d]));
  r.dailyClears.forEach((d) => dmap.set(d.id, d));
  return { clears: [...map.values()], dailies: [...dmap.values()], result: r };
}

const base = { characterId: 'c1', tasks: [], profile: PROFILE, settings: SETTINGS, now: NOW };

describe('deriveClears', () => {
  it('勾選產生紀錄,取消為同一筆 active = false,重新勾選保留 firstClearedAt', () => {
    const checkedAt = at(2026, 10, 2, 9).toISOString();
    let s = apply([], [], { ...base, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: checkedAt })] });
    expect(s.clears).toHaveLength(1);
    expect(s.clears[0]).toMatchObject({ active: true, firstClearedAt: checkedAt, difficulty: '困難' });
    const id = s.clears[0].id;

    s = apply(s.clears, [], { ...base, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: false, lastResetAt: checkedAt })] });
    expect(s.clears).toHaveLength(1);
    expect(s.clears[0]).toMatchObject({ id, active: false });

    const recheck = at(2026, 10, 2, 11).toISOString();
    s = apply(s.clears, [], { ...base, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: recheck })] });
    expect(s.clears[0]).toMatchObject({ id, active: true, firstClearedAt: checkedAt });
  });

  it('週中修改人數、難度更新同一筆;沒有變動時不輸出', () => {
    const checkedAt = at(2026, 10, 2, 9).toISOString();
    let s = apply([], [], { ...base, bosses: [boss({ bossCatalogId: 'will', difficulty: '困難', checked: true, lastResetAt: checkedAt })] });
    s = apply(s.clears, [], { ...base, bosses: [boss({ bossCatalogId: 'will', difficulty: '普通', partySize: 3, checked: true, lastResetAt: checkedAt })] });
    expect(s.clears).toHaveLength(1);
    expect(s.clears[0]).toMatchObject({ difficulty: '普通', partySize: 3 });
    const again = deriveClears({ ...base, bosses: [boss({ bossCatalogId: 'will', difficulty: '普通', partySize: 3, checked: true, lastResetAt: checkedAt })], bossClears: s.clears, dailyClears: [] });
    expect(again.bossClears).toHaveLength(0);
  });

  it('刪除追蹤項目後本週紀錄保留不動', () => {
    const s = apply([], [], { ...base, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: at(2026, 10, 2, 9).toISOString() })] });
    const r = deriveClears({ ...base, bosses: [], bossClears: s.clears, dailyClears: [] });
    expect(r.bossClears).toHaveLength(0);
  });

  it('重置後、runResetCheck 之前的上週勾選歸屬上週,不改動已結束的週期', () => {
    const lastWeek = at(2026, 9, 28, 9).toISOString();
    const r = deriveClears({ ...base, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: lastWeek })], bossClears: [], dailyClears: [] });
    expect(r.bossClears).toHaveLength(0);
  });

  it('同一隻王同時追蹤兩個難度:同一週只有一筆,取勾選中的較高難度', () => {
    const t = at(2026, 10, 2, 9).toISOString();
    const r = deriveClears({
      ...base,
      bosses: [
        boss({ id: 'a', bossCatalogId: 'lucid', difficulty: '普通', checked: true, lastResetAt: t }),
        boss({ id: 'b', bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: t }),
      ],
      bossClears: [],
      dailyClears: [],
    });
    expect(r.bossClears).toHaveLength(1);
    expect(r.bossClears[0].difficulty).toBe('困難');
  });

  it('VIP 與一般分開記錄', () => {
    const t = at(2026, 10, 2, 9).toISOString();
    const r = deriveClears({
      ...base,
      bosses: [
        boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: t }),
        boss({ bossCatalogId: 'lucid', difficulty: '困難', category: 'vip', checked: true, lastResetAt: t }),
      ],
      bossClears: [],
      dailyClears: [],
    });
    expect(r.bossClears.map((c) => c.isVip).sort()).toEqual([false, true]);
  });

  it('沒有任何武器取得量的王不產生紀錄', () => {
    const r = deriveClears({ ...base, bosses: [boss({ bossCatalogId: 'hilla', difficulty: '困難', checked: true, lastResetAt: at(2026, 10, 2, 9).toISOString() })], bossClears: [], dailyClears: [] });
    expect(r.bossClears).toHaveLength(0);
  });

  it('加成設定寫入當下就固定在紀錄上', () => {
    const r = deriveClears({ ...base, profile: { genesisPass: true, stormTraining: true }, bosses: [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: at(2026, 10, 2, 9).toISOString() })], bossClears: [], dailyClears: [] });
    expect(r.bossClears[0]).toMatchObject({ genesisPass: true, stormTraining: true });
  });

  it('週中改通行證或暴風修練,本週已寫入的紀錄不追溯', () => {
    const checkedAt = at(2026, 10, 2, 9).toISOString();
    const bosses = [boss({ bossCatalogId: 'lucid', difficulty: '困難', checked: true, lastResetAt: checkedAt })];
    const first = apply([], [], { ...base, bosses });
    const later = apply(first.clears, [], { ...base, profile: { genesisPass: true, stormTraining: true }, bosses });
    expect(later.clears[0]).toMatchObject({ genesisPass: false, stormTraining: false });
    expect(later.result.bossClears).toEqual([]);
  });

  it('每日取最高地區;取消最高地區退回次高;全部取消為 0', () => {
    const t = at(2026, 10, 2, 9).toISOString();
    const grandis = (name: string, checked: boolean) => task({ name, presetId: 'grandis-daily', checked, lastResetAt: t });
    let s = apply([], [], { ...base, bosses: [], tasks: [grandis('桃源境', true), grandis('卡爾西溫', true)] });
    expect(s.dailies[0].topRegionShards).toBe(25);
    s = apply(s.clears, s.dailies, { ...base, bosses: [], tasks: [grandis('桃源境', true), grandis('卡爾西溫', false)] });
    expect(s.dailies[0].topRegionShards).toBe(10);
    s = apply(s.clears, s.dailies, { ...base, bosses: [], tasks: [grandis('桃源境', false), grandis('卡爾西溫', false)] });
    expect(s.dailies).toHaveLength(1);
    expect(s.dailies[0].topRegionShards).toBe(0);
  });

  it('昨天勾選、還沒被重置的每日任務不算今天', () => {
    const r = deriveClears({ ...base, bosses: [], tasks: [task({ name: '桃源境', presetId: 'grandis-daily', checked: true, lastResetAt: at(2026, 10, 1, 22).toISOString() })], bossClears: [], dailyClears: [] });
    expect(r.dailyClears).toHaveLength(0);
  });
});
