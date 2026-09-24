import { describe, expect, it } from 'vitest';
import { getInitialOpenCategories } from './pickerCategories';

describe('getInitialOpenCategories', () => {
  it('還能選的分類全部展開', () => {
    const open = getInitialOpenCategories([
      { key: '每日', done: false },
      { key: '每週', done: false },
      { key: '每月', done: false },
    ]);
    expect([...open]).toEqual(['每日', '每週', '每月']);
  });

  it('全部已加入的分類收合', () => {
    const open = getInitialOpenCategories([
      { key: '每日', done: true },
      { key: '每週', done: false },
    ]);
    expect([...open]).toEqual(['每週']);
  });

  it('所有分類都已加入時全部收合', () => {
    const open = getInitialOpenCategories([
      { key: '每日', done: true },
      { key: '每週', done: true },
    ]);
    expect(open.size).toBe(0);
  });
});
