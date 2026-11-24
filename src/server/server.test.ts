import { AuditLogImmutableError } from './auditLog';
import { AgentPausedError, NotFoundError, StaleVersionError } from './errors';
import { KiilonovaServer } from './server';
import { ctx, makeServer, openDiscrepancyFile, otherOrg } from '../test/fixtures';
import type { ProposalRequest } from '../shared/schemas';

const request = (shipmentId: string, amount = '100000'): ProposalRequest => ({
  shipment_id: shipmentId, corridor: 'MX-CN', send: { amount, currency: 'MXN' }, receive: { currency: 'USDC' },
  mode: 'simulation', requires_human_approval: true, execute: false,
});

describe('US-01 open a file from a purchase order', () => {
  it('creates the file with supplier, goods, quantity, amount and currency', () => {
    const s = makeServer();
    const shipment = s.createShipmentFromDocument(ctx, 'DIS-OC');
    expect(shipment).toMatchObject({ id: 'SHP-0001', goods: expect.stringContaining('Camisa'), quantity: 200, amount: '5480.00', currency: 'USD' });
    expect(s.getSupplier(ctx, shipment.supplierId).name).toMatch(/Dongyuan/);
  });

  it('marks fields below 0.80 confidence for review', () => {
    const s = makeServer();
    const shipment = s.createShipmentFromDocument(ctx, 'DIS-OC');
    expect(shipment.fields.filter((f) => f.needsReview).map((f) => f.key)).toEqual(['fecha_estimada']);
    expect(shipment.status).toBe('en_revision');
  });

  it('creates a file from the form', () => {
    const s = makeServer();
    const shipment = s.createShipmentFromForm(ctx, { supplier: 'Proveedor de prueba (ficticio)', goods: 'Camisa de algodón', quantity: 50, amount: '1370.00', eta: '2026-12-20', incoterm: 'FOB Ningbo' });
    expect(shipment).toMatchObject({ quantity: 50, amount: '1370.00', eta: '2026-12-20' });
  });
});

describe('US-02 / US-03 documents and discrepancies', () => {
  it('finds the 3 planted discrepancies after uploading the 4 documents', () => {
    const s = makeServer();
    const id = openDiscrepancyFile(s);
    expect(s.listDiscrepancies(ctx, id).map((d) => d.type).sort()).toEqual(['cantidad', 'importe', 'proveedor']);
  });

  it('an illegible document goes to manual review and does not block the file', () => {
    const s = makeServer();
    const id = s.createShipmentFromDocument(ctx, 'DIS-OC').id;
    const doc = s.addSeedDocument(ctx, id, 'DIS-ILEG');
    expect(doc.status).toBe('revision_manual');
    expect(() => s.addSeedDocument(ctx, id, 'DIS-FAC')).not.toThrow();
  });

  it('resolving a discrepancy requires a note and is logged', () => {
    const s = makeServer();
    const id = openDiscrepancyFile(s);
    const d = s.listDiscrepancies(ctx, id)[0];
    if (!d) throw new Error('none');
    expect(() => s.resolveDiscrepancy(ctx, d.id, 'ok')).toThrow();
    s.resolveDiscrepancy(ctx, d.id, 'Proveedor envió factura corregida');
    expect(s.listDiscrepancies(ctx, id).find((x) => x.id === d.id)?.status).toBe('resuelta');
    expect(s.getAuditLog(ctx).some((e) => e.action === 'discrepancia.resuelta')).toBe(true);
  });
});

describe('US-04 landed cost', () => {
  it('computes with the versioned rule and keeps the rule used', () => {
    const s = makeServer('limpio');
    const r = s.computeLandedCost(ctx, 'SHP-0001', { hsCode: '6205.20.01', freightUsd: '420.00', brokerFeesMxn: '4500.00' });
    if (r.status !== 'calculado') throw new Error('expected quote');
    expect(r.totalMxn).toBe('174118.27');
    expect(r.rule.verification).toBe('por_verificar');
    expect(s.latestQuote(ctx, 'SHP-0001')?.id).toBe(r.id);
  });

  it('answers "sin dato" and escalates when the fraction is not in the table', () => {
    const s = makeServer('limpio');
    const r = s.computeLandedCost(ctx, 'SHP-0001', { hsCode: '6109.10.01', freightUsd: '420.00', brokerFeesMxn: '4500.00' });
    expect(r).toMatchObject({ status: 'sin_dato', escalateTo: 'persona' });
    expect(s.listRuns(ctx).at(-1)?.outcome).toBe('hold');
  });

  it('records the human confirmation of the final fraction', () => {
    const s = makeServer('limpio');
    s.confirmTariff(ctx, 'SHP-0001', '6205.20.01');
    expect(s.getShipment(ctx, 'SHP-0001').hsCode).toBe('6205.20.01');
    expect(s.getFlags().tariffConfirmedBy['SHP-0001']).toBe(ctx.actor);
  });
});

