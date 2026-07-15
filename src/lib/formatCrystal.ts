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