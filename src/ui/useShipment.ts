import type { Shipment } from '../shared/schemas';
import { useServer } from './serverContext';

/** The MVP works one file at a time: the scenario's single shipment, or null before it is opened. */
export const useShipment = (): Shipment | null => {
  const { server, ctx } = useServer();
  return server.listShipments(ctx)[0] ?? null;
};
