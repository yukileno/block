/**
 * 全角数字（０〜９）を半角数字（0〜9）に変換し、数字以外の不要な文字を除去する
 */
export function normalizeZenToHan(str: string): string {
  return str
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

/**
 * ユーザー入力文字列から安全に正の整数をパースする
 * 全角数字も自動的に半角数字として解釈される
 */
export function parseNumericInput(val: string): number {
  const normalized = normalizeZenToHan(val.trim());
  if (!normalized) return 0;
  const num = Number.parseInt(normalized, 10);
  return Number.isNaN(num) ? 0 : num;
}
