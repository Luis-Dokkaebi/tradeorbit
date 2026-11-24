import { dec, sum } from '../shared/money';
import { grossUsd, quoteAllRoutes } from './paymentRoutes';

describe('payment routes (US-05, T-020)', () => {
  it('100,000 MXN at 18.25 gives 5,479.45 USD gross', () => {
    expect(grossUsd('100000', '18.25')).toBe('5479.45');
  });

  it('shows at least two routes: bank and stablecoin rail', () => {
    const routes = quoteAllRoutes('100000', '18.25');
    expect(routes.map((r) => r.key)).toEqual(['banco', 'riel_stablecoin']);
  });

  it('breakdown explains every difference between gross and net', () => {
    for (const r of quoteAllRoutes('100000', '18.25')) {
      const fees = sum(r.fees.map((f) => dec(f.amount)));
      expect(dec(r.grossUsd).minus(fees).toFixed(2)).toBe(r.netUsd);
    }
  });

  it('matches the hand-computed nets', () => {
    const [bank, rail] = quoteAllRoutes('100000', '18.25');
    // bank: 82.19 + 35.00 + 20.00 = 137.19 → 5,342.26
    expect(bank?.fees.map((f) => f.amount)).toEqual(['82.19', '35.00', '20.00']);
    expect(bank?.netUsd).toBe('5342.26');
    // rail: 32.88 + 1.00 + 27.40 = 61.28 → 5,418.17
    expect(rail?.fees.map((f) => f.amount)).toEqual(['32.88', '1.00', '27.40']);
    expect(rail?.netUsd).toBe('5418.17');
  });

  it('rejects a non-positive rate', () => {
    expect(() => grossUsd('100000', '0')).toThrow();
  });
});
