import { describe, expect, it } from 'vitest';
import { restoreSnapshot } from '@/lib/sync/restore';
import { mergeSnapshots } from '@/lib/sync/snapshot';
import { T0, character, emptySnapshot, ids, task } from '@/lib/sync/syncTestKit';
import { adjust, at, clear } from '@/lib/weapon/testUtils';
import { emptyWeaponSnapshot, emptyWeaponState, RULES_VERSION, weaponTombstoneId } from '@/lib/weapon/types';

const NOW = new Date('2026-10-09T00:00:00.000Z');
const STAMP = NOW.toISOString();
const OLD = T0.toISOString();

function idCounter(): () => string {
  let n = 0;
  return () => `new-${++n}`;
}

describe('restoreSnapshot', () => {
  it('還原的每一筆資料都改成現在的修改時間（角色的位置時間也一起改），其他內容不變', () => {
    const target = emptySnapshot({
      accounts: [{ id: 'a1', name: 'A', order: 0, updatedAt: OLD }],
      characters: [character('c1', OLD, { level: 200 })],
      tasks: [task('t1', 'c1')],
    });
    const result = restoreSnapshot(emptySnapshot(), target, NOW, idCounter());
    expect(result.accounts).toEqual([{ id: 'a1', name: 'A', order: 0, updatedAt: STAMP }]);
    expect(result.characters).toEqual([{ ...target.characters[0], updatedAt: STAMP, placementUpdatedAt: STAMP }]);
    expect(result.tasks).toEqual([{ ...target.tasks[0], updatedAt: STAMP }]);
  });

  it('目前有、要還原的資料沒有的紀錄全部寫上墓碑', () => {
    const current = emptySnapshot({ characters: [character('keep'), character('drop')], tasks: [task('t-drop', 'drop')] });
    const target = emptySnapshot({ characters: [character('keep')] });
    const result = restoreSnapshot(current, target, NOW, idCounter());
    expect(ids(result.characters)).toEqual(['keep']);
    expect(result.characterTombstones).toEqual([{ id: 'drop', deletedAt: STAMP }]);
    expect(result.taskTombstones).toEqual([{ id: 't-drop', deletedAt: STAMP }]);
  });

  it('要還原的紀錄先前被刪除過（目前有墓碑）時改用新 id，任務與所屬帳號的關聯跟著換，舊 id 的墓碑保留', () => {
    const current = emptySnapshot({
      accountTombstones: [{ id: 'a-old', deletedAt: OLD }],
      characterTombstones: [{ id: 'c-old', deletedAt: OLD }],
    });
    const target = emptySnapshot({
      accounts: [{ id: 'a-old', name: 'A', order: 0, updatedAt: OLD }],
      characters: [character('c-old', OLD, { accountId: 'a-old' })],
      tasks: [task('t1', 'c-old')],
    });
    const result = restoreSnapshot(current, target, NOW, idCounter());
    expect(result.accounts.map((a) => a.id)).toEqual(['new-1']);
    expect(result.characters[0]).toMatchObject({ id: 'new-2', name: 'c-old', accountId: 'new-1' });
    expect(result.tasks[0]).toMatchObject({ id: 't1', characterId: 'new-2' });
    expect(result.characterTombstones).toEqual([{ id: 'c-old', deletedAt: OLD }]);
    expect(result.accountTombstones).toEqual([{ id: 'a-old', deletedAt: OLD }]);
  });

  it('目前與要還原的資料各自的墓碑都保留', () => {
    const current = emptySnapshot({ taskTombstones: [{ id: 't-a', deletedAt: OLD }] });
    const target = emptySnapshot({ tasks: [task('t1', 'c1')], taskTombstones: [{ id: 't-b', deletedAt: OLD }] });
    expect(ids(restoreSnapshot(current, target, NOW, idCounter()).taskTombstones)).toEqual(['t-a', 't-b']);
  });

  it('還保留舊資料的裝置拿還原結果合併後與還原內容一致：被移除的不復活，還原的不被舊版本蓋掉', () => {
    const current = emptySnapshot({
      characters: [character('c1', OLD, { level: 250 }), character('c2')],
      characterTombstones: [{ id: 'c3', deletedAt: OLD }],
    });
    const target = emptySnapshot({ characters: [character('c1', OLD, { level: 100 }), character('c3')] });
    const restored = restoreSnapshot(current, target, NOW, idCounter());
    const { merged } = mergeSnapshots(current, restored);
    expect(merged.characters.map((c) => [c.name, c.level]).sort()).toEqual([
      ['c1', 100],
      ['c3', 1],
    ]);
  });

  it('不修改傳入的快照', () => {
    const current = emptySnapshot({ characters: [character('c1')], characterTombstones: [{ id: 'c2', deletedAt: OLD }] });
    const target = emptySnapshot({ characters: [character('c2')] });
    const currentCopy = structuredClone(current);
    const targetCopy = structuredClone(target);
    restoreSnapshot(current, target, NOW, idCounter());
    expect(current).toEqual(currentCopy);
    expect(target).toEqual(targetCopy);
  });

  it('武器：還原的資料改成還原時間；目前有、還原後沒有的寫上墓碑；還原後存在的不留墓碑', () => {
    const e1 = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const e2 = adjust(at(2026, 10, 2), { weapon: 'genesis', stage: 2, pool: 0 });
    const profile = { id: 'c1', genesisPass: true, stormTraining: false, updatedAt: OLD };
    const current = emptySnapshot({
      characters: [character('c1')],
      weapons: { ...emptyWeaponSnapshot(), events: [e1, e2], profiles: [profile] },
    });
    const target = emptySnapshot({
      characters: [character('c1')],
      weapons: { ...emptyWeaponSnapshot(), events: [e1], tombstones: [{ id: weaponTombstoneId('event', e1.id), deletedAt: OLD }] },
    });
    const result = restoreSnapshot(current, target, NOW, idCounter());
    expect(result.weapons.events).toEqual([{ ...e1, updatedAt: STAMP }]);
    expect(result.weapons.profiles).toEqual([]);
    expect(result.weapons.tombstones).toEqual(
      expect.arrayContaining([
        { id: weaponTombstoneId('event', e2.id), deletedAt: STAMP },
        { id: weaponTombstoneId('profile', 'c1'), deletedAt: STAMP },
      ]),
    );
    expect(result.weapons.tombstones.map((t) => t.id)).not.toContain(weaponTombstoneId('event', e1.id));
  });

  it('武器：角色換新 id 時，characterId、紀錄 id 前綴、設定與存檔點 id、includeClearIds 一併換成新 id', () => {
    const boss = clear({ bossCatalogId: 'lotus', difficulty: '困難', firstClearedAt: at(2026, 10, 1).toISOString() });
    const event = adjust(at(2026, 10, 2), { weapon: 'genesis', stage: 1, pool: 0, includeClearIds: [boss.id] });
    const target = emptySnapshot({
      characters: [character('c1')],
      weapons: {
        ...emptyWeaponSnapshot(),
        profiles: [{ id: 'c1', genesisPass: false, stormTraining: false, updatedAt: OLD }],
        checkpoints: [{ id: 'c1', watermark: OLD, updatedAt: OLD, rulesVersion: RULES_VERSION, state: emptyWeaponState() }],
        bossClears: [boss],
        events: [event],
      },
    });
    const current = emptySnapshot({ characterTombstones: [{ id: 'c1', deletedAt: OLD }] });
    const { weapons } = restoreSnapshot(current, target, NOW, idCounter());
    const newBossId = boss.id.replace(/^c1:/, 'new-1:');
    expect(weapons.profiles[0].id).toBe('new-1');
    expect(weapons.checkpoints[0].id).toBe('new-1');
    expect(weapons.bossClears[0]).toMatchObject({ id: newBossId, characterId: 'new-1' });
    expect(weapons.events[0]).toMatchObject({ id: event.id.replace(/^c1:/, 'new-1:'), characterId: 'new-1' });
    expect(weapons.events[0].payload).toMatchObject({ includeClearIds: [newBossId] });
  });
});
