import { describe, expect, it } from 'vitest';
import { findAddedPresetIds } from './presetTasks';

describe('findAddedPresetIds', () => {
  it('角色已有同名任務的一般預設任務視為已加入', () => {
    const added = findAddedPresetIds(new Set(['冒險日誌 - 簽到']), 260);
    expect(added.has('frieren-diary-check-in')).toBe(true);
    expect(added.has('maplestroy-academy')).toBe(false);
  });

  it('地區群組要所有已解鎖區域都已建立才算已加入', () => {
    // 等級 210 只解鎖消逝的旅途與啾啾愛爾蘭
    expect(findAddedPresetIds(new Set(['消逝的旅途']), 210).has('arcane-river-daily')).toBe(false);
    expect(findAddedPresetIds(new Set(['消逝的旅途', '啾啾愛爾蘭']), 210).has('arcane-river-daily')).toBe(true);
  });

  it('角色升級解鎖新區域後,群組變回未加入', () => {
    const names = new Set(['消逝的旅途', '啾啾愛爾蘭']);
    expect(findAddedPresetIds(names, 220).has('arcane-river-daily')).toBe(false);
  });

  it('等級不足、一個區域都沒解鎖的群組不算已加入', () => {
    expect(findAddedPresetIds(new Set(), 100).has('grandis-daily')).toBe(false);
  });
});
