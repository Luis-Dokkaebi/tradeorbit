import type { TariffRule } from '../../shared/schemas';

/**
 * Versioned tariff table (principle 6). Every row has source, date and validity.
 * DEMO row: the fraction, NICO and rate MUST be verified against the DOF before showing the demo
 * (SDD § Lista de verificación). Until then `verification` stays 'por_verificar' and the UI says so.
 */
export const TARIFF_RULES: readonly TariffRule[] = [
  {
    hsCode: '6205.20.01',
    nico: null,
    description: 'Camisas de algodón para hombres o niños (tejido plano)',
    rate: '0.35',
    noms: [{ code: 'NOM-004-SE-2021', title: 'Información comercial — etiquetado de productos textiles, prendas de vestir y sus accesorios' }],
    source: 'TIGIE — Decreto DOF 19/12/2024 (confección, países sin tratado comercial). Fila DEMO: verificar fracción, NICO y tasa contra el DOF vigente.',
    publishedAt: '2024-12-19',
    validFrom: '2024-12-20',
    validTo: null,
    verification: 'por_verificar',
    version: 1,
  },
];

/** Fixed-rate contributions with their legal source. */
export const DTA_RATE = { rate: '0.008', source: 'Ley Federal de Derechos, art. 49 fr. I — 8 al millar sobre el valor en aduana · v1 · vigencia por confirmar contra la LFD 2026 (DEMO)' } as const;
export const IVA_RATE = { rate: '0.16', source: 'Ley del IVA, arts. 1 y 27 — base: valor en aduana + IGI + DTA · v1 · tasa general vigente desde 2010' } as const;
