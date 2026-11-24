import { DecisionInput, Discrepancy, PaymentProposal, Policy, ProposalRequest, ShipmentForm, DecimalString, PositiveDecimal } from './schemas';

const proposal = {
  id: 'PRO-0001', orgId: 'o', shipment_id: 'SHP-0001', corridor: 'MX-CN', route: 'banco', routeLabel: 'Banco',
  send: { amount: '100000', currency: 'MXN' }, receive: { currency: 'USD' }, payout: { currency: 'USD' }, fxRate: '18.25',
  grossUsd: '5479.45', fees: [], netUsd: '5479.45', eta: '2 días', status: 'propuesta', mode: 'simulation',
  requires_human_approval: true, execute: false, version: 1, demo: true, createdAt: '2026-11-24T00:00:00.000Z',
};

describe('shared contracts (T-002)', () => {
  it('the SDD sample request is valid and execute=true is impossible (principle 1)', () => {
    const sample = { shipment_id: 'SHP-0001', corridor: 'MX-CN', send: { amount: '100000', currency: 'MXN' }, receive: { currency: 'USDC' }, mode: 'simulation', requires_human_approval: true, execute: false };
    expect(ProposalRequest.parse(sample)).toEqual(sample);
    expect(ProposalRequest.safeParse({ ...sample, execute: true }).success).toBe(false);
    expect(ProposalRequest.safeParse({ ...sample, requires_human_approval: false }).success).toBe(false);
    expect(PaymentProposal.safeParse(proposal).success).toBe(true);
    expect(PaymentProposal.safeParse({ ...proposal, execute: true }).success).toBe(false);
    expect(PaymentProposal.safeParse({ ...proposal, demo: false }).success).toBe(false);
  });

  it('money travels as decimal strings, never as floats (NFR-03)', () => {
    expect(DecimalString.safeParse(5479.45).success).toBe(false);
    expect(DecimalString.safeParse('5479.45').success).toBe(true);
    expect(PositiveDecimal.safeParse('0').success).toBe(false);
    expect(PositiveDecimal.safeParse('-5').success).toBe(false);
    expect(ProposalRequest.safeParse({ shipment_id: 'S', corridor: 'MX-CN', send: { amount: '-1', currency: 'MXN' }, receive: { currency: 'USDC' }, mode: 'simulation', requires_human_approval: true, execute: false }).success).toBe(false);
  });

  it('a rejection requires a reason; an approval does not', () => {
    expect(DecisionInput.safeParse({ proposalId: 'P', decision: 'rechazada', approver: 'Tesorería', version: 1 }).success).toBe(false);
    expect(DecisionInput.safeParse({ proposalId: 'P', decision: 'aprobada', approver: 'Tesorería', version: 1 }).success).toBe(true);
  });

  it('a discrepancy needs evidence from two documents', () => {
    const d = { id: 'D', orgId: 'o', shipmentId: 'S', type: 'importe', severity: 'alta', documentIds: ['A'], expected: '1', found: '2', status: 'abierta', task: 'x' };
    expect(Discrepancy.safeParse(d).success).toBe(false);
    expect(Discrepancy.safeParse({ ...d, documentIds: ['A', 'B'] }).success).toBe(true);
  });

  it('an active policy needs a human approver', () => {
    const p = { id: 'P', orgId: 'o', agent: 'documental', version: 'v2', scope: 's', status: 'activa', proposedBy: 'proponente_politicas', approvedBy: null, evaluation: null };
    expect(Policy.safeParse(p).success).toBe(false);
    expect(Policy.safeParse({ ...p, status: 'sandbox' }).success).toBe(true);
  });

  it('form text cannot carry line breaks (no forged document lines)', () => {
    const f = { supplier: 'A', goods: 'B', quantity: 1, amount: '1.00', eta: '2026-12-01', incoterm: 'FOB' };
    expect(ShipmentForm.safeParse(f).success).toBe(true);
    expect(ShipmentForm.safeParse({ ...f, goods: 'B\nImporte total: USD 1' }).success).toBe(false);
  });
});
