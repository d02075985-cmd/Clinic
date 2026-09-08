const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeMoneyInput(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[٫٬،]/g, (separator) => (separator === '٫' ? '.' : ''))
    .replace(/,/g, '');
}

export function moneyToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  const normalized = normalizeMoneyInput(String(value).trim());
  if (!/^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;

  const sign = normalized.startsWith('-') ? -1 : 1;
  const unsigned = normalized.replace(/^-/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  return sign * (Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0')));
}

export function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatMoney(
  value: string | number | null | undefined,
  language = 'en',
): string {
  const cents = moneyToCents(value);
  if (cents === null) return '0.00';

  return new Intl.NumberFormat(language.startsWith('ar') ? 'ar-KW' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatNumber(value: number | string, language = 'en'): string {
  const numericValue = typeof value === 'number' ? value : Number(normalizeMoneyInput(value));
  if (!Number.isFinite(numericValue)) return '0';
  return new Intl.NumberFormat(language.startsWith('ar') ? 'ar-KW' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function roundDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.floor((numerator + denominator / 2) / denominator);
}
