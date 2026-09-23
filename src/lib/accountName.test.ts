import { describe, expect, it } from 'vitest';
import type { Account } from '@/types';
import { validateAccountName } from '@/lib/accountName';

const accounts: Account[] = [
  { id: 'a', name: '主力', order: 0 },
  { id: 'b', name: '小號', order: 1 },
];

describe('validateAccountName', () => {
  it('合法名稱與空白都回傳 null', () => {
    expect(validateAccountName('新帳號', accounts)).toBeNull();
    expect(validateAccountName('   ', accounts)).toBeNull();
  });

  it('超過長度上限回報錯誤', () => {
    expect(validateAccountName('字'.repeat(21), accounts)).toContain('最多');
  });

  it('保留名稱「未歸類」不能使用', () => {
    expect(validateAccountName(' 未歸類 ', accounts)).toContain('保留');
  });

  it('與其他帳號同名回報錯誤(比對 trim 後的名稱)', () => {
    expect(validateAccountName(' 主力 ', accounts)).toContain('相同名稱');
  });

  it('重新命名時排除自己:沿用原名不算同名,撞到別人才算', () => {
    expect(validateAccountName('主力', accounts, 'a')).toBeNull();
    expect(validateAccountName('小號', accounts, 'a')).toContain('相同名稱');
  });
});
