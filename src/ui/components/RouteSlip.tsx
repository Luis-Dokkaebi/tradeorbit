import { useT, type MessageKey } from '../../i18n';
import type { Shipment } from '../../shared/schemas';
import { useServer } from '../serverContext';
import { Stamp, type StampTone } from './primitives';

interface Step {
  key: MessageKey;
  tone: StampTone;
  state: string;
  detail: string;
}

/** Eight-stage routing slip: the central visual of the file (design direction §3). */
export function RouteSlip({ shipment }: { shipment: Shipment }) {
  const t = useT();
  const { server, ctx } = useServer();
  const docs = server.listDocuments(ctx, shipment.id);
  const support = docs.filter((d) => d.type !== 'orden_compra');
  const openDisc = server.listDiscrepancies(ctx, shipment.id).filter((d) => d.status === 'abierta');
  const quote = server.latestQuote(ctx, shipment.id);
  const proposals = server.listProposals(ctx, shipment.id);
  const timeline = server.getTimeline(ctx, shipment.id);
  const rec = server.getReconciliation(ctx, shipment.id);
  const ev = (type: string) => timeline.find((s) => s.type === type);

  const eventStep = (key: MessageKey, type: string): Step => {
    const s = ev(type);
    if (s?.state === 'hecho') return { key, tone: 'ok', state: t('state.done'), detail: s.date ?? '' };
    if (s?.state === 'vencido') return { key, tone: 'wait', state: t('state.delayed'), detail: s.date ?? '' };
    if (s?.state === 'estimado') return { key, tone: 'neutral', state: t('state.estimated'), detail: s.date ?? '' };
    return { key, tone: 'neutral', state: t('state.pending'), detail: '—' };
  };

  const paymentStep = (): Step => {
    const key: MessageKey = 'stage.payment';
    if (proposals.some((p) => p.status === 'autorizada_simulada')) return { key, tone: 'authorized-sim', state: t('proposal.autorizada_simulada'), detail: 'execute: false' };
    if (proposals.some((p) => p.status === 'en_aprobacion')) return { key, tone: 'decision', state: t('proposal.en_aprobacion'), detail: `${proposals.filter((p) => p.status === 'en_aprobacion').length}` };
    if (proposals.length > 0) return { key, tone: 'sim', state: t('state.proposed'), detail: `${proposals.length}` };
    return { key, tone: 'neutral', state: t('state.pending'), detail: '—' };
  };

  const steps: Step[] = [
    { key: 'stage.order', tone: shipment.fields.some((f) => f.needsReview) ? 'decision' : 'ok', state: shipment.fields.some((f) => f.needsReview) ? t('state.review') : t('state.done'), detail: docs.find((d) => d.type === 'orden_compra')?.fileName ?? '—' },
    {
      key: 'stage.documents',
      tone: openDisc.length > 0 || support.some((d) => d.status === 'revision_manual') ? 'decision' : support.length >= 4 ? 'ok' : 'neutral',
      state: openDisc.length > 0 ? `${openDisc.length} ${t('disc.title').toLowerCase()}` : support.length >= 4 ? t('state.done') : t('state.pending'),
      detail: `${support.length}/4`,
    },
    { key: 'stage.cost', tone: quote ? 'ok' : 'neutral', state: quote ? t('state.done') : t('state.pending'), detail: quote ? `${quote.totalMxn} MXN` : '—' },
    paymentStep(),
    eventStep('stage.shipping', 'embarque'),
    eventStep('stage.customs', 'liberacion'),
    eventStep('stage.delivery', 'entrega'),
    { key: 'stage.reconciliation', tone: rec.status === 'conciliado' ? 'ok' : rec.status === 'con_diferencia' ? 'decision' : 'wait', state: t(`rec.${rec.status}`), detail: `${rec.balance} USD` },
  ];

  return (
    <section aria-labelledby="route-title" className="grid gap-2">
      <h2 id="route-title" className="label">{t('file.route')}</h2>
      <ol className="route" data-testid="route-slip">
        {steps.map((s, i) => (
          <li key={s.key} className="route-step">
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm font-display">{t(s.key)}</span>
            <Stamp tone={s.tone}>{s.state}</Stamp>
            <span className="mono text-xs text-ink-3">{s.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
