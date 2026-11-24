import { KiilonovaServer, DEMO_ORG } from '../server/server';
import type { ScenarioName } from '../shared/schemas';

export const FIXED_NOW = new Date('2026-11-24T15:00:00.000Z');
export const ctx = { orgId: DEMO_ORG, actor: 'Dirección general' };
export const otherOrg = { orgId: 'org-ajena', actor: 'intruso' };

export const makeServer = (scenario: ScenarioName = 'discrepancia'): KiilonovaServer =>
  new KiilonovaServer({ clock: () => FIXED_NOW, scenario });

/** Runs the live demo opening: create the file from the PO, then upload the four supporting documents. */
export const openDiscrepancyFile = (server: KiilonovaServer): string => {
  const shipment = server.createShipmentFromDocument(ctx, 'DIS-OC');
  for (const id of ['DIS-FAC', 'DIS-LE', 'DIS-CP', 'DIS-BL']) server.addSeedDocument(ctx, shipment.id, id);
  return shipment.id;
};
