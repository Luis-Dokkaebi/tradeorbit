import { useState, type FormEvent } from 'react';
import { EVENT_LABELS, EVENT_ORDER } from '../../domain/logistics';
import { useT } from '../../i18n';
import { formatDateEs } from '../../shared/dates';
import { ShipmentEventType, type Shipment } from '../../shared/schemas';
import { useAction, useServer } from '../serverContext';
import { ErrorNote, Sheet, Stamp, type StampTone } from './primitives';

const TONE: Record<string, StampTone> = { hecho: 'ok', estimado: 'neutral', vencido: 'wait', pendiente: 'neutral' };

/** US-07: six-step logistics timeline, demo or manual events, with overdue detection. */
export function TimelinePanel({ shipment }: { shipment: Shipment }) {
  const t = useT();
  const { server, ctx } = useServer();
  const [run, error] = useAction();
  const timeline = server.getTimeline(ctx, shipment.id);
  const [type, setType] = useState<ShipmentEventType>('arribo');
  const [date, setDate] = useState(server.today());
  const overdue = timeline.some((s) => s.state === 'vencido');
  const stateLabel = (s: string) => (s === 'hecho' ? t('state.done') : s === 'vencido' ? t('state.delayed') : s === 'estimado' ? t('state.estimated') : t('state.pending'));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => server.addManualEvent(ctx, shipment.id, type, date));
  };

  return (
    <Sheet id="timeline-title" title={t('timeline.title')}>
      <div className="grid gap-4">
        {overdue ? <p className="stamp stamp-wait w-fit whitespace-normal" data-testid="delay-alert">{t('timeline.delay')}</p> : null}
        <ol className="grid gap-0" data-testid="timeline">
          {timeline.map((s, i) => (
            <li key={s.type} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-2">
              <span className="mono text-xs text-ink-3">{i + 1}</span>
              <span>{s.label}</span>
              <span className="flex flex-wrap items-center justify-end gap-2">
                {s.date ? <span className="mono text-sm">{formatDateEs(s.date)}</span> : null}
                {s.origin === 'demo' ? <span className="stamp stamp-sim">DEMO</span> : null}
                <Stamp tone={TONE[s.state] ?? 'neutral'}>{stateLabel(s.state)}</Stamp>
              </span>
            </li>
          ))}
        </ol>
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <label className="field">
            <span className="label">{t('timeline.type')}</span>
            <select className="input" value={type} onChange={(e) => setType(ShipmentEventType.parse(e.target.value))}>
              {EVENT_ORDER.map((ev) => <option key={ev} value={ev}>{EVENT_LABELS[ev]}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">{t('timeline.date')}</span>
            <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-quiet">{t('timeline.add')}</button>
        </form>
        <ErrorNote message={error} />
      </div>
    </Sheet>
  );
}
