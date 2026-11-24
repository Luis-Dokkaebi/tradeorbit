import { purchaseOrderFor, supportingDocumentsFor } from '../server/seed/documents';
import type { ScenarioName, TradeDocument } from '../shared/schemas';
import { detectDiscrepancies } from './discrepancies';
import { extractFields } from './extraction';

export interface PolicyEvaluation {
  fieldAccuracy: string;
  plantedFound: number;
  falsePositives: number;
  repetitions: number;
  consistent: boolean;
}

const SCENARIOS: readonly ScenarioName[] = ['limpio', 'discrepancia', 'retraso'];

const toDoc = (id: string, type: TradeDocument['type'], pages: string[][], today: string): TradeDocument => {
  const r = extractFields(id, type, pages);
  return { id, orgId: 'eval', shipmentId: 'EVAL', type, fileName: id, status: r.status, fields: r.fields, uploadedAt: `${today}T00:00:00.000Z` };
};

const runOnce = (today: string): Omit<PolicyEvaluation, 'repetitions' | 'consistent'> => {
  let total = 0;
  let correct = 0;
  let planted = 0;
  let falsePositives = 0;
  for (const scenario of SCENARIOS) {
    const po = purchaseOrderFor(scenario, today);
    const support = supportingDocumentsFor(scenario, today);
    for (const seed of [po, ...support]) {
      const fields = extractFields(seed.id, seed.type, seed.pages).fields;
      for (const [key, expected] of Object.entries(seed.truth)) {
        total += 1;
        if (fields.find((f) => f.key === key)?.value === expected) correct += 1;
      }
    }
    const found = detectDiscrepancies(toDoc(po.id, po.type, po.pages, today), support.map((d) => toDoc(d.id, d.type, d.pages, today)));
    if (scenario === 'discrepancia') planted += new Set(found.map((d) => d.type)).size;
    else falsePositives += found.length;
  }
  return { fieldAccuracy: (correct / total).toFixed(2), plantedFound: planted, falsePositives };
};

/**
 * Promotion gate measured on the synthetic seed set (SDD § Harness de los agentes): accuracy,
 * planted discrepancies and false positives, repeated to require consistency, not a single hit.
 */
export const evaluateActivePolicy = (today: string, repetitions = 5): PolicyEvaluation => {
  const runs = Array.from({ length: repetitions }, () => runOnce(today));
  const first = runs[0] ?? { fieldAccuracy: '0.00', plantedFound: 0, falsePositives: 0 };
  const consistent = runs.every((r) => JSON.stringify(r) === JSON.stringify(first));
  return { ...first, repetitions, consistent };
};
