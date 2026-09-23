import { describe, expect, it } from 'vitest';
import type { CharacterBossTrackList, VipTicketLevel } from '@/types';
import {
  countTrackedVipBossesByLevel,
  countTrackedVipBossesByLevelForCharacters,
  summarizeVipQuota,
} from '@/lib/vipBossCatalog';

let bossIdCounter = 0;
function makeVipBoss(characterId: string, vipTicketLevel: VipTicketLevel | undefined): CharacterBossTrackList {
  bossIdCounter += 1;
  return {
    id: `boss-${bossIdCounter}`,
    characterId,
    bossName: '測試王',
    difficulty: '普通',
    resetCycle: 'weekly',
    category: 'vip',
    vipTicketLevel,
    crystalValue: 1000,
    partySize: 1,
    checked: false,
    lastResetAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('countTrackedVipBossesByLevelForCharacters', () => {
  it('把帳號內多隻角色的VIP BOSS依券等級加總', () => {
    const bosses = [makeVipBoss('c1', '中'), makeVipBoss('c2', '中'), makeVipBoss('c2', '下')];
    const counts = countTrackedVipBossesByLevelForCharacters(bosses, new Set(['c1', 'c2']));
    expect(counts).toEqual({ 下: 1, 中: 2, 上: 0, 終極: 0, 每月: 0 });
  });

  it('不在名單內的角色不計入(別的帳號的用量不會算進來)', () => {
    const bosses = [makeVipBoss('c1', '中'), makeVipBoss('other', '中')];
    const counts = countTrackedVipBossesByLevelForCharacters(bosses, new Set(['c1']));
    expect(counts['中']).toBe(1);
  });

  it('不是VIP重置王,或缺少券等級的紀錄不計入', () => {
    const regular: CharacterBossTrackList = { ...makeVipBoss('c1', '中'), category: undefined };
    const noLevel = makeVipBoss('c1', undefined);
    const counts = countTrackedVipBossesByLevelForCharacters([regular, noLevel], new Set(['c1']));
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});

describe('countTrackedVipBossesByLevel', () => {
  it('只算單一角色自己的用量', () => {
    const bosses = [makeVipBoss('c1', '上'), makeVipBoss('c2', '上')];
    expect(countTrackedVipBossesByLevel(bosses, 'c1')['上']).toBe(1);
  });
});

describe('summarizeVipQuota', () => {
  const none = { 下: 0, 中: 0, 上: 0, 終極: 0, 每月: 0 };

  it('皇家:配額合計 7(1+3+1+1+1),用量為各券等級用量加總', () => {
    expect(summarizeVipQuota('royal', { ...none, 中: 2, 每月: 1 })).toEqual({ used: 3, cap: 7 });
  });

  it('鑽石:配額合計 3', () => {
    expect(summarizeVipQuota('diamond', none)).toEqual({ used: 0, cap: 3 });
  });

  it('黃金沒有任何重置券配額', () => {
    expect(summarizeVipQuota('gold', none)).toEqual({ used: 0, cap: 0 });
  });

  it('沒有VIP等級:配額為 0', () => {
    expect(summarizeVipQuota(undefined, none)).toEqual({ used: 0, cap: 0 });
  });
});
