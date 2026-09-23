import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardStore } from '@/store/useBoardStore';

describe('useBoardStore', () => {
  const now = new Date(2026, 8, 21, 10, 0);

  beforeEach(() => {
    useBoardStore.setState({ collapseOverrides: {} });
  });

  it('setAccountCollapse 記下收合結果、設定當下的 allDone 與日期', () => {
    useBoardStore.getState().setAccountCollapse('a1', true, false, now);
    expect(useBoardStore.getState().collapseOverrides).toEqual({
      a1: { collapsed: true, allDoneWhenSet: false, dateWhenSet: '2026-09-21' },
    });
  });

  it('同一個帳號再設定一次會覆蓋舊值,不影響其他帳號', () => {
    const { setAccountCollapse } = useBoardStore.getState();
    setAccountCollapse('a1', true, false, now);
    setAccountCollapse('a2', false, true, now);
    setAccountCollapse('a1', false, true, now);
    expect(useBoardStore.getState().collapseOverrides).toEqual({
      a1: { collapsed: false, allDoneWhenSet: true, dateWhenSet: '2026-09-21' },
      a2: { collapsed: false, allDoneWhenSet: true, dateWhenSet: '2026-09-21' },
    });
  });
});