describe('US-05 / US-06 proposals and approval (principles 1 and 2)', () => {
  it('creates two DEMO proposals with execute false and the spec gross amount', () => {
    const s = makeServer('retraso');
    const ps = s.createPaymentProposals(ctx, request('SHP-0001'));
    expect(ps).toHaveLength(2);
    for (const p of ps) expect(p).toMatchObject({ execute: false, demo: true, mode: 'simulation', status: 'propuesta', grossUsd: '5479.45' });
  });

  it('rejects a request that asks to execute', () => {
    const s = makeServer('retraso');
    expect(() => s.createPaymentProposals(ctx, { ...request('SHP-0001'), execute: true } as unknown as ProposalRequest)).toThrow();
  });

  it('a rejection without reason is impossible', () => {
    const s = makeServer('retraso');
    const [p] = s.createPaymentProposals(ctx, request('SHP-0001'));
    if (!p) throw new Error('none');
    s.submitForApproval(ctx, p.id);
    expect(() => s.decide(ctx, { proposalId: p.id, decision: 'rechazada', approver: 'Tesorería (DEMO)', version: 1 })).toThrow(/motivo/);
    expect(() => s.decide(ctx, { proposalId: p.id, decision: 'rechazada', approver: 'Tesorería (DEMO)', reason: '   ', version: 1 })).toThrow();
  });

  it('approval records approver, date and version; status is authorized (simulated); no money moves', () => {
    const s = makeServer('retraso');
    const [p] = s.createPaymentProposals(ctx, request('SHP-0001'));
    if (!p) throw new Error('none');
    const before = s.getReconciliation(ctx, 'SHP-0001');
    expect(() => s.decide(ctx, { proposalId: p.id, decision: 'aprobada', approver: 'Dirección (DEMO)', version: 1 })).toThrow(/bandeja/);
    s.submitForApproval(ctx, p.id);
    const a = s.decide(ctx, { proposalId: p.id, decision: 'aprobada', approver: 'Dirección (DEMO)', version: 1 });
    expect(a).toMatchObject({ approver: 'Dirección (DEMO)', version: 1, decision: 'aprobada' });
    expect(a.decidedAt).toBe('2026-11-24T15:00:00.000Z');
    const after = s.listProposals(ctx).find((x) => x.id === p.id);
    expect(after).toMatchObject({ status: 'autorizada_simulada', execute: false });
    expect(s.getReconciliation(ctx, 'SHP-0001').paid).toBe(before.paid);
    expect(s.getAuditLog(ctx).find((e) => e.action === 'propuesta.autorizada_simulada')?.actor).toBe('Dirección (DEMO)');
  });

  it('a decision on a stale version fails', () => {
    const s = makeServer('retraso');
    const [p] = s.createPaymentProposals(ctx, request('SHP-0001'));
    if (!p) throw new Error('none');
    s.submitForApproval(ctx, p.id);
    expect(() => s.decide(ctx, { proposalId: p.id, decision: 'aprobada', approver: 'Dirección (DEMO)', version: 2 })).toThrow(StaleVersionError);
  });
});

describe('US-07 / US-09 timeline and reconciliation per scenario', () => {
  it('clean scenario reconciles without intervention', () => {
    const s = makeServer('limpio');
    expect(s.getReconciliation(ctx, 'SHP-0001')).toMatchObject({ status: 'conciliado', balance: '0.00' });
    expect(s.getShipment(ctx, 'SHP-0001').status).toBe('conciliado');
  });

  it('delay scenario flags the overdue ETA', () => {
    const s = makeServer('retraso');
    expect(s.getShipment(ctx, 'SHP-0001').status).toBe('retraso');
    expect(s.getReconciliation(ctx, 'SHP-0001')).toMatchObject({ status: 'pendiente', balance: '3836.00' });
  });

  it('a manual arrival event clears the delay', () => {
    const s = makeServer('retraso');
    s.addManualEvent(ctx, 'SHP-0001', 'arribo', '2026-11-23');
    s.addManualEvent(ctx, 'SHP-0001', 'liberacion', '2026-11-24');
    s.addManualEvent(ctx, 'SHP-0001', 'entrega', '2026-11-24');
    expect(s.getShipment(ctx, 'SHP-0001').status).not.toBe('retraso');
  });

  it('discrepancy scenario reconciles with difference', () => {
    const s = makeServer();
    const id = openDiscrepancyFile(s);
    expect(s.getReconciliation(ctx, id).status).toBe('con_diferencia');
  });
});

describe('US-08 customs package', () => {
  it('lists pending items for textiles and exports the file with the disclaimer', () => {
    const s = makeServer();
    const id = s.createShipmentFromDocument(ctx, 'DIS-OC').id;
    const pkg = s.getCustomsPackage(ctx, id);
    expect(pkg.checklist.filter((c) => c.kind === 'documento' && !c.satisfiedBy)).toHaveLength(4);
    expect(pkg.checklist.some((c) => c.label.includes('NOM-004'))).toBe(true);
    expect(pkg.disclaimer).toMatch(/agente aduanal/);
    s.confirmPadron(ctx, id, true);
    const exported = JSON.parse(s.exportCustomsPackage(ctx, id)) as { aviso: string; padronConfirmado: boolean; demo: boolean };
    expect(exported).toMatchObject({ padronConfirmado: true, demo: true });
    expect(exported.aviso).toMatch(/pedimento/);
  });
});

