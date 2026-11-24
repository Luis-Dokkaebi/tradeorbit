import { z } from 'zod';

/**
 * Shared contracts — single source of truth for the 14 entities and the server functions.
 * If a field changes, it changes here first (SDD § Modelo de datos y contratos).
 */

export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Debe ser un decimal en texto, no un flotante');

export const Currency = z.enum(['MXN', 'USD', 'USDC', 'CNY']);
export type Currency = z.infer<typeof Currency>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD');
export const IsoDateTime = z.string().datetime();

export const Organization = z.object({ id: z.string().min(1), name: z.string().min(1) });
export type Organization = z.infer<typeof Organization>;

export const Supplier = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  name: z.string().min(1),
  country: z.string().length(2),
  kybStatus: z.enum(['demo_verificado', 'demo_pendiente']),
  demo: z.literal(true),
});
export type Supplier = z.infer<typeof Supplier>;

export const ScenarioName = z.enum(['limpio', 'discrepancia', 'retraso']);
export type ScenarioName = z.infer<typeof ScenarioName>;

export const ShipmentStatus = z.enum(['abierto', 'en_revision', 'en_transito', 'retraso', 'entregado', 'conciliado']);
export type ShipmentStatus = z.infer<typeof ShipmentStatus>;

export const FieldSource = z.object({
  documentId: z.string().min(1),
  page: z.number().int().min(1),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type FieldSource = z.infer<typeof FieldSource>;

export const ExtractedField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  source: FieldSource,
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const Shipment = z.object({
  id: z.string().regex(/^SHP-\d{4}$/),
  orgId: z.string().min(1),
  supplierId: z.string().min(1),
  status: ShipmentStatus,
  goods: z.string().min(1),
  hsCode: z.string().nullable(),
  quantity: z.number().int().positive(),
  unit: z.string().min(1),
  amount: DecimalString,
  currency: Currency,
  eta: IsoDate,
  incoterm: z.string().min(1),
  scenario: ScenarioName,
  fields: z.array(ExtractedField),
  createdAt: IsoDateTime,
});
export type Shipment = z.infer<typeof Shipment>;

export const DocumentType = z.enum(['orden_compra', 'factura', 'lista_empaque', 'comprobante_pago', 'transporte']);
export type DocumentType = z.infer<typeof DocumentType>;

export const TradeDocument = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipmentId: z.string().min(1),
  type: DocumentType,
  fileName: z.string().min(1),
  status: z.enum(['extraido', 'revision_manual']),
  fields: z.array(ExtractedField),
  uploadedAt: IsoDateTime,
});
export type TradeDocument = z.infer<typeof TradeDocument>;

export const DiscrepancyType = z.enum(['importe', 'cantidad', 'proveedor']);
export type DiscrepancyType = z.infer<typeof DiscrepancyType>;

export const Discrepancy = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipmentId: z.string().min(1),
  type: DiscrepancyType,
  severity: z.enum(['alta', 'media', 'baja']),
  documentIds: z.array(z.string().min(1)).min(2, 'Una discrepancia exige evidencia de dos documentos'),
  expected: z.string(),
  found: z.string(),
  status: z.enum(['abierta', 'resuelta']),
  task: z.string().min(1),
});
export type Discrepancy = z.infer<typeof Discrepancy>;

export const TariffRule = z.object({
  hsCode: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
  nico: z.string().nullable(),
  description: z.string().min(1),
  rate: DecimalString,
  noms: z.array(z.object({ code: z.string().min(1), title: z.string().min(1) })),
  source: z.string().min(1),
  publishedAt: IsoDate,
  validFrom: IsoDate,
  validTo: IsoDate.nullable(),
  verification: z.enum(['verificada', 'por_verificar']),
  version: z.number().int().positive(),
});
export type TariffRule = z.infer<typeof TariffRule>;

export const LandedCostInput = z.object({
  hsCode: z.string().min(1),
  goodsValueUsd: DecimalString,
  freightUsd: DecimalString,
  insuranceUsd: DecimalString.default('0'),
  fxRate: DecimalString,
  brokerFeesMxn: DecimalString,
  quantity: z.number().int().positive(),
});
export type LandedCostInput = z.infer<typeof LandedCostInput>;

export const CostComponent = z.object({
  key: z.enum(['mercancia', 'flete_seguro', 'igi', 'dta', 'iva', 'honorarios']),
  label: z.string(),
  amountMxn: DecimalString,
  basis: z.string(),
  source: z.string(),
});
export type CostComponent = z.infer<typeof CostComponent>;

export const LandedCostQuote = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipmentId: z.string().min(1),
  status: z.literal('calculado'),
  inputs: LandedCostInput,
  components: z.array(CostComponent),
  totalMxn: DecimalString,
  perUnitMxn: DecimalString,
  rule: TariffRule,
  createdAt: IsoDateTime,
});
export type LandedCostQuote = z.infer<typeof LandedCostQuote>;

export const LandedCostResult = z.discriminatedUnion('status', [
  LandedCostQuote,
  z.object({ status: z.literal('sin_dato'), hsCode: z.string(), reason: z.string(), escalateTo: z.literal('persona') }),
]);
export type LandedCostResult = z.infer<typeof LandedCostResult>;

export const PaymentRouteKey = z.enum(['banco', 'riel_stablecoin']);
export type PaymentRouteKey = z.infer<typeof PaymentRouteKey>;

export const Money = z.object({ amount: DecimalString, currency: Currency });
export type Money = z.infer<typeof Money>;

