import { describe, expect, it } from 'vitest';
import type { CharacterBossTrackList } from '@/types';
import { restoreSnapshot } from '@/lib/sync/restore';
import { mergeSnapshots, type DataSnapshot } from '@/lib/sync/snapshot';
import { describeOverwrite } from '@/lib/sync/snapshotSummary';
import { T0, character, emptySnapshot, ids, task } from '@/lib/sync/syncTestKit';
import { recordTombstone } from '@/lib/tombstone';
import { adjust, at } from '@/lib/weapon/testUtils';

const OLD = T0.toISOString();
const FIRST = new Date('2026-10-09T01:00:00.000Z');
const SECOND = new Date('2026-10-09T02:00:00.000Z');

function idCounter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

function boss(id: string, characterId: string): CharacterBossTrackList {
  return {
    id,
    characterId,
    bossName: '史烏',
    difficulty: '困難',
    resetCycle: 'weekly',
    weeklyResetDay: 4,
    bossCatalogId: 'lotus',
    crystalValue: 1,
    partySize: 1,
    checked: false,
    lastResetAt: OLD,
    updatedAt: OLD,
  };
}

/** 模擬從介面刪除角色：角色與底下的任務、BOSS 寫墓碑，武器資料移除（不寫墓碑） */
function deleteCharacter(snapshot: DataSnapshot, characterId: string): DataSnapshot {
  const tasks = snapshot.tasks.filter((t) => t.characterId === characterId).map((t) => t.id);
  const bosses = snapshot.bosses.filter((b) => b.characterId === characterId).map((b) => b.id);
  const owned = (id: string) => id === characterId;
  return {
    ...snapshot,
    characters: snapshot.characters.filter((c) => c.id !== characterId),
    characterTombstones: recordTombstone(snapshot.characterTombstones, characterId),
    tasks: snapshot.tasks.filter((t) => t.characterId !== characterId),
    taskTombstones: tasks.reduce(recordTombstone, snapshot.taskTombstones),
    bosses: snapshot.bosses.filter((b) => b.characterId !== characterId),
    bossTombstones: bosses.reduce(recordTombstone, snapshot.bossTombstones),
    weapons: {
      ...snapshot.weapons,
      profiles: snapshot.weapons.profiles.filter((p) => !owned(p.id)),
      events: snapshot.weapons.events.filter((e) => !owned(e.characterId)),
      bossClears: snapshot.weapons.bossClears.filter((c) => !owned(c.characterId)),
      dailyClears: snapshot.weapons.dailyClears.filter((d) => !owned(d.characterId)),
      checkpoints: snapshot.weapons.checkpoints.filter((c) => !owned(c.id)),
    },
  };
}

/** 備份檔：楓葉主角（A）與挑戰者小號（B），各有一個任務與一隻 BOSS，A 有武器進度 */
const FILE = emptySnapshot({
  characters: [character('A', OLD, { name: '楓葉主角' }), character('B', OLD, { name: '挑戰者小號' })],
  tasks: [task('tA', 'A'), task('tB', 'B')],
  bosses: [boss('bA', 'A'), boss('bB', 'B')],
  weapons: { ...emptySnapshot().weapons, events: [{ ...adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 }), id: 'A:genesis:adjust:x', characterId: 'A' }] },
});
const nameOf = (s: DataSnapshot, name: string) => s.characters.find((c) => c.name === name)!;

