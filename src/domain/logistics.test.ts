import { buildTimeline, isDelayed, isDelivered, nextExpected } from './logistics';
import type { ShipmentEvent } from '../shared/schemas';

const ev = (type: ShipmentEvent['type'], date: string, estimated: boolean): ShipmentEvent => ({ id: `${type}-${date}`, orgId: 'o', shipmentId: 's', type, date, estimated, origin: 'demo' });

describe('logistics timeline (US-07, T-030)', () => {
  it('has the six steps in order', () => {
    expect(buildTimeline([], '2026-11-24').map((s) => s.type)).toEqual(['orden_confirmada', 'embarque', 'transito', 'arribo', 'liberacion', 'entrega']);
  });

  it('an estimated date in the past without the real event means delay', () => {
    const t = buildTimeline([ev('orden_confirmada', '2026-10-01', false), ev('arribo', '2026-11-20', true)], '2026-11-24');
    expect(t.find((s) => s.type === 'arribo')?.state).toBe('vencido');
    expect(isDelayed(t)).toBe(true);
  });

  it('a future estimate is not a delay', () => {
    const t = buildTimeline([ev('arribo', '2026-12-12', true)], '2026-11-24');
    expect(isDelayed(t)).toBe(false);
    expect(nextExpected(t)?.type).toBe('orden_confirmada');
  });

  it('a real event overrides the estimate', () => {
    const t = buildTimeline([ev('arribo', '2026-11-20', true), ev('arribo', '2026-11-21', false), ev('entrega', '2026-11-23', false)], '2026-11-24');
    expect(isDelayed(t)).toBe(false);
    expect(isDelivered(t)).toBe(true);
  });
});
