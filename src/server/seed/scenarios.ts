import { extractFields } from '../../domain/extraction';
import { addDays } from '../../shared/dates';
import type { DocumentType, Policy, ScenarioName, Shipment, ShipmentEvent, TradeDocument } from '../../shared/schemas';
import { emptyTables, type Tables } from '../state';
import { illegibleDocument, purchaseOrderFor, SCENARIO_FACTS, SUPPLIER_NAME, supportingDocumentsFor, type SeedDocument } from './documents';

/** DEMO reference exchange rate MXN per USD (SDD US-05). Labelled DEMO wherever shown. */
export const DEMO_FX_RATE = '18.25';

export interface SeedLibraryItem {
  id: string;
  type: DocumentType;
  fileName: string;
  pages: string[][];
  note: string;
}

export const SCENARIOS: readonly { name: ScenarioName; label: string; summary: string }[] = [
  { name: 'limpio', label: 'Limpio', summary: 'Documentos consistentes, pagado y entregado: se concilia sin intervención.' },
  { name: 'discrepancia', label: 'Con discrepancia', summary: 'Se abre el expediente en vivo y la factura trae 3 errores plantados.' },
  { name: 'retraso', label: 'Con retraso', summary: 'La fecha estimada de arribo ya venció y no hay evento de arribo.' },
];

const LIBRARY_NOTES: Record<DocumentType, string> = {
  orden_compra: 'Abre el expediente',
  factura: 'Factura comercial del proveedor',
  lista_empaque: 'Detalle de cajas y piezas',
  comprobante_pago: 'Anticipo del 30% ya pagado por el importador',
  transporte: 'BL de la naviera',
};

const toLibrary = (d: SeedDocument): SeedLibraryItem => ({ id: d.id, type: d.type, fileName: d.fileName, pages: d.pages, note: LIBRARY_NOTES[d.type] });

/** Documents the presenter can "upload" in the current scenario. */
export const seedLibrary = (scenario: ScenarioName, today: string): SeedLibraryItem[] => {
  if (scenario !== 'discrepancia') return [];
    return [
    purchaseOrderFor(scenario, today),
    ...supportingDocumentsFor(scenario, today),
    { ...illegibleDocument(SCENARIO_FACTS(today).discrepancia.docPrefix), scenario },
  ].map((d) => (d.id.endsWith('-ILEG') ? { ...toLibrary(d), note: 'Escaneo ilegible: debe pasar a revisión manual sin bloquear' } : toLibrary(d)));
};

/** All seed documents of every scenario (used by the extraction eval, NFR-02). */
export const allSeedDocuments = (today: string): SeedDocument[] =>
  (['limpio', 'discrepancia', 'retraso'] as const).flatMap((s) => [purchaseOrderFor(s, today), ...supportingDocumentsFor(s, today)]);

const POLICIES = (orgId: string): Policy[] => [
  { id: 'POL-001', orgId, agent: 'documental', version: 'v1.2', scope: 'Extracción y cruce de documentos', status: 'activa', proposedBy: 'equipo', approvedBy: 'Responsable de gobernanza (DEMO)', evaluation: { fieldAccuracy: '1.00', plantedFound: 3, falsePositives: 0, repetitions: 5 } },
  { id: 'POL-002', orgId, agent: 'documental', version: 'v1.3-sandbox', scope: 'Normalización agresiva de nombres de proveedor', status: 'sandbox', proposedBy: 'proponente_politicas', approvedBy: null, evaluation: { fieldAccuracy: '0.97', plantedFound: 2, falsePositives: 1, repetitions: 5 } },
  { id: 'POL-003', orgId, agent: 'financiero', version: 'v1.0', scope: 'Rutas de pago en modo solo proponer', status: 'activa', proposedBy: 'equipo', approvedBy: 'Responsable de gobernanza (DEMO)', evaluation: null },
  { id: 'POL-004', orgId, agent: 'aranceles_costo', version: 'v1.0', scope: 'Costo puesto con tabla versionada', status: 'activa', proposedBy: 'equipo', approvedBy: 'Responsable de gobernanza (DEMO)', evaluation: null },
];

const preloadedEvents = (scenario: ScenarioName, today: string, orgId: string, shipmentId: string, next: () => string): ShipmentEvent[] => {
  const f = SCENARIO_FACTS(today)[scenario];
  const ev = (type: ShipmentEvent['type'], date: string, estimated: boolean): ShipmentEvent => ({ id: next(), orgId, shipmentId, type, date, estimated, origin: 'demo' });
  const common = [ev('orden_confirmada', f.poDate, false), ev('embarque', f.sail, false), ev('transito', addDays(f.sail, 1), false)];
  if (scenario === 'limpio') {
    return [...common, ev('arribo', f.eta, false), ev('liberacion', addDays(f.eta, 1), false), ev('entrega', addDays(f.eta, 3), false)];
  }
  return [...common, ev('arribo', f.eta, true), ev('liberacion', addDays(f.eta, 2), true), ev('entrega', addDays(f.eta, 4), true)];
};

const toDocument = (seed: SeedDocument, orgId: string, shipmentId: string, at: string): TradeDocument => {
  const extraction = extractFields(seed.id, seed.type, seed.pages);
  return { id: seed.id, orgId, shipmentId, type: seed.type, fileName: seed.fileName, status: extraction.status, fields: extraction.fields, uploadedAt: at };
};

export const seedScenario = (scenario: ScenarioName, today: string, orgId: string): { tables: Tables; nextSeq: number } => {
  let seq = 0;
  const next = (prefix: string) => () => `${prefix}-${String(++seq).padStart(4, '0')}`;
  const at = `${today}T09:00:00.000Z`;
  const tables: Tables = {
    ...emptyTables(),
    organizations: [{ id: orgId, name: 'Camisería Ejemplo del Bajío (DEMO)' }],
    suppliers: [{ id: 'SUP-0001', orgId, name: SUPPLIER_NAME, country: 'CN', kybStatus: 'demo_verificado', demo: true }],
    policies: POLICIES(orgId),
  };
  if (scenario === 'discrepancia') return { tables, nextSeq: seq };

  const po = purchaseOrderFor(scenario, today);
  const shipmentId = 'SHP-0001';
  const poDoc = toDocument(po, orgId, shipmentId, at);
  const get = (k: string): string => poDoc.fields.find((f) => f.key === k)?.value ?? '';
  const shipment: Shipment = {
    id: shipmentId, orgId, supplierId: 'SUP-0001', status: 'abierto', goods: get('mercancia'), hsCode: null,
    quantity: Number(get('cantidad')), unit: 'piezas', amount: get('importe'), currency: 'USD', eta: get('fecha_estimada'),
    incoterm: get('incoterm'), scenario, fields: poDoc.fields, createdAt: at,
  };
  const docs = supportingDocumentsFor(scenario, today).map((d) => toDocument(d, orgId, shipmentId, at));
  return {
    tables: { ...tables, shipments: [shipment], documents: [poDoc, ...docs], shipment_events: preloadedEvents(scenario, today, orgId, shipmentId, next('EVT')) },
    nextSeq: seq,
  };
};
