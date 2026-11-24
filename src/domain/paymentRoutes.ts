import { cents, dec, sum } from '../shared/money';
import type { FeeLine, PaymentRouteKey } from '../shared/schemas';

/** Illustrative route definitions: every rate here is an assumption, not a quote from a provider. */
export interface RouteDefinition {
  key: PaymentRouteKey;
  label: string;
  receiveCurrency: 'USD' | 'USDC';
  eta: string;
  fees: readonly { label: string; kind: 'percent' | 'fixed'; value: string }[];
  note: string;
}

export const DEMO_ROUTES: readonly RouteDefinition[] = [
  {
    key: 'banco',
    label: 'Transferencia bancaria internacional (SWIFT)',
    receiveCurrency: 'USD',
    eta: '2 a 4 días hábiles (estimado)',
    fees: [
      { label: 'Diferencial cambiario del banco', kind: 'percent', value: '0.015' },
      { label: 'Comisión de envío SWIFT', kind: 'fixed', value: '35.00' },
      { label: 'Banco intermediario', kind: 'fixed', value: '20.00' },
    ],
    note: 'El proveedor recibe USD en su cuenta bancaria.',
  },
  {
    key: 'riel_stablecoin',
    label: 'Riel con stablecoin intermedio (USDC)',
    receiveCurrency: 'USDC',
    eta: 'Mismo día hábil (estimado)',
    fees: [
      { label: 'Conversión MXN a USDC (entrada)', kind: 'percent', value: '0.006' },
      { label: 'Comisión de red', kind: 'fixed', value: '1.00' },
      { label: 'Liquidación USDC a USD bancario (salida)', kind: 'percent', value: '0.005' },
    ],
    note: 'Riel intermedio: el proveedor cobra dinero bancario en USD. Requiere validación legal en México y Hong Kong antes de un piloto.',
  },
];

export interface RouteQuote {
  key: PaymentRouteKey;
  label: string;
  receiveCurrency: 'USD' | 'USDC';
  eta: string;
  note: string;
  grossUsd: string;
  fees: FeeLine[];
  netUsd: string;
}

/** Gross USD = MXN / rate, rounded to cents half-up (US-05: 100,000 MXN at 18.25 → 5,479.45 USD). */
export const grossUsd = (sendMxn: string, fxRate: string): string => {
  const rate = dec(fxRate);
  if (rate.lte(0)) throw new Error('El tipo de cambio debe ser positivo');
  return cents(dec(sendMxn).dividedBy(rate));
};

export const quoteRoute = (route: RouteDefinition, sendMxn: string, fxRate: string): RouteQuote => {
  const gross = grossUsd(sendMxn, fxRate);
  const fees: FeeLine[] = route.fees.map((f) => ({
    label: f.label,
    basis: f.kind === 'percent' ? `${dec(f.value).times(100).toString()}% × ${gross} USD` : 'Cargo fijo',
    amount: f.kind === 'percent' ? cents(dec(gross).times(f.value)) : cents(dec(f.value)),
    currency: 'USD',
  }));
  const net = dec(gross).minus(sum(fees.map((f) => dec(f.amount))));
  return {
    key: route.key,
    label: route.label,
    receiveCurrency: route.receiveCurrency,
    eta: route.eta,
    note: route.note,
    grossUsd: gross,
    fees,
    netUsd: cents(net),
  };
};

export const quoteAllRoutes = (sendMxn: string, fxRate: string): RouteQuote[] =>
  DEMO_ROUTES.map((r) => quoteRoute(r, sendMxn, fxRate));
