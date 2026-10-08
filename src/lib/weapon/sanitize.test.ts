import { describe, expect, it } from 'vitest';
import { sanitizeWeaponSnapshot } from './sanitize';
import { adjust, at } from './testUtils';
import { emptyWeaponSnapshot } from './types';

describe('sanitizeWeaponSnapshot', () => {
  it('不是物件或缺少欄位時回傳空的武器進度', () => {
    expect(sanitizeWeaponSnapshot(undefined)).toEqual(emptyWeaponSnapshot());
    expect(sanitizeWeaponSnapshot('x')).toEqual(emptyWeaponSnapshot());
    expect(sanitizeWeaponSnapshot({ events: null, profiles: 3 })).toEqual(emptyWeaponSnapshot());
  });

  it('丟掉缺 id 或 characterId 的項目與損毀的墓碑，存檔點補齊缺少的武器欄位', () => {
    const good = adjust(at(2026, 10, 1), { weapon: 'genesis', stage: 1, pool: 0 });
    const result = sanitizeWeaponSnapshot({
      events: [null, { id: 'x' }, good],
      checkpoints: [{ id: 'c1', watermark: '', rulesVersion: 1, updatedAt: '', state: { genesis: { status: 'active' } } }],
      tombstones: [{ id: 'event:a', deletedAt: '2026-10-01T00:00:00.000Z' }, { id: 1 }, { id: 'event:b' }],
    });
    expect(result.events).toEqual([good]);
    expect(result.checkpoints[0].state.soul.status).toBe('unset');
    expect(result.checkpoints[0].state.genesis).toMatchObject({ status: 'active', stage: 1, pool: 0 });
    expect(result.tombstones).toEqual([{ id: 'event:a', deletedAt: '2026-10-01T00:00:00.000Z' }]);
  });
});
