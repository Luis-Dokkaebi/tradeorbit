import { askShipment } from '../domain/ask';
import { buildCustomsChecklist, CUSTOMS_DISCLAIMER, type ChecklistItem } from '../domain/customsPackage';
import { detectDiscrepancies } from '../domain/discrepancies';
import { extractFields } from '../domain/extraction';
import { computeLandedCost, findTariffRule } from '../domain/landedCost';
import { buildTimeline, isDelayed, isDelivered, type TimelineStep } from '../domain/logistics';
import { quoteAllRoutes } from '../domain/paymentRoutes';
import { reconcile } from '../domain/reconciliation';
import { toIsoDate } from '../shared/dates';
import {
  DecisionInput,
  ProposalRequest,
  type AgentName,
  type AgentRun,
  type Approval,
  type AskResult,
  type AuditEntry,
  type Discrepancy,
  type DocumentType,
  type LandedCostResult,
  type PaymentProposal,
  type Policy,
  type Reconciliation,
  type ScenarioName,
  type Shipment,
  type ShipmentEvent,
  type ShipmentEventType,
  type Supplier,
  type TradeDocument,
} from '../shared/schemas';
import { canWrite } from './agents';
import { AuditLog } from './auditLog';
import { AgentPausedError, ConstitutionViolationError, NotFoundError, StaleVersionError } from './errors';
import { DEMO_FX_RATE, seedScenario, seedLibrary, type SeedLibraryItem } from './seed/scenarios';
import { DTA_RATE, IVA_RATE, TARIFF_RULES } from './seed/tariffs';
import { emptyTables, type Ctx, type Flags, type Tables } from './state';

export const DEMO_ORG = 'org-kiilonova-demo';
const MODEL = 'extractor-deterministico-local v1';

type Listener = () => void;
type Writer = AgentName | 'persona' | 'sistema';

export interface ServerOptions {
  clock?: () => Date;
  scenario?: ScenarioName;
}

export interface CustomsPackage {
  shipmentId: string;
  checklist: ChecklistItem[];
  disclaimer: string;
  padronConfirmed: boolean;
}

export interface ShipmentForm {
  supplier: string;
  goods: string;
  quantity: number;
  amount: string;
  eta: string;
  incoterm: string;
}

/**
 * Server functions of the MVP (SDD § Funciones de servidor), running in-process for the demo.
 * In production each method maps 1:1 to a Supabase edge function; API keys would live there only.
 * No method executes a payment, signs, or files anything with an authority (principle 1).
 */
export class KiilonovaServer {
  private t: Tables = emptyTables();
  private audit: AuditLog;
  private flags: Flags;
  private readonly listeners = new Set<Listener>();
  private version = 0;
  private seq = 0;
  private readonly clock: () => Date;
  private readonly replayCache = new Map<string, string>();

  constructor(options: ServerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.audit = new AuditLog(this.clock);
    this.flags = { scenario: options.scenario ?? 'discrepancia', paused: false, replay: false, tariffConfirmedBy: {}, padronConfirmed: {} };
    this.loadScenario({ orgId: DEMO_ORG, actor: 'sistema' }, this.flags.scenario);
  }

