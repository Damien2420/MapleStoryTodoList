import { GRANDIS_DAILY_PRESET_ID, GRANDIS_DAILY_SHARDS } from '@/data/weaponRates.data';
import { findBossCatalogEntry } from '@/lib/bossCatalog';
import type { CharacterBossTrackList, CharacterTask, Settings } from '@/types';
import { cycleBounds, dayBounds, localDateKey } from './cycle';
import { hasWeaponRate } from './rates';
import type { BossClear, DailyClear, WeaponProfile } from './types';

/** deriveClears 的輸入:同一個角色的勾選框與既有紀錄 */
export interface DeriveInput {
  characterId: string;
  bosses: CharacterBossTrackList[];
  tasks: CharacterTask[];
  bossClears: BossClear[];
  dailyClears: DailyClear[];
  profile: Pick<WeaponProfile, 'genesisPass' | 'stormTraining'>;
  settings: Settings;
  now: Date;
}

/** 有變動的紀錄(新增或修改),呼叫端以 id upsert */
export interface DeriveResult {
  bossClears: BossClear[];
  dailyClears: DailyClear[];
}

/** 難度在目錄中的順序,同一格有多個難度都勾選時取最高的 */
function difficultyRank(b: CharacterBossTrackList): number {
  const entry = b.bossCatalogId ? findBossCatalogEntry(b.bossCatalogId) : undefined;
  return entry ? entry.difficulties.findIndex((d) => d.difficulty === b.difficulty) : -1;
}

/** 兩筆擊破紀錄的內容是否相同(不比 updatedAt) */
function sameClear(a: BossClear, b: BossClear): boolean {
  return (
    a.difficulty === b.difficulty &&
    a.partySize === b.partySize &&
    a.isVip === b.isVip &&
    a.genesisPass === b.genesisPass &&
    a.stormTraining === b.stormTraining &&
    a.firstClearedAt === b.firstClearedAt &&
    a.cycleEnd === b.cycleEnd &&
    a.active === b.active
  );
}

/**
 * 依目前的勾選框狀態重建「本週期那幾格」紀錄。純函式,不讀目前時間(由 now 傳入)
 * - 紀錄的週期看勾選框的 lastResetAt(勾選時間),不看現在時間;只改動仍在進行中的週期,結束的週期凍結不動
 * - 勾選中 → active;生效中的紀錄保留 firstClearedAt,更新難度、人數與加成;失效的紀錄重新勾選視為重新擊破
 * - 取消勾選或刪除追蹤項目 → active = false
 * - 每日:當天勾選中的格蘭蒂斯地區任務取最高地區的取得量
 * @param input 同一個角色的勾選框、既有紀錄、加成設定與時間
 * @returns 需要新增或更新的紀錄
 */
export function deriveClears(input: DeriveInput): DeriveResult {
  const { characterId, settings, now, profile } = input;
  const nowIso = now.toISOString();
  const existing = new Map(input.bossClears.map((c) => [c.id, c]));

  // 同一隻王、同一種(一般 / VIP)、同一個週期只會有一格:刪除再加入、或同時追蹤兩個難度時合併
  const groups = new Map<string, { items: CharacterBossTrackList[]; cycleEnd: string }>();
  for (const b of input.bosses) {
    if (b.characterId !== characterId || !b.bossCatalogId || b.resetCycle === 'daily') continue;
    if (!hasWeaponRate(b.bossCatalogId, b.difficulty)) continue;
    const { start, end } = cycleBounds(b.resetCycle, settings, new Date(b.lastResetAt), b.weeklyResetDay);
    if (now >= end || now < start) continue;
    const id = `${characterId}:${b.bossCatalogId}:${b.category === 'vip' ? 'v' : 'n'}:${localDateKey(start)}`;
    const g = groups.get(id) ?? { items: [], cycleEnd: end.toISOString() };
    g.items.push(b);
    groups.set(id, g);
  }

  const bossClears: BossClear[] = [];
  for (const [id, { items, cycleEnd }] of groups) {
    const prev = existing.get(id);
    const checked = items.filter((b) => b.checked);
    if (checked.length === 0) {
      if (prev?.active) bossClears.push({ ...prev, active: false, updatedAt: nowIso });
      continue;
    }
    const pick = checked.reduce((best, b) => (difficultyRank(b) > difficultyRank(best) ? b : best));
    const firstCheck = checked.map((b) => b.lastResetAt).sort()[0];
    const next: BossClear = {
      id,
      characterId,
      bossCatalogId: pick.bossCatalogId!,
      difficulty: pick.difficulty,
      partySize: pick.partySize,
      isVip: pick.category === 'vip',
      // 加成一律用目前的設定:週中才買通行證,官方會補發當週 / 當月已打 BOSS 的差額;已結束的週期不會再進到這裡
      genesisPass: profile.genesisPass,
      stormTraining: profile.stormTraining,
      // 取消勾選(或刪除)後重新勾選視為重新擊破,改用重新勾選的時間,校正後勾回來才會加進持有量
      firstClearedAt: prev?.active ? prev.firstClearedAt : firstCheck,
      cycleEnd,
      active: true,
      updatedAt: nowIso,
    };
    if (!prev || !sameClear(prev, next)) bossClears.push(next);
  }
  // 追蹤項目被刪除:進行中週期的紀錄視同取消勾選;加回來重新勾選會恢復同一筆
  for (const prev of input.bossClears) {
    if (prev.active && prev.cycleEnd > nowIso && !groups.has(prev.id)) bossClears.push({ ...prev, active: false, updatedAt: nowIso });
  }

  const dailyClears: DailyClear[] = [];
  const today = dayBounds(settings, now);
  let top = 0;
  let firstCheck = nowIso;
  for (const t of input.tasks) {
    if (t.characterId !== characterId || t.presetId !== GRANDIS_DAILY_PRESET_ID || !t.checked) continue;
    const checkedAt = new Date(t.lastResetAt);
    if (checkedAt < today.start || checkedAt >= today.end) continue;
    top = Math.max(top, GRANDIS_DAILY_SHARDS[t.name] ?? 0);
    if (t.lastResetAt < firstCheck) firstCheck = t.lastResetAt;
  }
  const dailyId = `${characterId}:d:${localDateKey(today.start)}`;
  const prevDaily = input.dailyClears.find((d) => d.id === dailyId);
  if (prevDaily ? prevDaily.topRegionShards !== top : top > 0) {
    dailyClears.push({ id: dailyId, characterId, day: today.start.toISOString(), firstClearedAt: prevDaily?.firstClearedAt ?? firstCheck, topRegionShards: top, updatedAt: nowIso });
  }

  return { bossClears, dailyClears };
}
