import { useState } from 'react';
import { useT } from '../../i18n';
import type { Shipment } from '../../shared/schemas';
import { useAction, useServer } from '../serverContext';
import { Citation, ErrorNote, Stamp } from './primitives';

/** US-03: discrepancies are decisions waiting for a person, so they carry the vermilion accent. */
export function DiscrepanciesPanel({ shipment }: { shipment: Shipment }) {
  const t = useT();
  const { server, ctx } = useServer();
  const [run, error] = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const list = server.listDiscrepancies(ctx, shipment.id);
  const open = list.filter((d) => d.status === 'abierta');

  if (list.length === 0) {
    return (
      <section className="sheet sheet-body flex items-center justify-between gap-3" aria-label={t('disc.title')} data-testid="discrepancies-none">
        <span className="font-display text-lg">{t('disc.title')}</span>
        <Stamp tone="ok">{t('disc.none')}</Stamp>
      </section>
    );
  }

  return (
    <section className={open.length > 0 ? 'decision-surface' : 'sheet'} aria-labelledby="disc-title" data-testid="discrepancies">
      <header className="sheet-head">
        <h2 id="disc-title" className="text-lg">{t('disc.title')}</h2>
        <span className="count-decision">{open.length}</span>
      </header>
      <ErrorNote message={error} />
      <ol className="grid">
        {list.map((d) => (
          <li key={d.id} className="grid gap-3 border-b border-rule p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" data-testid={`disc-${d.type}`}>
            <div className="grid content-start gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-base uppercase">{d.type}</span>
                <Stamp tone={d.status === 'abierta' ? 'decision' : 'ok'}>{d.status === 'abierta' ? `${t('disc.open')} · ${d.severity}` : t('disc.resolved')}</Stamp>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="field"><dt className="label">{t('disc.expected')}</dt><dd className="wrap-any">{d.expected}</dd></div>
                <div className="field"><dt className="label">{t('disc.found')}</dt><dd className="wrap-any text-decision">{d.found}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">{d.documentIds.map((id) => <Citation key={id}>{id}</Citation>)}</div>
            </div>
            <div className="grid content-start gap-2">
              <span className="label">{t('disc.task')}</span>
              <p>{d.task}</p>
              {d.status === 'abierta' ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="field min-w-0 flex-1">
                    <span className="sr-only">{t('disc.resolveNote')}</span>
                    <input className="input" placeholder={t('disc.resolveNote')} value={notes[d.id] ?? ''} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
                  </label>
                  <button type="button" className="btn btn-decision" onClick={() => run(() => server.resolveDiscrepancy(ctx, d.id, notes[d.id] ?? ''))}>{t('disc.resolve')}</button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
