import type { ShipmentEvent, ShipmentEventType } from '../shared/schemas';

export const EVENT_ORDER: readonly ShipmentEventType[] = ['orden_confirmada', 'embarque', 'transito', 'arribo', 'liberacion', 'entrega'];

export const EVENT_LABELS: Record<ShipmentEventType, string> = {
  orden_confirmada: 'Orden confirmada',
  embarque: 'Embarque',
  transito: 'Tránsito',
  arribo: 'Arribo a puerto',
  liberacion: 'Liberación aduanal',
  entrega: 'Entrega en bodega',
};

export interface TimelineStep {
  type: ShipmentEventType;
  label: string;
  date: string | null;
  state: 'hecho' | 'estimado' | 'vencido' | 'pendiente';
  eventId: string | null;
  origin: 'demo' | 'manual' | null;
}

/** Builds the six-step timeline (US-07). An estimated date in the past without the real event is 'vencido'. */
export const buildTimeline = (events: readonly ShipmentEvent[], today: string): TimelineStep[] =>
  EVENT_ORDER.map((type) => {
    const actual = events.find((e) => e.type === type && !e.estimated);
    const estimate = events.find((e) => e.type === type && e.estimated);
    if (actual) return { type, label: EVENT_LABELS[type], date: actual.date, state: 'hecho', eventId: actual.id, origin: actual.origin };
    if (estimate) {
      return {
        type, label: EVENT_LABELS[type], date: estimate.date,
        state: estimate.date < today ? 'vencido' : 'estimado', eventId: estimate.id, origin: estimate.origin,
      };
    }
    return { type, label: EVENT_LABELS[type], date: null, state: 'pendiente', eventId: null, origin: null };
  });

export const isDelayed = (timeline: readonly TimelineStep[]): boolean => timeline.some((s) => s.state === 'vencido');

export const isDelivered = (timeline: readonly TimelineStep[]): boolean =>
  timeline.some((s) => s.type === 'entrega' && s.state === 'hecho');

export const nextExpected = (timeline: readonly TimelineStep[]): TimelineStep | null =>
  timeline.find((s) => s.state !== 'hecho') ?? null;