describe('US-10 ask the file', () => {
  it('answers the four questions with citations', () => {
    const s = makeServer('retraso');
    for (const q of ['¿Ya pagué?', '¿Cuánto falta?', '¿Qué documento falta?', '¿Cuándo llega?']) {
      const r = s.ask(ctx, 'SHP-0001', q);
      expect(r.sinDato).toBe(false);
      expect(r.citations.length).toBeGreaterThan(0);
    }
    expect(s.ask(ctx, 'SHP-0001', '¿Cuánto falta?').answer).toMatch(/3,836\.00 USD/);
  });

  it('answers "sin dato" outside the file', () => {
    const s = makeServer('retraso');
    const r = s.ask(ctx, 'SHP-0001', '¿Cuál es el precio del algodón en Chicago?');
    expect(r.sinDato).toBe(true);
    expect(r.citations).toEqual([]);
  });
});

describe('US-11 governance', () => {
  it('a sandbox policy exists and there is no automatic deploy path', () => {
    const s = makeServer();
    expect(s.listPolicies(ctx).some((p) => p.status === 'sandbox' && p.approvedBy === null)).toBe(true);
    const methods = Object.getOwnPropertyNames(KiilonovaServer.prototype).join(' ');
    expect(methods).not.toMatch(/deploy|promote|activatePolicy|desplegar/i);
  });

  it('the pause switch stops every agent, records HOLD and keeps the state', () => {
    const s = makeServer('limpio');
    const before = s.getReconciliation(ctx, 'SHP-0001');
    s.setPaused(ctx, true);
    expect(() => s.computeLandedCost(ctx, 'SHP-0001', { hsCode: '6205.20.01', freightUsd: '1', brokerFeesMxn: '1' })).toThrow(AgentPausedError);
    expect(s.listRuns(ctx).at(-1)).toMatchObject({ outcome: 'hold', holdReason: 'Interruptor de pausa activo' });
    expect(s.getReconciliation(ctx, 'SHP-0001')).toEqual(before);
    expect(s.getAuditLog(ctx).some((e) => e.action === 'agentes.pausados')).toBe(true);
  });
});

describe('US-12 demo mode', () => {
  it('reset returns to the seed state in one call', () => {
    const s = makeServer();
    openDiscrepancyFile(s);
    s.resetDemo(ctx);
    expect(s.listShipments(ctx)).toHaveLength(0);
    expect(s.seedLibrary(ctx)).toHaveLength(6);
  });

  it('loads the three scenarios', () => {
    const s = makeServer();
    s.loadScenario(ctx, 'limpio');
    expect(s.listShipments(ctx)).toHaveLength(1);
    s.loadScenario(ctx, 'retraso');
    expect(s.getShipment(ctx, 'SHP-0001').status).toBe('retraso');
  });

  it('replay mode marks agent runs as replayed', () => {
    const s = makeServer('retraso');
    s.ask(ctx, 'SHP-0001', '¿Ya pagué?');
    s.setReplay(ctx, true);
    s.ask(ctx, 'SHP-0001', '¿Ya pagué?');
    expect(s.listRuns(ctx).at(-1)?.replay).toBe(true);
  });
});

describe('NFR-05 / NFR-06 isolation and append-only log', () => {
  it('another organization cannot read the file', () => {
    const s = makeServer('limpio');
    expect(() => s.getShipment(otherOrg, 'SHP-0001')).toThrow(NotFoundError);
    expect(s.listShipments(otherOrg)).toEqual([]);
    expect(s.getAuditLog(otherOrg)).toEqual([]);
  });

  it('editing or deleting an audit entry fails', () => {
    const s = makeServer('limpio');
    const entry = s.getAuditLog(ctx)[0];
    if (!entry) throw new Error('empty log');
    expect(() => s.auditLog.update(entry.id, { action: 'otra' })).toThrow(AuditLogImmutableError);
    expect(() => s.auditLog.delete(entry.id)).toThrow(AuditLogImmutableError);
    expect(() => {
      (entry as { action: string }).action = 'mutado';
    }).toThrow();
  });

  it('the hash chain is intact and every action is logged', () => {
    const s = makeServer('retraso');
    const [p] = s.createPaymentProposals(ctx, request('SHP-0001'));
    if (!p) throw new Error('none');
    s.submitForApproval(ctx, p.id);
    s.decide(ctx, { proposalId: p.id, decision: 'rechazada', approver: 'Tesorería (DEMO)', reason: 'Prefiero esperar al arribo', version: 1 });
    expect(s.auditLog.verifyChain()).toBeNull();
    const actions = s.getAuditLog(ctx).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['propuesta.creada', 'propuesta.enviada_a_aprobacion', 'propuesta.rechazada']));
  });
});