  // ── subscription (UI reactivity) ─────────────────────────────────────────
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${String(this.seq).padStart(4, '0')}`;
  }

  private now(): string {
    return this.clock().toISOString();
  }

  today(): string {
    return toIsoDate(this.clock());
  }

  private log(ctx: Ctx, actorType: AuditEntry['actorType'], action: string, entity: string, entityId: string, payload: Record<string, unknown>): void {
    const actor = actorType === 'persona' ? ctx.actor : actorType === 'agente' ? String(payload.agent ?? 'agente') : 'sistema';
    this.audit.append({ orgId: ctx.orgId, actorType, actor, action, entity, entityId, payload });
  }

  /** Every table write goes through here; agents can only write the tables their permission map allows. */
  private write<K extends keyof Tables>(writer: Writer, table: K, rows: Tables[K]): void {
    if (writer !== 'persona' && writer !== 'sistema' && !canWrite(writer, table)) {
      throw new ConstitutionViolationError(2, `el agente ${writer} no tiene permiso de escritura sobre ${table}`);
    }
    this.t = { ...this.t, [table]: rows };
  }

  /** Runs an agent step with observability. Paused agents record a HOLD and throw. */
  private runAgent<T>(ctx: Ctx, agent: AgentName, input: unknown, step: () => T, hold?: (out: T) => string | null): T {
    const inputText = JSON.stringify(input);
    if (this.flags.paused) {
      this.recordRun(ctx, agent, inputText, '', 0, 'hold', 'Interruptor de pausa activo', false);
      this.emit();
      throw new AgentPausedError();
    }
    const started = Date.now();
    const out = step();
    const cacheKey = `${agent}:${inputText}`;
    const replayed = this.flags.replay && this.replayCache.has(cacheKey);
    if (!this.flags.replay) this.replayCache.set(cacheKey, JSON.stringify(out));
    const reason = hold ? hold(out) : null;
    const output = replayed ? (this.replayCache.get(cacheKey) ?? '') : JSON.stringify(out);
    this.recordRun(ctx, agent, inputText, output, Date.now() - started, reason ? 'hold' : 'ok', reason, replayed);
    return out;
  }

  private recordRun(ctx: Ctx, agent: AgentName, input: string, output: string, latencyMs: number, outcome: 'ok' | 'hold', holdReason: string | null, replay: boolean): void {
    const run: AgentRun = {
      id: this.nextId('RUN'), orgId: ctx.orgId, agent, input: input.slice(0, 400), output: output.slice(0, 400), model: MODEL,
      policyVersion: this.activePolicy(ctx, agent)?.version ?? 'v1.0', latencyMs, costUsd: '0.0000', outcome, holdReason, replay, at: this.now(),
    };
    this.t = { ...this.t, agent_runs: [...this.t.agent_runs, run] };
    if (outcome === 'hold') this.log(ctx, 'agente', 'agente.hold', 'agent_runs', run.id, { agent, holdReason });
  }

  private activePolicy(ctx: Ctx, agent: AgentName): Policy | undefined {
    return this.t.policies.find((p) => p.orgId === ctx.orgId && p.agent === agent && p.status === 'activa');
  }

  // ── scoped reads (organization isolation) ────────────────────────────────
  private scoped<K extends keyof Tables>(ctx: Ctx, table: K): Tables[K] {
    return (this.t[table] as { orgId: string }[]).filter((r) => r.orgId === ctx.orgId) as Tables[K];
  }

  getShipment(ctx: Ctx, id: string): Shipment {
    const s = this.scoped(ctx, 'shipments').find((r) => r.id === id);
    if (!s) throw new NotFoundError('Expediente', id);
    return s;
  }

  listShipments(ctx: Ctx): Shipment[] {
    return this.scoped(ctx, 'shipments');
  }

  getSupplier(ctx: Ctx, id: string): Supplier {
    const s = this.scoped(ctx, 'suppliers').find((r) => r.id === id);
    if (!s) throw new NotFoundError('Proveedor', id);
    return s;
  }

  listDocuments(ctx: Ctx, shipmentId: string): TradeDocument[] {
    this.getShipment(ctx, shipmentId);
    return this.scoped(ctx, 'documents').filter((d) => d.shipmentId === shipmentId);
  }

  listDiscrepancies(ctx: Ctx, shipmentId: string): Discrepancy[] {
    return this.scoped(ctx, 'discrepancies').filter((d) => d.shipmentId === shipmentId);
  }

  listProposals(ctx: Ctx, shipmentId?: string): PaymentProposal[] {
    return this.scoped(ctx, 'payment_proposals').filter((p) => shipmentId === undefined || p.shipment_id === shipmentId);
  }

  listApprovals(ctx: Ctx): Approval[] {
    return this.scoped(ctx, 'approvals');
  }

  listEvents(ctx: Ctx, shipmentId: string): ShipmentEvent[] {
    return this.scoped(ctx, 'shipment_events').filter((e) => e.shipmentId === shipmentId);
  }

  listRuns(ctx: Ctx): AgentRun[] {
    return this.scoped(ctx, 'agent_runs');
  }

  listPolicies(ctx: Ctx): Policy[] {
    return this.scoped(ctx, 'policies');
  }

  getAuditLog(ctx: Ctx, filter: { actorType?: AuditEntry['actorType']; entity?: string } = {}): readonly AuditEntry[] {
    return this.audit
      .list(ctx.orgId)
      .filter((e) => (!filter.actorType || e.actorType === filter.actorType) && (!filter.entity || e.entity === filter.entity));
  }

  /** Exposed so tests can prove that editing the log fails (NFR-06). */
  get auditLog(): AuditLog {
    return this.audit;
  }

  getFlags(): Readonly<Flags> {
    return this.flags;
  }

  seedLibrary(ctx: Ctx): SeedLibraryItem[] {
    const loaded = new Set(this.scoped(ctx, 'documents').map((d) => d.id));
    return seedLibrary(this.flags.scenario, this.today()).filter((d) => !loaded.has(d.id));
  }

  // ── POST /demo/scenarios/{name}/load · /demo/reset (US-12) ───────────────
  loadScenario(ctx: Ctx, name: ScenarioName): void {
    this.audit = new AuditLog(this.clock);
    this.flags = { ...this.flags, scenario: name, paused: false, tariffConfirmedBy: {}, padronConfirmed: {} };
    const seed = seedScenario(name, this.today(), ctx.orgId);
    this.t = { ...emptyTables(), ...seed.tables, tariff_rules: [...TARIFF_RULES] };
    this.seq = seed.nextSeq;
    this.log(ctx, 'sistema', 'demo.escenario_cargado', 'demo', name, { scenario: name });
    for (const shipment of this.t.shipments) this.recompute(ctx, shipment.id);
    this.emit();
  }

  resetDemo(ctx: Ctx): void {
    this.loadScenario(ctx, this.flags.scenario);
  }

  setReplay(ctx: Ctx, on: boolean): void {
    this.flags = { ...this.flags, replay: on };
    this.log(ctx, 'persona', on ? 'demo.reproduccion_activada' : 'demo.reproduccion_desactivada', 'demo', 'replay', { on });
    this.emit();
  }

  // ── POST /shipments (US-01) ──────────────────────────────────────────────
  createShipmentFromDocument(ctx: Ctx, seedDocId: string): Shipment {
    const item = seedLibrary(this.flags.scenario, this.today()).find((d) => d.id === seedDocId && d.type === 'orden_compra');
    if (!item) throw new NotFoundError('Orden de compra semilla', seedDocId);
    return this.createShipmentFromText(ctx, item.id, item.fileName, item.pages);
  }

  createShipmentFromForm(ctx: Ctx, form: ShipmentForm): Shipment {
    const [y, m, d] = form.eta.split('-');
    const lines = [
      'ORDEN DE COMPRA (formulario)',
      `Folio: OC-FORM-${String(this.t.shipments.length + 1).padStart(4, '0')}`,
      `Proveedor: ${form.supplier}`,
      `Mercancía: ${form.goods}`,
      `Cantidad: ${form.quantity} piezas`,
      `Importe total: USD ${form.amount}`,
      'Moneda: USD',
      `Incoterm: ${form.incoterm}`,
      `Fecha estimada de arribo: ${d}/${m}/${y}`,
    ];
    return this.createShipmentFromText(ctx, this.nextId('FORM'), 'formulario-orden-de-compra', [lines]);
  }

  private createShipmentFromText(ctx: Ctx, docId: string, fileName: string, pages: string[][]): Shipment {
    const extraction = this.runAgent(ctx, 'documental', { docId, type: 'orden_compra' }, () => extractFields(docId, 'orden_compra', pages), (out) => {
      const low = out.fields.filter((f) => f.needsReview).map((f) => f.key);
      return low.length > 0 ? `Campos con confianza menor a 0.80: ${low.join(', ')}` : null;
    });
    const get = (k: string): string | undefined => extraction.fields.find((f) => f.key === k)?.value;
    const supplier = this.scoped(ctx, 'suppliers')[0];
    if (!supplier) throw new NotFoundError('Proveedor', 'semilla');
    const shipmentId = `SHP-${String(this.scoped(ctx, 'shipments').length + 1).padStart(4, '0')}`;
    const shipment: Shipment = {
      id: shipmentId, orgId: ctx.orgId, supplierId: supplier.id, status: 'abierto',
      goods: get('mercancia') ?? 'Sin dato', hsCode: null, quantity: Number(get('cantidad') ?? '1') || 1, unit: 'piezas',
      amount: get('importe') ?? '0', currency: 'USD', eta: get('fecha_estimada') ?? this.today(), incoterm: get('incoterm') ?? 'Sin dato',
      scenario: this.flags.scenario, fields: extraction.fields, createdAt: this.now(),
    };
    const po: TradeDocument = {
      id: docId, orgId: ctx.orgId, shipmentId, type: 'orden_compra', fileName, status: extraction.status, fields: extraction.fields, uploadedAt: this.now(),
    };
    this.write('documental', 'shipments', [...this.t.shipments, shipment]);
    this.write('documental', 'documents', [...this.t.documents, po]);
    this.log(ctx, 'persona', 'expediente.creado', 'shipments', shipmentId, { from: fileName });
    this.write('logistico', 'shipment_events', [
      ...this.t.shipment_events,
      { id: this.nextId('EVT'), orgId: ctx.orgId, shipmentId, type: 'orden_confirmada', date: this.today(), estimated: false, origin: 'manual' },
      { id: this.nextId('EVT'), orgId: ctx.orgId, shipmentId, type: 'arribo', date: shipment.eta, estimated: true, origin: 'manual' },
    ]);
    this.recompute(ctx, shipmentId);
    this.emit();
    return this.getShipment(ctx, shipmentId);
  }

  // ── POST /documents (US-02) ──────────────────────────────────────────────
  addSeedDocument(ctx: Ctx, shipmentId: string, seedDocId: string): TradeDocument {
    const item = seedLibrary(this.flags.scenario, this.today()).find((d) => d.id === seedDocId);
    if (!item) throw new NotFoundError('Documento semilla', seedDocId);
    return this.addDocument(ctx, shipmentId, { id: item.id, type: item.type, fileName: item.fileName, pages: item.pages });
  }

  addDocument(ctx: Ctx, shipmentId: string, file: { id?: string; type: DocumentType; fileName: string; pages: string[][] }): TradeDocument {
    this.getShipment(ctx, shipmentId);
    const docId = file.id ?? this.nextId('DOC');
    const extraction = this.runAgent(ctx, 'documental', { docId, type: file.type }, () => extractFields(docId, file.type, file.pages), (out) => {
      if (out.status === 'revision_manual') return 'Documento ilegible: pasa a revisión manual';
      return out.fields.some((f) => f.needsReview) ? 'Campos de baja confianza' : null;
    });
    const doc: TradeDocument = {
      id: docId, orgId: ctx.orgId, shipmentId, type: file.type, fileName: file.fileName, status: extraction.status, fields: extraction.fields, uploadedAt: this.now(),
    };
    this.write('documental', 'documents', [...this.t.documents.filter((d) => d.id !== docId), doc]);
    this.log(ctx, 'persona', 'documento.subido', 'documents', docId, { type: file.type, status: doc.status });
    this.recompute(ctx, shipmentId);
    this.emit();
    return doc;
  }

  // ── POST /shipments/{id}/discrepancies/run (US-03) ───────────────────────
  runDiscrepancies(ctx: Ctx, shipmentId: string): Discrepancy[] {
    const docs = this.listDocuments(ctx, shipmentId);
    const po = docs.find((d) => d.type === 'orden_compra');
    if (!po) return [];
    const detected = this.runAgent(ctx, 'documental', { shipmentId, step: 'cruce', docs: docs.map((d) => d.id) }, () =>
      detectDiscrepancies(po, docs.filter((d) => d.id !== po.id)));
    const previous = this.listDiscrepancies(ctx, shipmentId);
    const next: Discrepancy[] = detected.map((d) => {
      const prior = previous.find((p) => p.type === d.type && p.documentIds.join() === d.documentIds.join());
      return { ...d, id: prior?.id ?? this.nextId('DIS'), orgId: ctx.orgId, shipmentId, status: prior?.status ?? 'abierta', documentIds: [...d.documentIds] };
    });
    for (const d of next.filter((n) => !previous.some((p) => p.id === n.id))) {
      this.log(ctx, 'agente', 'discrepancia.detectada', 'discrepancies', d.id, { agent: 'documental', type: d.type });
    }
    const others = this.t.discrepancies.filter((d) => d.shipmentId !== shipmentId || d.orgId !== ctx.orgId);
    this.write('documental', 'discrepancies', [...others, ...next]);
    return next;
  }

  resolveDiscrepancy(ctx: Ctx, id: string, note: string): void {
    const d = this.scoped(ctx, 'discrepancies').find((r) => r.id === id);
    if (!d) throw new NotFoundError('Discrepancia', id);
    if (note.trim().length < 5) throw new Error('Explica cómo se resolvió (mínimo 5 caracteres)');
    this.write('persona', 'discrepancies', this.t.discrepancies.map((r) => (r.id === id ? { ...r, status: 'resuelta' as const } : r)));
    this.log(ctx, 'persona', 'discrepancia.resuelta', 'discrepancies', id, { note });
    this.recompute(ctx, d.shipmentId);
    this.emit();
  }

  // ── POST /shipments/{id}/landed-cost (US-04) ─────────────────────────────
  computeLandedCost(ctx: Ctx, shipmentId: string, input: { hsCode: string; freightUsd: string; brokerFeesMxn: string; fxRate?: string }): LandedCostResult {
    const shipment = this.getShipment(ctx, shipmentId);
    const result = this.runAgent(ctx, 'aranceles_costo', { shipmentId, ...input }, (): LandedCostResult => {
      const rule = findTariffRule(this.t.tariff_rules, input.hsCode, this.today());
      if (!rule) {
        return { status: 'sin_dato', hsCode: input.hsCode, reason: `La fracción ${input.hsCode} no está en la tabla de aranceles versionada.`, escalateTo: 'persona' };
      }
      const inputs = {
        hsCode: rule.hsCode, goodsValueUsd: shipment.amount, freightUsd: input.freightUsd, insuranceUsd: '0',
        fxRate: input.fxRate ?? DEMO_FX_RATE, brokerFeesMxn: input.brokerFeesMxn, quantity: shipment.quantity,
      };
      const b = computeLandedCost(inputs, rule, DTA_RATE, IVA_RATE);
      return {
        id: this.nextId('LCQ'), orgId: ctx.orgId, shipmentId, status: 'calculado', inputs,
        components: b.components, totalMxn: b.totalMxn, perUnitMxn: b.perUnitMxn, rule, createdAt: this.now(),
      };
    }, (out) => (out.status === 'sin_dato' ? 'Fracción sin fila en la tabla: escala a una persona' : null));
    if (result.status === 'calculado') {
      this.write('aranceles_costo', 'landed_cost_quotes', [...this.t.landed_cost_quotes, result]);
      this.log(ctx, 'agente', 'costo_puesto.calculado', 'landed_cost_quotes', result.id, { agent: 'aranceles_costo', total: result.totalMxn, rule: `${result.rule.hsCode} v${result.rule.version}` });
    } else {
      this.log(ctx, 'agente', 'costo_puesto.sin_dato', 'landed_cost_quotes', shipmentId, { agent: 'aranceles_costo', hsCode: input.hsCode });
    }
    this.emit();
    return result;
  }

  latestQuote(ctx: Ctx, shipmentId: string) {
    return this.scoped(ctx, 'landed_cost_quotes').filter((q) => q.shipmentId === shipmentId).at(-1) ?? null;
  }

  confirmTariff(ctx: Ctx, shipmentId: string, hsCode: string): void {
    this.getShipment(ctx, shipmentId);
    this.flags = { ...this.flags, tariffConfirmedBy: { ...this.flags.tariffConfirmedBy, [shipmentId]: ctx.actor } };
    this.write('persona', 'shipments', this.t.shipments.map((s) => (s.id === shipmentId && s.orgId === ctx.orgId ? { ...s, hsCode } : s)));
    this.log(ctx, 'persona', 'fraccion.confirmada', 'shipments', shipmentId, { hsCode });
    this.emit();
  }

  // ── POST /shipments/{id}/payment-proposals (US-05) ───────────────────────
  createPaymentProposals(ctx: Ctx, request: ProposalRequest, fxRate: string = DEMO_FX_RATE): PaymentProposal[] {
    const req = ProposalRequest.parse(request);
    this.getShipment(ctx, req.shipment_id);
    const quotes = this.runAgent(ctx, 'financiero', req, () => quoteAllRoutes(req.send.amount, fxRate));
    const proposals = quotes.map((q): PaymentProposal => ({
      id: this.nextId('PRO'), orgId: ctx.orgId, shipment_id: req.shipment_id, corridor: 'MX-CN', route: q.key, routeLabel: q.label,
      send: { amount: req.send.amount, currency: 'MXN' }, receive: { currency: q.receiveCurrency }, payout: { currency: 'USD' },
      fxRate, grossUsd: q.grossUsd, fees: q.fees, netUsd: q.netUsd, eta: q.eta, status: 'propuesta', mode: 'simulation',
      requires_human_approval: true, execute: false, version: 1, demo: true, createdAt: this.now(),
    }));
    this.write('financiero', 'payment_proposals', [...this.t.payment_proposals, ...proposals]);
    proposals.forEach((p) => this.log(ctx, 'agente', 'propuesta.creada', 'payment_proposals', p.id, { agent: 'financiero', route: p.route, execute: false }));
    this.emit();
    return proposals;
  }

  submitForApproval(ctx: Ctx, proposalId: string): PaymentProposal {
    const p = this.listProposals(ctx).find((r) => r.id === proposalId);
    if (!p) throw new NotFoundError('Propuesta', proposalId);
    if (p.status !== 'propuesta') throw new Error(`La propuesta está en estado ${p.status}`);
    const next: PaymentProposal = { ...p, status: 'en_aprobacion' };
    this.write('persona', 'payment_proposals', this.t.payment_proposals.map((r) => (r.id === proposalId ? next : r)));
    this.log(ctx, 'persona', 'propuesta.enviada_a_aprobacion', 'payment_proposals', proposalId, { version: p.version });
    this.emit();
    return next;
  }

  // ── POST /payment-proposals/{id}/decision (US-06) ────────────────────────
  decide(ctx: Ctx, input: DecisionInput): Approval {
    const d = DecisionInput.parse(input);
    const p = this.listProposals(ctx).find((r) => r.id === d.proposalId);
    if (!p) throw new NotFoundError('Propuesta', d.proposalId);
    if (p.status !== 'en_aprobacion') throw new Error('Solo se decide sobre propuestas en la bandeja de aprobación');
    if (p.version !== d.version) throw new StaleVersionError(p.version, d.version);
    const approval: Approval = {
      id: this.nextId('APR'), orgId: ctx.orgId, proposalId: p.id, approver: d.approver, decision: d.decision,
      reason: d.reason && d.reason.length > 0 ? d.reason : null, version: d.version, decidedAt: this.now(),
    };
    const next: PaymentProposal = { ...p, status: d.decision === 'aprobada' ? 'autorizada_simulada' : 'rechazada', execute: false };
    this.write('persona', 'approvals', [...this.t.approvals, approval]);
    this.write('persona', 'payment_proposals', this.t.payment_proposals.map((r) => (r.id === p.id ? next : r)));
    const action = d.decision === 'aprobada' ? 'propuesta.autorizada_simulada' : 'propuesta.rechazada';
    this.log({ ...ctx, actor: d.approver }, 'persona', action, 'payment_proposals', p.id, { version: d.version, reason: approval.reason, moneyMoved: false });
    this.emit();
    return approval;
  }

  // ── GET /shipments/{id}/reconciliation (US-09) ───────────────────────────
  getReconciliation(ctx: Ctx, shipmentId: string): Reconciliation {
    const r = this.scoped(ctx, 'reconciliations').find((x) => x.shipmentId === shipmentId);
    if (!r) throw new NotFoundError('Conciliación', shipmentId);
    return r;
  }

  getTimeline(ctx: Ctx, shipmentId: string): TimelineStep[] {
    return buildTimeline(this.listEvents(ctx, shipmentId), this.today());
  }

  addManualEvent(ctx: Ctx, shipmentId: string, type: ShipmentEventType, date: string): void {
    this.getShipment(ctx, shipmentId);
    const event: ShipmentEvent = { id: this.nextId('EVT'), orgId: ctx.orgId, shipmentId, type, date, estimated: false, origin: 'manual' };
    this.write('persona', 'shipment_events', [...this.t.shipment_events, event]);
    this.log(ctx, 'persona', 'evento.capturado', 'shipment_events', event.id, { type, date });
    this.recompute(ctx, shipmentId);
    this.emit();
  }

  /** Orchestrator: routes each stage after any change. It never executes effects. */
  private recompute(ctx: Ctx, shipmentId: string): void {
    this.runDiscrepancies(ctx, shipmentId);
    const shipment = this.getShipment(ctx, shipmentId);
    const docs = this.listDocuments(ctx, shipmentId);
    const timeline = this.getTimeline(ctx, shipmentId);
    const outcome = this.runAgent(ctx, 'conciliacion', { shipmentId, docs: docs.map((d) => d.id) }, () =>
      reconcile({ orderedAmount: shipment.amount, orderedQty: shipment.quantity, documents: docs, delivered: isDelivered(timeline) }));
    const existing = this.scoped(ctx, 'reconciliations').find((r) => r.shipmentId === shipmentId);
    const rec: Reconciliation = { id: existing?.id ?? `REC-${shipmentId.slice(4)}`, orgId: ctx.orgId, shipmentId, ...outcome };
    this.write('conciliacion', 'reconciliations', [...this.t.reconciliations.filter((r) => !(r.id === rec.id && r.orgId === ctx.orgId)), rec]);

    const openDiscrepancies = this.listDiscrepancies(ctx, shipmentId).some((d) => d.status === 'abierta');
    const needsReview = shipment.fields.some((f) => f.needsReview) || docs.some((d) => d.status === 'revision_manual');
    let status: Shipment['status'] = 'abierto';
    if (rec.status === 'conciliado') status = 'conciliado';
    else if (isDelayed(timeline)) status = 'retraso';
    else if (openDiscrepancies || needsReview) status = 'en_revision';
    else if (isDelivered(timeline)) status = 'entregado';
    else if (timeline.some((s) => s.type === 'embarque' && s.state === 'hecho')) status = 'en_transito';
    if (status !== shipment.status) {
      this.write('logistico', 'shipments', this.t.shipments.map((s) => (s.id === shipmentId && s.orgId === ctx.orgId ? { ...s, status } : s)));
      this.log(ctx, 'sistema', 'expediente.estado', 'shipments', shipmentId, { from: shipment.status, to: status });
    }
  }

  // ── US-08: customs package ───────────────────────────────────────────────
  getCustomsPackage(ctx: Ctx, shipmentId: string): CustomsPackage {
    const docs = this.listDocuments(ctx, shipmentId);
    return {
      shipmentId, checklist: buildCustomsChecklist(docs, 'textil'), disclaimer: CUSTOMS_DISCLAIMER,
      padronConfirmed: this.flags.padronConfirmed[shipmentId] ?? false,
    };
  }

  confirmPadron(ctx: Ctx, shipmentId: string, confirmed: boolean): void {
    this.getShipment(ctx, shipmentId);
    this.flags = { ...this.flags, padronConfirmed: { ...this.flags.padronConfirmed, [shipmentId]: confirmed } };
    this.log(ctx, 'persona', confirmed ? 'padron.confirmado' : 'padron.desmarcado', 'shipments', shipmentId, { confirmed });
    this.emit();
  }

  exportCustomsPackage(ctx: Ctx, shipmentId: string): string {
    const pkg = this.getCustomsPackage(ctx, shipmentId);
    const shipment = this.getShipment(ctx, shipmentId);
    this.log(ctx, 'persona', 'paquete_aduanal.exportado', 'shipments', shipmentId, { items: pkg.checklist.length });
    this.emit();
    return JSON.stringify(
      {
        generado: this.now(), demo: true, aviso: pkg.disclaimer, expediente: shipment,
        documentos: this.listDocuments(ctx, shipmentId), pendientes: pkg.checklist.filter((c) => c.satisfiedBy === null),
        padronConfirmado: pkg.padronConfirmed, ultimaCotizacion: this.latestQuote(ctx, shipmentId),
      },
      null,
      2,
    );
  }

  // ── POST /shipments/{id}/ask (US-10) ─────────────────────────────────────
  ask(ctx: Ctx, shipmentId: string, question: string): AskResult {
    const context = {
      shipmentId, reconciliation: this.getReconciliation(ctx, shipmentId), documents: this.listDocuments(ctx, shipmentId),
      checklist: this.getCustomsPackage(ctx, shipmentId).checklist, timeline: this.getTimeline(ctx, shipmentId),
    };
    const result = this.runAgent(ctx, 'orquestador', { shipmentId, question }, () => askShipment(question, context));
    this.log(ctx, 'persona', 'expediente.pregunta', 'shipments', shipmentId, { question, sinDato: result.sinDato });
    this.emit();
    return result;
  }

  // ── US-11: governance (read-only + pause switch; no deploy path exists) ──
  setPaused(ctx: Ctx, paused: boolean): void {
    this.flags = { ...this.flags, paused };
    this.log(ctx, 'persona', paused ? 'agentes.pausados' : 'agentes.reanudados', 'agents', 'todos', { paused });
    this.emit();
  }
}
