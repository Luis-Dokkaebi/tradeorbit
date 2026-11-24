import { dec } from '../shared/money';
import type { DiscrepancyType, TradeDocument } from '../shared/schemas';

export interface DetectedDiscrepancy {
  type: DiscrepancyType;
  severity: 'alta' | 'media' | 'baja';
  documentIds: [string, string];
  expected: string;
  found: string;
  task: string;
}

const CORPORATE_SUFFIXES = /\b(co|company|ltd|limited|inc|corp|sa|de|cv|s\.a\.|c\.v\.)\b/g;

/** Normalizes supplier names so casing, punctuation and corporate suffixes never raise false alerts. */
export const normalizeSupplier = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(CORPORATE_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const value = (doc: TradeDocument, key: string): string | undefined => doc.fields.find((f) => f.key === key)?.value;

interface Rule {
  type: DiscrepancyType;
  against: TradeDocument['type'];
  key: string;
  severity: DetectedDiscrepancy['severity'];
  equal: (a: string, b: string) => boolean;
  task: (doc: TradeDocument, expected: string, found: string) => string;
}

const RULES: readonly Rule[] = [
  {
    type: 'importe', against: 'factura', key: 'importe', severity: 'alta',
    equal: (a, b) => dec(a).equals(dec(b)),
    task: (doc, e, f) => `Pedir al proveedor factura corregida (${doc.fileName}): importe ${f} USD contra ${e} USD de la orden de compra.`,
  },
  {
    type: 'cantidad', against: 'factura', key: 'cantidad', severity: 'media',
    equal: (a, b) => Number(a) === Number(b),
    task: (doc, e, f) => `Confirmar con el proveedor la cantidad facturada en ${doc.fileName}: ${f} contra ${e} piezas ordenadas.`,
  },
  {
    type: 'cantidad', against: 'lista_empaque', key: 'cantidad', severity: 'media',
    equal: (a, b) => Number(a) === Number(b),
    task: (doc, e, f) => `Confirmar faltante con el proveedor y el agente de carga: ${doc.fileName} declara ${f} piezas contra ${e} ordenadas.`,
  },
  {
    type: 'proveedor', against: 'factura', key: 'proveedor', severity: 'alta',
    equal: (a, b) => normalizeSupplier(a) === normalizeSupplier(b),
    task: (doc, e, f) => `Verificar la identidad del emisor de ${doc.fileName}: "${f}" no coincide con "${e}". No pagar hasta confirmar.`,
  },
  {
    type: 'proveedor', against: 'lista_empaque', key: 'proveedor', severity: 'media',
    equal: (a, b) => normalizeSupplier(a) === normalizeSupplier(b),
    task: (doc, e, f) => `Aclarar el emisor de ${doc.fileName}: "${f}" contra "${e}".`,
  },
];

/** Cross-checks the purchase order against each supporting document (US-03). Evidence always cites two documents. */
export const detectDiscrepancies = (purchaseOrder: TradeDocument, documents: readonly TradeDocument[]): DetectedDiscrepancy[] => {
  const found: DetectedDiscrepancy[] = [];
  for (const rule of RULES) {
    const expected = value(purchaseOrder, rule.key);
    if (expected === undefined) continue;
    for (const doc of documents.filter((d) => d.type === rule.against && d.status === 'extraido')) {
      const actual = value(doc, rule.key);
      if (actual === undefined || rule.equal(expected, actual)) continue;
      found.push({
        type: rule.type,
        severity: rule.severity,
        documentIds: [purchaseOrder.id, doc.id],
        expected,
        found: actual,
        task: rule.task(doc, expected, actual),
      });
    }
  }
  return found;
};
