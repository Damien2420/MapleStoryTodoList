import { beforeEach, describe, expect, it } from 'vitest';
import { storeRepo } from '@/lib/sync/localRepo';
import { character, emptySnapshot } from '@/lib/sync/syncTestKit';
import { adjust, boss } from '@/lib/weapon/testUtils';
import { emptyWeaponSnapshot } from '@/lib/weapon/types';
import { useAccountStore } from '@/store/useAccountStore';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeaponStore } from '@/store/useWeaponStore';

beforeEach(() => {
  useCharacterStore.setState({ characters: [], deletedIds: [], activeCharacterId: null });
  useTaskStore.setState({ tasks: [], deletedIds: [] });
  useBossStore.setState({ bosses: [], deletedIds: [] });
  useAccountStore.setState({ accounts: [], deletedIds: [] });
  useWeaponStore.getState().clearAll();
});

describe('storeRepo', () => {
  it('讀寫武器資料（含墓碑）', () => {
    const tombstone = { id: 'event:x', deletedAt: '2026-10-01T00:00:00.000Z' };
    const snapshot = emptySnapshot({ weapons: { ...emptyWeaponSnapshot(), tombstones: [tombstone] } });
    storeRepo.write(snapshot);
    expect(useWeaponStore.getState().deletedIds).toEqual([tombstone]);
    expect(storeRepo.read().weapons.tombstones).toEqual([tombstone]);
  });

  it('寫完所有資料後依合併結果衍生一次擊破紀錄；新增紀錄回傳需要推送，再寫一次相同內容則不需要', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const snapshot = emptySnapshot({
      characters: [character('c1')],
      bosses: [boss({ bossCatalogId: 'lotus', difficulty: '困難', checked: true, lastResetAt: nowIso, updatedAt: nowIso })],
      weapons: { ...emptyWeaponSnapshot(), events: [adjust(now, { weapon: 'genesis', stage: 1, pool: 0 })] },
    });
    expect(storeRepo.write(snapshot)).toBe(true);
    expect(useWeaponStore.getState().bossClears.map((c) => c.bossCatalogId)).toEqual(['lotus']);
    expect(storeRepo.write(storeRepo.read())).toBe(false);
  });
});
