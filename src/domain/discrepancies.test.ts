import { extractFields } from './extraction';
import { detectDiscrepancies, normalizeSupplier } from './discrepancies';
import { purchaseOrderFor, supportingDocumentsFor, type SeedDocument } from '../server/seed/documents';
import type { ScenarioName, TradeDocument } from '../shared/schemas';

const TODAY = '2026-11-24';
const toDoc = (s: SeedDocument): TradeDocument => {
  const r = extractFields(s.id, s.type, s.pages);
  return { id: s.id, orgId: 'o', shipmentId: 'SHP-0001', type: s.type, fileName: s.fileName, status: r.status, fields: r.fields, uploadedAt: `${TODAY}T00:00:00.000Z` };
};
const run = (scenario: ScenarioName) => detectDiscrepancies(toDoc(purchaseOrderFor(scenario, TODAY)), supportingDocumentsFor(scenario, TODAY).map(toDoc));

describe('discrepancy detection (US-03, T-012)', () => {
  it('detects exactly the 3 planted discrepancies: amount, quantity and supplier', () => {
    const found = run('discrepancia');
    expect(found.map((d) => d.type).sort()).toEqual(['cantidad', 'importe', 'proveedor']);
    for (const d of found) {
      expect(d.documentIds).toHaveLength(2);
      expect(d.task.length).toBeGreaterThan(10);
      expect(['alta', 'media', 'baja']).toContain(d.severity);
    }
  });

  it('raises no alerts for clean documents (no false positives)', () => {
    expect(run('limpio')).toEqual([]);
    expect(run('retraso')).toEqual([]);
  });

  it('normalizes casing, punctuation and corporate suffixes', () => {
    expect(normalizeSupplier('DONGYUAN MUESTRA GARMENTS CO LTD')).toBe(normalizeSupplier('Dongyuan Muestra Garments Co., Ltd.'));
    expect(normalizeSupplier('Dongyuan Muestra Apparel Trading Co., Ltd.')).not.toBe(normalizeSupplier('Dongyuan Muestra Garments Co., Ltd.'));
  });
});
