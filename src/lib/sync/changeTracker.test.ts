import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/store/useAccountStore';
import { useBossStore } from '@/store/useBossStore';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useTaskStore } from '@/store/useTaskStore';
import { trackDataChanges } from '@/lib/sync/changeTracker';
import { storeRepo } from '@/lib/sync/localRepo';
import { character, emptySnapshot, task, T0 } from '@/lib/sync/syncTestKit';

let stop: (() => void) | undefined;

beforeEach(() => {
  useCharacterStore.setState({ characters: [], deletedIds: [], activeCharacterId: null });
  useTaskStore.setState({ tasks: [], deletedIds: [] });
  useBossStore.setState({ bosses: [], deletedIds: [] });
  useAccountStore.setState({ accounts: [], deletedIds: [] });
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe('trackDataChanges', () => {
  it('帳號、角色、任務、BOSS 資料陣列變動時通知', () => {
    const onChange = vi.fn();
    stop = trackDataChanges(onChange);
    useCharacterStore.setState({ characters: [character('c1')] });
    useTaskStore.setState({ tasks: [task('t1', 'c1')] });
    useAccountStore.setState({ accounts: [{ id: 'a1', name: 'A', order: 0, updatedAt: T0.toISOString() }] });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('只改目前選中的角色或墓碑清單時不通知', () => {
    const onChange = vi.fn();
    stop = trackDataChanges(onChange);
    useCharacterStore.setState({ activeCharacterId: 'c1' });
    useTaskStore.setState({ deletedIds: [{ id: 't9', deletedAt: T0.toISOString() }] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('同步引擎透過 storeRepo.write 寫回的資料不通知，寫回之後的使用者修改照常通知', () => {
    const onChange = vi.fn();
    stop = trackDataChanges(onChange);
    storeRepo.write(emptySnapshot({ characters: [character('remote')], tasks: [task('t1', 'remote')] }));
    expect(onChange).not.toHaveBeenCalled();
    useCharacterStore.setState({ characters: [character('remote'), character('mine')] });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('停止追蹤後不再通知', () => {
    const onChange = vi.fn();
    trackDataChanges(onChange)();
    useCharacterStore.setState({ characters: [character('c1')] });
    expect(onChange).not.toHaveBeenCalled();
  });
});