export const FeeLine = z.object({ label: z.string(), basis: z.string(), amount: DecimalString, currency: Currency });
export type FeeLine = z.infer<typeof FeeLine>;

export const ProposalStatus = z.enum(['propuesta', 'en_aprobacion', 'autorizada_simulada', 'rechazada']);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const PaymentProposal = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipment_id: z.string().min(1),
  corridor: z.literal('MX-CN'),
  route: PaymentRouteKey,
  routeLabel: z.string(),
  send: z.object({ amount: DecimalString, currency: z.literal('MXN') }),
  receive: z.object({ currency: z.enum(['USD', 'USDC']) }),
  payout: z.object({ currency: z.literal('USD') }),
  fxRate: DecimalString,
  grossUsd: DecimalString,
  fees: z.array(FeeLine),
  netUsd: DecimalString,
  eta: z.string(),
  status: ProposalStatus,
  mode: z.literal('simulation'),
  requires_human_approval: z.literal(true),
  execute: z.literal(false),
  version: z.number().int().positive(),
  demo: z.literal(true),
  createdAt: IsoDateTime,
});
export type PaymentProposal = z.infer<typeof PaymentProposal>;

export const ProposalRequest = z.object({
  shipment_id: z.string().min(1),
  corridor: z.literal('MX-CN'),
  send: z.object({ amount: DecimalString, currency: z.literal('MXN') }),
  receive: z.object({ currency: z.literal('USDC') }),
  mode: z.literal('simulation'),
  requires_human_approval: z.literal(true),
  execute: z.literal(false),
});
export type ProposalRequest = z.infer<typeof ProposalRequest>;

export const DecisionInput = z
  .object({
    proposalId: z.string().min(1),
    decision: z.enum(['aprobada', 'rechazada']),
    approver: z.string().trim().min(3, 'Indica quién decide'),
    reason: z.string().trim().optional(),
    version: z.number().int().positive(),
  })
  .refine((d) => d.decision === 'aprobada' || (d.reason !== undefined && d.reason.length >= 5), {
    message: 'Un rechazo exige motivo (mínimo 5 caracteres)',
    path: ['reason'],
  });
export type DecisionInput = z.infer<typeof DecisionInput>;

export const Approval = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  proposalId: z.string().min(1),
  approver: z.string().min(1),
  decision: z.enum(['aprobada', 'rechazada']),
  reason: z.string().nullable(),
  version: z.number().int().positive(),
  decidedAt: IsoDateTime,
});
export type Approval = z.infer<typeof Approval>;

export const ShipmentEventType = z.enum(['orden_confirmada', 'embarque', 'transito', 'arribo', 'liberacion', 'entrega']);
export type ShipmentEventType = z.infer<typeof ShipmentEventType>;

export const ShipmentEvent = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipmentId: z.string().min(1),
  type: ShipmentEventType,
  date: IsoDate,
  estimated: z.boolean(),
  origin: z.enum(['demo', 'manual']),
});
export type ShipmentEvent = z.infer<typeof ShipmentEvent>;

export const ReconciliationStatus = z.enum(['conciliado', 'con_diferencia', 'pendiente']);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatus>;

export const Reconciliation = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  shipmentId: z.string().min(1),
  ordered: DecimalString,
  invoiced: DecimalString,
  paid: DecimalString,
  orderedQty: z.number().int(),
  receivedQty: z.number().int(),
  balance: DecimalString,
  status: ReconciliationStatus,
  reasons: z.array(z.string()),
  sources: z.array(z.string()),
});
export type Reconciliation = z.infer<typeof Reconciliation>;

export const ActorType = z.enum(['persona', 'agente', 'sistema']);

export const AuditEntry = z.object({
  id: z.string().min(1),
  seq: z.number().int().nonnegative(),
  at: IsoDateTime,
  orgId: z.string().min(1),
  actorType: ActorType,
  actor: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  prevHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AgentName = z.enum([
  'orquestador',
  'documental',
  'aranceles_costo',
  'financiero',
  'logistico',
  'aduanero',
  'conciliacion',
  'proponente_politicas',
]);
export type AgentName = z.infer<typeof AgentName>;

export const AgentRun = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  agent: AgentName,
  input: z.string(),
  output: z.string(),
  model: z.string(),
  policyVersion: z.string(),
  latencyMs: z.number().nonnegative(),
  costUsd: DecimalString,
  outcome: z.enum(['ok', 'hold']),
  holdReason: z.string().nullable(),
  replay: z.boolean(),
  at: IsoDateTime,
});
export type AgentRun = z.infer<typeof AgentRun>;

export const Policy = z
  .object({
    id: z.string().min(1),
    orgId: z.string().min(1),
    agent: AgentName,
    version: z.string().min(1),
    scope: z.string().min(1),
    status: z.enum(['activa', 'sandbox']),
    proposedBy: z.string().min(1),
    approvedBy: z.string().nullable(),
    evaluation: z
      .object({ fieldAccuracy: DecimalString, plantedFound: z.number().int(), falsePositives: z.number().int(), repetitions: z.number().int() })
      .nullable(),
  })
  .refine((p) => p.status === 'sandbox' || p.approvedBy !== null, {
    message: 'Una política activa exige aprobación de una persona',
  });
export type Policy = z.infer<typeof Policy>;

export const AskResult = z.object({
  question: z.string(),
  answer: z.string(),
  citations: z.array(z.object({ entity: z.string(), id: z.string(), label: z.string() })),
  sinDato: z.boolean(),
});
export type AskResult = z.infer<typeof AskResult>;
