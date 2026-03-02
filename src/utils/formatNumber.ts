/**
 * Formatage des nombres : séparateur des milliers = point, décimales = virgule.
 * Exemple : 2500.5 → "2.500,50"
 */
export function formatNumber(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  if (!Number.isFinite(value)) return '0,00';
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  const rounded = Number(value.toFixed(maximumFractionDigits));
  const [intPart, decPart] = Math.abs(rounded).toString().split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals =
    decPart != null
      ? decPart.padEnd(minimumFractionDigits, '0').slice(0, maximumFractionDigits)
      : '0'.repeat(minimumFractionDigits);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${withThousands},${decimals}`;
}

/**
 * Même format avec symbole devise (ex: "2.500,00 $US").
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  return `${formatNumber(value, options)} ${currency === 'CDF' ? 'CDF' : '$US'}`;
}
