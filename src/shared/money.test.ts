import { cents, dec, formatAmount, sum } from './money';
import { addDays, formatDateEs } from './dates';

describe('money (NFR-03)', () => {
  it('avoids binary float error', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(cents(dec('0.1').plus('0.2'))).toBe('0.30');
  });

  it('rounds half-up to the cent', () => {
    expect(cents(dec('23395.624'))).toBe('23395.62');
    expect(cents(dec('0.005'))).toBe('0.01');
    expect(cents(dec('-0.005'))).toBe('-0.01');
  });

  it('sums and formats without passing through floats', () => {
    expect(cents(sum([dec('82.19'), dec('35.00'), dec('20.00')]))).toBe('137.19');
    expect(formatAmount('174118.27')).toBe('174,118.27');
    expect(formatAmount('-1234.5')).toBe('-1,234.50');
    expect(formatAmount('12', 0)).toBe('12');
  });

  it('handles ISO dates in UTC', () => {
    expect(addDays('2026-11-24', 18)).toBe('2026-12-12');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(formatDateEs('2026-12-12')).toBe('12/12/2026');
  });
});
