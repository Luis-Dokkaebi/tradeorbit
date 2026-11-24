import { cents, dec, sum } from '../shared/money';
import type { CostComponent, LandedCostInput, TariffRule } from '../shared/schemas';

export interface LandedCostBreakdown {
  components: CostComponent[];
  customsValueMxn: string;
  totalMxn: string;
  perUnitMxn: string;
}

export interface RateSource {
  rate: string;
  source: string;
}

export const findTariffRule = (rules: readonly TariffRule[], hsCode: string, onDate: string): TariffRule | null =>
  rules
    .filter((r) => r.hsCode === hsCode.trim() && r.validFrom <= onDate && (r.validTo === null || r.validTo >= onDate))
    .sort((a, b) => b.version - a.version)[0] ?? null;

const pct = (rate: string): string => `${dec(rate).times(100).toString()}%`;

/**
 * Landed cost in MXN (US-04): goods + freight/insurance (customs value) + IGI + DTA + IVA + broker fees.
 * Each component is rounded to cents; the total is the sum of the rounded components.
 */
export const computeLandedCost = (
  input: LandedCostInput,
  rule: TariffRule,
  dtaRate: RateSource,
  ivaRate: RateSource,
): LandedCostBreakdown => {
  const fx = dec(input.fxRate);
  const goods = dec(cents(dec(input.goodsValueUsd).times(fx)));
  const freight = dec(cents(dec(input.freightUsd).plus(input.insuranceUsd).times(fx)));
  const customsValue = goods.plus(freight);
  const igi = dec(cents(customsValue.times(rule.rate)));
  const dta = dec(cents(customsValue.times(dtaRate.rate)));
  const iva = dec(cents(customsValue.plus(igi).plus(dta).times(ivaRate.rate)));
  const fees = dec(cents(dec(input.brokerFeesMxn)));

  const components: CostComponent[] = [
    {
      key: 'mercancia',
      label: 'Valor de la mercancía',
      amountMxn: cents(goods),
      basis: `${input.goodsValueUsd} USD × ${input.fxRate} MXN/USD`,
      source: 'Factura comercial · tipo de cambio de referencia',
    },
    {
      key: 'flete_seguro',
      label: 'Flete y seguro',
      amountMxn: cents(freight),
      basis: `(${input.freightUsd} + ${input.insuranceUsd}) USD × ${input.fxRate} MXN/USD`,
      source: 'Cotización de flete',
    },
    {
      key: 'igi',
      label: 'Arancel (IGI)',
      amountMxn: cents(igi),
      basis: `${pct(rule.rate)} × valor en aduana ${cents(customsValue)} MXN`,
      source: `Fracción ${rule.hsCode} v${rule.version} · ${rule.source}`,
    },
    {
      key: 'dta',
      label: 'Derecho de trámite aduanero (DTA)',
      amountMxn: cents(dta),
      basis: `${pct(dtaRate.rate)} × valor en aduana`,
      source: dtaRate.source,
    },
    {
      key: 'iva',
      label: 'IVA de importación',
      amountMxn: cents(iva),
      basis: `${pct(ivaRate.rate)} × (valor en aduana + IGI + DTA)`,
      source: ivaRate.source,
    },
    {
      key: 'honorarios',
      label: 'Honorarios del agente aduanal',
      amountMxn: cents(fees),
      basis: 'Editable por el importador (sin IVA)',
      source: 'Captura del importador',
    },
  ];
  const total = sum(components.map((c) => dec(c.amountMxn)));
  return {
    components,
    customsValueMxn: cents(customsValue),
    totalMxn: cents(total),
    perUnitMxn: cents(total.dividedBy(input.quantity)),
  };
};
