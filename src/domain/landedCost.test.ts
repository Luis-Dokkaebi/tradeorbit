import { computeLandedCost, findTariffRule } from './landedCost';
import { DTA_RATE, IVA_RATE, TARIFF_RULES } from '../server/seed/tariffs';
import { LandedCostInput } from '../shared/schemas';

const input = LandedCostInput.parse({
  hsCode: '6205.20.01',
  goodsValueUsd: '5480.00',
  freightUsd: '420.00',
  fxRate: '18.25',
  brokerFeesMxn: '4500.00',
  quantity: 200,
});

describe('landed cost (US-04, NFR-03)', () => {
  it('finds the versioned rule for the seed fraction', () => {
    const rule = findTariffRule(TARIFF_RULES, '6205.20.01', '2026-11-24');
    expect(rule?.rate).toBe('0.35');
    expect(rule?.source).toMatch(/DOF/);
    expect(rule?.noms.map((n) => n.code)).toContain('NOM-004-SE-2021');
  });

  it('returns null for a fraction that is not in the table', () => {
    expect(findTariffRule(TARIFF_RULES, '8517.13.01', '2026-11-24')).toBeNull();
  });

  it('returns null when the date is before the rule validity', () => {
    expect(findTariffRule(TARIFF_RULES, '6205.20.01', '2020-01-01')).toBeNull();
  });

  it('matches the hand-computed seed case to the cent', () => {
    const rule = findTariffRule(TARIFF_RULES, '6205.20.01', '2026-11-24');
    if (!rule) throw new Error('rule missing');
    const result = computeLandedCost(input, rule, DTA_RATE, IVA_RATE);
    const byKey = Object.fromEntries(result.components.map((c) => [c.key, c.amountMxn]));
    // Hand calculation: 5,480 × 18.25 = 100,010.00 ; 420 × 18.25 = 7,665.00 ; VA = 107,675.00
    expect(byKey).toEqual({
      mercancia: '100010.00',
      flete_seguro: '7665.00',
      igi: '37686.25', // 35% × 107,675.00
      dta: '861.40', // 0.8% × 107,675.00
      iva: '23395.62', // 16% × 146,222.65 = 23,395.624
      honorarios: '4500.00',
    });
    expect(result.customsValueMxn).toBe('107675.00');
    expect(result.totalMxn).toBe('174118.27');
    expect(result.perUnitMxn).toBe('870.59');
  });

  it('every component cites its source', () => {
    const rule = findTariffRule(TARIFF_RULES, '6205.20.01', '2026-11-24');
    if (!rule) throw new Error('rule missing');
    const result = computeLandedCost(input, rule, DTA_RATE, IVA_RATE);
    for (const c of result.components) expect(c.source.length).toBeGreaterThan(5);
  });
});
