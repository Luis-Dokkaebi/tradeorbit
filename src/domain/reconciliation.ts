import { cents, dec, sum } from '../shared/money';
import type { ReconciliationStatus, TradeDocument } from '../shared/schemas';

export interface ReconciliationInput {
  orderedAmount: string;
  orderedQty: number;
  documents: readonly TradeDocument[];
  delivered: boolean;
  /** Open discrepancies on the file: a file with an open discrepancy is never 'conciliado'. */
  openDiscrepancies?: number;
}

export interface ReconciliationOutcome {
  ordered: string;
  invoiced: string;
  paid: string;
  orderedQty: number;
  receivedQty: number;
  balance: string;
  status: ReconciliationStatus;
  reasons: string[];
  sources: string[];
}

const fieldValue = (doc: TradeDocument, key: string): string | undefined => doc.fields.find((f) => f.key === key)?.value;

/**
 * Crosses order, invoice, payments and reception (US-09).
 * Simulated approvals never count as paid: only a payment-proof document does (principle 1).
 */
export const reconcile = ({ orderedAmount, orderedQty, documents, delivered, openDiscrepancies = 0 }: ReconciliationInput): ReconciliationOutcome => {
  const extracted = documents.filter((d) => d.status === 'extraido');
  const foreign = extracted.filter((d) => (d.type === 'factura' || d.type === 'comprobante_pago') && (fieldValue(d, 'moneda') ?? 'USD') !== 'USD');
  const usable = extracted.filter((d) => !foreign.includes(d));
  const invoices = usable.filter((d) => d.type === 'factura');
  const payments = usable.filter((d) => d.type === 'comprobante_pago');
  const packing = usable.filter((d) => d.type === 'lista_empaque');

  const invoiced = sum(invoices.map((d) => dec(fieldValue(d, 'importe') ?? '0')));
  const paid = sum(payments.map((d) => dec(fieldValue(d, 'importe') ?? '0')));
  const packedQty = packing.reduce((acc, d) => acc + Number(fieldValue(d, 'cantidad') ?? '0'), 0);
  const receivedQty = delivered ? packedQty : 0;
  const balance = invoiced.minus(paid);

  const reasons: string[] = [];
  if (invoices.length === 0) reasons.push('Falta la factura comercial');
  if (invoices.length > 0 && !invoiced.equals(dec(orderedAmount))) {
    reasons.push(`Facturado ${cents(invoiced)} USD distinto de lo ordenado ${cents(dec(orderedAmount))} USD`);
  }
  if (packing.length > 0 && packedQty !== orderedQty) {
    reasons.push(`Empacado ${packedQty} distinto de lo ordenado ${orderedQty}`);
  }
  if (paid.greaterThan(invoiced) && invoices.length > 0) reasons.push('Pagado mayor que facturado');
  for (const d of foreign) reasons.push(`${d.fileName} está en ${fieldValue(d, 'moneda')}: no se suma a USD sin un tipo de cambio verificado`);
  if (openDiscrepancies > 0) reasons.push(`${openDiscrepancies} discrepancia(s) abierta(s) entre documentos`);

  const hasDifference = reasons.some((r) => !r.startsWith('Falta'));
  let status: ReconciliationStatus;
  if (hasDifference) status = 'con_diferencia';
  else if (invoices.length > 0 && balance.isZero() && delivered && receivedQty === orderedQty) status = 'conciliado';
  else status = 'pendiente';

  if (status === 'pendiente') {
    if (balance.greaterThan(0)) reasons.push(`Saldo por pagar ${cents(balance)} USD`);
    if (!delivered) reasons.push('Mercancía aún no recibida');
  }

  return {
    ordered: cents(dec(orderedAmount)),
    invoiced: cents(invoiced),
    paid: cents(paid),
    orderedQty,
    receivedQty,
    balance: cents(balance),
    status,
    reasons,
    sources: [...invoices, ...payments, ...packing].map((d) => d.id),
  };
};
