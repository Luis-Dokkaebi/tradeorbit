import { reconcile } from './reconciliation';
import type { TradeDocument } from '../shared/schemas';

const doc = (id: string, type: TradeDocument['type'], fields: Record<string, string>, status: TradeDocument['status'] = 'extraido'): TradeDocument => ({
  id, orgId: 'o', shipmentId: 's', type, fileName: `${id}.pdf`, status, uploadedAt: '2026-11-24T00:00:00.000Z',
  fields: Object.entries(fields).map(([key, value]) => ({ key, label: key, value, confidence: 0.98, needsReview: false, source: { documentId: id, page: 1, box: [0, 0, 1, 1] } })),
});

describe('reconciliation (US-09, T-014)', () => {
  it('clean seed case: balance matches the hand calculation and status is conciliado', () => {
    const r = reconcile({
      orderedAmount: '5480.00', orderedQty: 200, delivered: true,
      documents: [doc('f', 'factura', { importe: '5480.00' }), doc('p', 'comprobante_pago', { importe: '5480.00' }), doc('l', 'lista_empaque', { cantidad: '200' })],
    });
    expect(r).toMatchObject({ invoiced: '5480.00', paid: '5480.00', balance: '0.00', receivedQty: 200, status: 'conciliado' });
  });

  it('30% advance paid, not delivered: pendiente with 3,836.00 USD to pay', () => {
    const r = reconcile({
      orderedAmount: '5480.00', orderedQty: 200, delivered: false,
      documents: [doc('f', 'factura', { importe: '5480.00' }), doc('p', 'comprobante_pago', { importe: '1644.00' }), doc('l', 'lista_empaque', { cantidad: '200' })],
    });
    expect(r.balance).toBe('3836.00'); // 5,480.00 − 1,644.00
    expect(r.status).toBe('pendiente');
    expect(r.reasons).toContain('Mercancía aún no recibida');
  });

  it('invoice above order and short packing: con_diferencia', () => {
    const r = reconcile({
      orderedAmount: '5480.00', orderedQty: 200, delivered: false,
      documents: [doc('f', 'factura', { importe: '5840.00' }), doc('p', 'comprobante_pago', { importe: '1644.00' }), doc('l', 'lista_empaque', { cantidad: '180' })],
    });
    expect(r.status).toBe('con_diferencia');
    expect(r.balance).toBe('4196.00');
    expect(r.reasons).toHaveLength(2);
  });

  it('documents in manual review are not counted', () => {
    const r = reconcile({ orderedAmount: '5480.00', orderedQty: 200, delivered: false, documents: [doc('f', 'factura', { importe: '5480.00' }, 'revision_manual')] });
    expect(r.invoiced).toBe('0.00');
    expect(r.reasons).toContain('Falta la factura comercial');
    expect(r.status).toBe('pendiente');
  });

  it('overpayment is a difference', () => {
    const r = reconcile({ orderedAmount: '100.00', orderedQty: 1, delivered: true, documents: [doc('f', 'factura', { importe: '100.00' }), doc('p', 'comprobante_pago', { importe: '120.00' })] });
    expect(r.status).toBe('con_diferencia');
  });
});
