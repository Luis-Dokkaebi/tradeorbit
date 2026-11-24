import { allSeedDocuments, seedLibrary } from '../server/seed/scenarios';
import { extractFields, LOW_CONFIDENCE_THRESHOLD } from './extraction';

const TODAY = '2026-11-24';

describe('extraction eval on the seed set (US-02, NFR-01, NFR-02)', () => {
  const docs = allSeedDocuments(TODAY);

  it('seed set has 3 purchase orders and 12 supporting documents covering the 4 types', () => {
    expect(docs.filter((d) => d.type === 'orden_compra')).toHaveLength(3);
    const support = docs.filter((d) => d.type !== 'orden_compra');
    expect(support).toHaveLength(12);
    expect(new Set(support.map((d) => d.type))).toEqual(new Set(['factura', 'lista_empaque', 'comprobante_pago', 'transporte']));
  });

  it('reaches at least 95% correct fields against ground truth', () => {
    let total = 0;
    let correct = 0;
    for (const doc of docs) {
      const { fields } = extractFields(doc.id, doc.type, doc.pages);
      for (const [key, expected] of Object.entries(doc.truth)) {
        total += 1;
        if (fields.find((f) => f.key === key)?.value === expected) correct += 1;
      }
    }
    expect(total).toBeGreaterThan(80);
    expect(correct / total).toBeGreaterThanOrEqual(0.95);
  });

  it('every extracted field records page and box of origin', () => {
    for (const doc of docs) {
      for (const f of extractFields(doc.id, doc.type, doc.pages).fields) {
        expect(f.source.documentId).toBe(doc.id);
        expect(f.source.page).toBeGreaterThanOrEqual(1);
        expect(f.source.box).toHaveLength(4);
      }
    }
  });

  it('extracts a one-page document well under 20 s (p95 budget)', () => {
    const doc = docs[0];
    if (!doc) throw new Error('no seed');
    const t0 = performance.now();
    for (let i = 0; i < 50; i += 1) extractFields(doc.id, doc.type, doc.pages);
    expect((performance.now() - t0) / 50).toBeLessThan(20_000);
  });

  it('flags the noisy ETA line below the 0.80 threshold', () => {
    const po = seedLibrary('discrepancia', TODAY).find((d) => d.type === 'orden_compra');
    if (!po) throw new Error('no PO');
    const eta = extractFields(po.id, po.type, po.pages).fields.find((f) => f.key === 'fecha_estimada');
    expect(eta?.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    expect(eta?.needsReview).toBe(true);
  });

  it('respects a configurable threshold', () => {
    const po = seedLibrary('discrepancia', TODAY).find((d) => d.type === 'orden_compra');
    if (!po) throw new Error('no PO');
    const eta = extractFields(po.id, po.type, po.pages, 0.5).fields.find((f) => f.key === 'fecha_estimada');
    expect(eta?.needsReview).toBe(false);
  });

  it('sends an unreadable scan to manual review', () => {
    const scan = seedLibrary('discrepancia', TODAY).find((d) => d.id.endsWith('-ILEG'));
    if (!scan) throw new Error('no scan');
    expect(extractFields(scan.id, scan.type, scan.pages).status).toBe('revision_manual');
  });
});
