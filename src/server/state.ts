import type {
  AgentRun,
  Approval,
  Discrepancy,
  LandedCostQuote,
  Organization,
  PaymentProposal,
  Policy,
  Reconciliation,
  ScenarioName,
  Shipment,
  ShipmentEvent,
  Supplier,
  TariffRule,
  TradeDocument,
} from '../shared/schemas';

/** In-memory tables mirroring supabase/migrations/0001_init.sql (audit_log lives in AuditLog). */
export interface Tables {
  organizations: Organization[];
  suppliers: Supplier[];
  shipments: Shipment[];
  documents: TradeDocument[];
  discrepancies: Discrepancy[];
  tariff_rules: TariffRule[];
  landed_cost_quotes: LandedCostQuote[];
  payment_proposals: PaymentProposal[];
  approvals: Approval[];
  shipment_events: ShipmentEvent[];
  reconciliations: Reconciliation[];
  agent_runs: AgentRun[];
  policies: Policy[];
}

export const emptyTables = (): Tables => ({
  organizations: [],
  suppliers: [],
  shipments: [],
  documents: [],
  discrepancies: [],
  tariff_rules: [],
  landed_cost_quotes: [],
  payment_proposals: [],
  approvals: [],
  shipment_events: [],
  reconciliations: [],
  agent_runs: [],
  policies: [],
});

export interface Ctx {
  orgId: string;
  actor: string;
}

export interface Flags {
  scenario: ScenarioName;
  paused: boolean;
  replay: boolean;
  tariffConfirmedBy: Record<string, string>;
  padronConfirmed: Record<string, boolean>;
}
