import { useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import type { AskResult } from '../../shared/schemas';
import { Citation, ErrorNote, PageHead, Stamp } from '../components/primitives';
import { useAction, useServer } from '../serverContext';
import { useShipment } from '../useShipment';
import { NeedsFile } from './NeedsFile';

const SUGGESTIONS = ['¿Ya pagué?', '¿Cuánto falta por pagar?', '¿Qué documento falta?', '¿Cuándo llega?'];

/** US-10: natural-language questions answered only from the file, with citations. */
export function AskView() {
  const t = useT();
  const { server, ctx } = useServer();
  const shipment = useShipment();
  const [run, error] = useAction();
  const [q, setQ] = useState('');
  const [history, setHistory] = useState<AskResult[]>([]);
  if (!shipment) return <NeedsFile />;

  const ask = (question: string) => {
    if (question.trim().length === 0) return;
    run(() => setHistory((h) => [server.ask(ctx, shipment.id, question.slice(0, 300)), ...h]));
    setQ('');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t('ask.title')} lede={t('ask.lede')} />
      <form className="sheet sheet-body grid gap-3" onSubmit={submit}>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => <button key={s} type="button" className="btn btn-quiet" onClick={() => ask(s)}>{s}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">{t('ask.placeholder')}</span><input className="input" placeholder={t('ask.placeholder')} value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} data-testid="ask-input" /></label>
          <button type="submit" className="btn">{t('ask.send')}</button>
        </div>
      </form>
      <ErrorNote message={error} />
      <ol className="grid gap-3" data-testid="answers">
        {history.map((r, i) => (
          <li key={`${r.question}-${history.length - i}`} className={r.sinDato ? 'sheet sheet-body grid gap-2' : 'sheet sheet-body grid gap-2'}>
            <span className="label">{r.question}</span>
            <p className="text-lg">{r.answer}</p>
            {r.sinDato ? <Stamp tone="neutral">{t('cost.sinDato')}</Stamp> : (
              <div className="flex flex-wrap items-center gap-2"><span className="label">{t('ask.sources')}</span>{r.citations.map((c) => <Citation key={`${c.entity}-${c.id}`}>{c.entity}/{c.id}</Citation>)}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
