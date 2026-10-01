import { describe, expect, it } from 'vitest';
import { formatCrystalValueToWan } from '@/lib/formatCrystal';

describe('formatCrystalValueToWan', () => {
  it('未滿一萬維持原數字,不是約略值', () => {
    expect(formatCrystalValueToWan(0)).toEqual({ text: '0', approximate: false });
    expect(formatCrystalValueToWan(9999)).toEqual({ text: '9,999', approximate: false });
  });

  it('剛好整萬不是約略值', () => {
    expect(formatCrystalValueToWan(150_000_000)).toEqual({ text: '1億5000萬', approximate: false });
    expect(formatCrystalValueToWan(100_050_000)).toEqual({ text: '1億0005萬', approximate: false });
  });

  it('四捨五入到萬並標示為約略值', () => {
    expect(formatCrystalValueToWan(41_529_750)).toEqual({ text: '4153萬', approximate: true });
    expect(formatCrystalValueToWan(823_084_500)).toEqual({ text: '8億2308萬', approximate: true });
  });

  it('進位成整億時不帶萬段', () => {
    expect(formatCrystalValueToWan(99_995_000)).toEqual({ text: '1億', approximate: true });
  });
});