describe('還原時換過 id 的資料（restoredFrom）', () => {
  it('換新 id 的角色、任務、BOSS 都記下最原始的 id；沒換 id 的不加這個欄位', () => {
    const current = deleteCharacter(FILE, 'A');
    const restored = restoreSnapshot(current, FILE, FIRST, idCounter('x'));
    const a = nameOf(restored, '楓葉主角');
    expect(a).toMatchObject({ id: 'x-1', restoredFrom: 'A' });
    expect(restored.tasks.find((t) => t.characterId === a.id)).toMatchObject({ restoredFrom: 'tA' });
    expect(restored.bosses.find((b) => b.characterId === a.id)).toMatchObject({ restoredFrom: 'bA' });
    expect('restoredFrom' in nameOf(restored, '挑戰者小號')).toBe(false);
    expect(restored.weapons.events.map((e) => e.characterId)).toEqual([a.id]);
  });

  it('使用者情境：刪除 A 後還原，再刪除 B 後用同一個檔案還原：比較畫面只顯示找回 B；A 的 id 不變、不寫墓碑', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const a = nameOf(afterFirst, '楓葉主角');
    const current = deleteCharacter(afterFirst, 'B');

    expect(describeOverwrite(current, FILE)).toEqual({
      addedCharacterNames: ['挑戰者小號'],
      removedCharacterNames: [],
      changedCharacterNames: [],
      newerCharacterNames: [],
      accountsChanged: false,
    });

    const afterSecond = restoreSnapshot(current, FILE, SECOND, idCounter('y'));
    const a2 = nameOf(afterSecond, '楓葉主角');
    expect(a2.id).toBe(a.id);
    expect(afterSecond.tasks.find((t) => t.characterId === a.id)!.id).toBe(afterFirst.tasks.find((t) => t.characterId === a.id)!.id);
    expect(afterSecond.characterTombstones.map((t) => t.id)).not.toContain(a.id);
    expect(afterSecond.weapons.events.map((e) => e.id)).toEqual(afterFirst.weapons.events.map((e) => e.id));
    // B 先前被刪除，所以換新 id
    expect(nameOf(afterSecond, '挑戰者小號')).toMatchObject({ id: 'y-1', restoredFrom: 'B' });
  });

  it('A 的進度和檔案不同時，比較畫面顯示進度會改變（不是失去再找回）', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const a = nameOf(afterFirst, '楓葉主角');
    const edited = { ...afterFirst, tasks: afterFirst.tasks.map((t) => (t.characterId === a.id ? { ...t, checked: true } : t)) };
    expect(describeOverwrite(edited, FILE)).toMatchObject({ addedCharacterNames: [], removedCharacterNames: [], changedCharacterNames: ['楓葉主角'] });
  });

  it('還原後又刪除、再還原：沒有可以沿用的資料，換另一個新 id，restoredFrom 仍是最原始的 id', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const deletedAgain = deleteCharacter(afterFirst, nameOf(afterFirst, '楓葉主角').id);
    const afterSecond = restoreSnapshot(deletedAgain, FILE, SECOND, idCounter('y'));
    expect(nameOf(afterSecond, '楓葉主角')).toMatchObject({ id: 'y-1', restoredFrom: 'A' });
  });

  it('還原、刪除反覆三輪：每輪換新 id、root 不變、墓碑逐輪累積；之後刪 B 再還原、或還原到中間的還原點，A 都對回目前那筆', () => {
    let current = FILE;
    const restorePoints: DataSnapshot[] = [];
    const seenIds: string[] = [];
    for (const [round, at] of [FIRST, SECOND, new Date('2026-10-09T03:00:00.000Z')].entries()) {
      current = deleteCharacter(current, nameOf(current, '楓葉主角').id);
      current = restoreSnapshot(current, FILE, at, idCounter(`r${round}`));
      restorePoints.push(current);
      const a = nameOf(current, '楓葉主角');
      expect(a).toMatchObject({ id: `r${round}-1`, restoredFrom: 'A' });
      // A 底下的任務、BOSS、武器也都跟著換到新 id，且只有一份
      expect(current.tasks.filter((t) => t.restoredFrom === 'tA' || t.id === 'tA').map((t) => t.characterId)).toEqual([a.id]);
      expect(current.bosses.filter((b) => b.restoredFrom === 'bA' || b.id === 'bA').map((b) => b.characterId)).toEqual([a.id]);
      expect(current.weapons.events.map((e) => e.characterId)).toEqual([a.id]);
      seenIds.push(a.id);
    }
    expect(current.characters).toHaveLength(2);
    expect(current.characterTombstones.map((t) => t.id)).toEqual(expect.arrayContaining(['A', 'r0-1', 'r1-1']));
    expect(current.characterTombstones.map((t) => t.id)).not.toContain('r2-1');

    // 第四輪：這次刪的是 B，A 不應該再換 id
    const deletedB = deleteCharacter(current, 'B');
    expect(describeOverwrite(deletedB, FILE)).toMatchObject({ addedCharacterNames: ['挑戰者小號'], removedCharacterNames: [], changedCharacterNames: [] });
    const afterB = restoreSnapshot(deletedB, FILE, new Date('2026-10-09T04:00:00.000Z'), idCounter('z'));
    expect(nameOf(afterB, '楓葉主角').id).toBe('r2-1');

    // 還原到第一輪留下的還原點（A 的 id 是已刪除的 r0-1）：對回目前的 r2-1，不會多一個 A
    const toPoint = restoreSnapshot(afterB, restorePoints[0], new Date('2026-10-09T05:00:00.000Z'), idCounter('p'));
    expect(toPoint.characters.filter((c) => c.name === '楓葉主角').map((c) => c.id)).toEqual(['r2-1']);
    expect(describeOverwrite(afterB, restorePoints[0]).removedCharacterNames).toEqual([]);
  });

  it('用「還原後才下載的備份」（帶 restoredFrom）還原：同一個 id 直接對上，restoredFrom 保留', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const newFile = afterFirst;
    const current = deleteCharacter(afterFirst, 'B');
    const afterSecond = restoreSnapshot(current, newFile, SECOND, idCounter('y'));
    expect(nameOf(afterSecond, '楓葉主角')).toMatchObject({ id: 'x-1', restoredFrom: 'A' });
    expect(describeOverwrite(current, newFile).addedCharacterNames).toEqual(['挑戰者小號']);
  });

  it('舊的墓碑已超過保留期被清掉：仍然對回已還原的那筆，不會多出一個重複的角色', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const pruned = { ...afterFirst, characterTombstones: [], taskTombstones: [], bossTombstones: [] };
    const afterSecond = restoreSnapshot(pruned, FILE, SECOND, idCounter('y'));
    expect(afterSecond.characters.filter((c) => c.name === '楓葉主角').map((c) => c.id)).toEqual(['x-1']);
  });

  it('同步：另一台還留著舊墓碑的裝置合併重複還原的結果後，A、B 都在；同步提示把 A 當成同一個角色', () => {
    const afterFirst = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    const otherDevice = deleteCharacter(afterFirst, 'B');
    const afterSecond = restoreSnapshot(otherDevice, FILE, SECOND, idCounter('y'));
    const { merged } = mergeSnapshots(otherDevice, afterSecond);
    expect(ids(merged.characters).sort()).toEqual(['x-1', 'y-1']);
    expect(describeOverwrite(otherDevice, merged)).toMatchObject({ addedCharacterNames: ['挑戰者小號'], removedCharacterNames: [] });
  });

  it('首次登入：兩邊的同一個角色一邊是原始 id、一邊是還原後的 id 時，視為同一個角色', () => {
    const restoredCopy = restoreSnapshot(deleteCharacter(FILE, 'A'), FILE, FIRST, idCounter('x'));
    expect(describeOverwrite(FILE, restoredCopy)).toMatchObject({ addedCharacterNames: [], removedCharacterNames: [], changedCharacterNames: [] });
  });

  it('toast 復原任務後，再用刪除前的備份還原：對回復原後的那筆，不會多出重複的任務', () => {
    // 模擬 restoreTask：舊 id 留墓碑，以新 id 加回並記下 restoredFrom
    const undone = {
      ...FILE,
      tasks: [...FILE.tasks.filter((t) => t.id !== 'tA'), { ...FILE.tasks[0], id: 'u-1', restoredFrom: 'tA' }],
      taskTombstones: recordTombstone(FILE.taskTombstones, 'tA'),
    };
    expect(describeOverwrite(undone, FILE)).toMatchObject({ addedCharacterNames: [], removedCharacterNames: [], changedCharacterNames: [] });
    const restored = restoreSnapshot(undone, FILE, FIRST, idCounter('x'));
    expect(restored.tasks.filter((t) => t.characterId === 'A').map((t) => t.id)).toEqual(['u-1']);
  });

  describe('帳號', () => {
    /** 備份檔：A、B 都在「主帳號」底下 */
    const WITH_ACCOUNT: DataSnapshot = {
      ...FILE,
      accounts: [{ id: 'ACC', name: '主帳號', order: 0, updatedAt: OLD }],
      characters: FILE.characters.map((c) => ({ ...c, accountId: 'ACC' })),
    };
    /** 模擬從介面刪除帳號：帳號寫墓碑，底下的角色改回未歸類 */
    const deleteAccount = (snapshot: DataSnapshot, accountId: string): DataSnapshot => ({
      ...snapshot,
      accounts: snapshot.accounts.filter((a) => a.id !== accountId),
      accountTombstones: recordTombstone(snapshot.accountTombstones, accountId),
      characters: snapshot.characters.map((c) => (c.accountId === accountId ? { ...c, accountId: null } : c)),
    });

    it('刪除帳號後還原：帳號換新 id 並記下原始 id，底下的角色跟著指到新 id', () => {
      const restored = restoreSnapshot(deleteAccount(WITH_ACCOUNT, 'ACC'), WITH_ACCOUNT, FIRST, idCounter('x'));
      expect(restored.accounts).toMatchObject([{ id: 'x-1', restoredFrom: 'ACC', name: '主帳號' }]);
      expect(restored.characters.map((c) => c.accountId)).toEqual(['x-1', 'x-1']);
    });

    it('帳號還原過之後，刪除角色 B 再還原：帳號沿用目前的 id、不顯示帳號設定不同，A、B 都在這個帳號底下', () => {
      const afterFirst = restoreSnapshot(deleteAccount(WITH_ACCOUNT, 'ACC'), WITH_ACCOUNT, FIRST, idCounter('x'));
      const current = deleteCharacter(afterFirst, 'B');
      expect(describeOverwrite(current, WITH_ACCOUNT)).toMatchObject({
        addedCharacterNames: ['挑戰者小號'],
        removedCharacterNames: [],
        changedCharacterNames: [],
        accountsChanged: false,
      });
      const afterSecond = restoreSnapshot(current, WITH_ACCOUNT, SECOND, idCounter('y'));
      expect(afterSecond.accounts.map((a) => a.id)).toEqual(['x-1']);
      expect(afterSecond.accountTombstones.map((t) => t.id)).not.toContain('x-1');
      expect(afterSecond.characters.map((c) => c.accountId)).toEqual(['x-1', 'x-1']);
    });

    it('帳號反覆刪除再還原：每次換新 id，restoredFrom 仍是最原始的 id，只會有一個帳號', () => {
      let current = WITH_ACCOUNT;
      for (const [round, at] of [FIRST, SECOND].entries()) {
        current = restoreSnapshot(deleteAccount(current, current.accounts[0].id), WITH_ACCOUNT, at, idCounter(`r${round}`));
        expect(current.accounts).toMatchObject([{ id: `r${round}-1`, restoredFrom: 'ACC' }]);
        expect(current.characters.map((c) => c.accountId)).toEqual([`r${round}-1`, `r${round}-1`]);
      }
    });

    it('帳號名稱改過再還原：顯示帳號設定不同，但不會變成多一個帳號', () => {
      const afterFirst = restoreSnapshot(deleteAccount(WITH_ACCOUNT, 'ACC'), WITH_ACCOUNT, FIRST, idCounter('x'));
      const renamed = { ...afterFirst, accounts: afterFirst.accounts.map((a) => ({ ...a, name: '改名後' })) };
      expect(describeOverwrite(renamed, WITH_ACCOUNT).accountsChanged).toBe(true);
      expect(restoreSnapshot(renamed, WITH_ACCOUNT, SECOND, idCounter('y')).accounts).toMatchObject([{ id: 'x-1', name: '主帳號' }]);
    });
  });

  it('不同的角色即使名稱相同也不會被對在一起（只看 restoredFrom，不看名稱）', () => {
    const current = emptySnapshot({ characters: [character('P', OLD, { name: '楓葉主角' })] });
    expect(describeOverwrite(current, FILE)).toMatchObject({ removedCharacterNames: ['楓葉主角'], addedCharacterNames: ['楓葉主角', '挑戰者小號'] });
  });
});
