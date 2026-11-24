import Decimal from 'decimal.js';

/** Exact decimal arithmetic for money (NFR-03). Never use binary floats for amounts. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export const dec = (value: string | number | Dec): Dec => new D(value);

/** Round to cents, half-up, and return a fixed 2-decimal string. */
export const cents = (value: Dec): string => value.toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2);

export const sum = (values: readonly Dec[]): Dec => values.reduce<Dec>((acc, v) => acc.plus(v), dec(0));

/** Format a decimal string for es-MX display without passing through a float. */
export const formatAmount = (value: string, fractionDigits = 2): string => {
  const fixed = dec(value).toFixed(fractionDigits);
  const negative = fixed.startsWith('-');
  const [intPart = '0', frac] = (negative ? fixed.slice(1) : fixed).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`;
};
