/**
 * 將收益數字轉成「億/萬」複合單位的顯示字串,完整保留精度不做四捨五入,
 * 例如 7059750 -> 705萬9750、990841916 -> 9億9084萬1916、14500000 -> 1450萬。
 * 有更高單位時,低位段落補零到四位避免誤讀;未滿一萬的數字維持千分位原樣顯示。
 *
 * @param value 收益數字(楓幣)
 * @returns 複合單位的顯示字串
 */
export function formatCrystalValue(value: number): string {
  if (value < 10_000) return value.toLocaleString('zh-TW');
  const yi = Math.floor(value / 100_000_000);
  const wan = Math.floor(value / 10_000) % 10_000;
  const rest = value % 10_000;
  let result = '';
  if (yi > 0) result += `${yi}億`;
  if (wan > 0 || (yi > 0 && rest > 0)) {
    result += `${yi > 0 ? String(wan).padStart(4, '0') : wan}萬`;
  }
  if (rest > 0) result += String(rest).padStart(4, '0');
  return result;
}

/**
 * 將收益四捨五入到「萬」後格式化,給空間有限的精簡顯示用(角色頁 Header 收合版)。
 * 未滿一萬維持 formatCrystalValue 的原樣顯示;有億時萬段補零到四位,四捨五入後剛好整億則不帶萬段。
 * 例如 41529750 -> 4153萬(約略值)、150000000 -> 1億5000萬(精確值)、99995000 -> 1億(約略值)。
 * @param value 收益數字(楓幣)
 * @returns text 為顯示字串;approximate 表示是否經過捨入,顯示時要在前面加「≈」
 */
export function formatCrystalValueToWan(value: number): { text: string; approximate: boolean } {
  if (value < 10_000) return { text: formatCrystalValue(value), approximate: false };
  const totalWan = Math.round(value / 10_000);
  const yi = Math.floor(totalWan / 10_000);
  const wan = totalWan % 10_000;
  let text = yi > 0 ? `${yi}億` : '';
  if (wan > 0) text += `${yi > 0 ? String(wan).padStart(4, '0') : wan}萬`;
  return { text, approximate: totalWan * 10_000 !== value };
}