import { useState } from 'react';
import { useT } from '../../i18n';
import { formatAmount } from '../../shared/money';
import { Citation, ErrorNote, PageHead, Stamp } from '../components/primitives';
import { useAction, useServer } from '../serverContext';
import { ProposalCard } from './PaymentsView';

/** US-06: approval inbox. Decisions record approver, date and version; rejection requires a reason. */
export function ApprovalsView() {
  const t = useT();
  const { server, ctx, setActor } = useServer();
  const [run, error] = useAction();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = server.listProposals(ctx).filter((p) => p.status === 'en_aprobacion');
  const approvals = server.listApprovals(ctx);
  const shipmentId = pending[0]?.shipment_id ?? server.listShipments(ctx)[0]?.id;
  const rec = shipmentId ? server.getReconciliation(ctx, shipmentId) : null;
  const quote = shipmentId ? server.latestQuote(ctx, shipmentId) : null;
  const openDisc = shipmentId ? server.listDiscrepancies(ctx, shipmentId).filter((d) => d.status === 'abierta') : [];

  return (
    <div className="grid gap-5">
      <PageHead title={t('approvals.title')} lede={t('approvals.lede')} />
      <label className="field max-w-[28rem]">
        <span className="label">{t('approvals.approver')}</span>
        <input className="input" value={ctx.actor} onChange={(e) => setActor(e.target.value)} data-testid="approver" />
      </label>
      <ErrorNote message={error} />
      {pending.length === 0 ? <p className="note" data-testid="inbox-empty">{t('approvals.empty')}</p> : null}
      {pending.map((p) => (
        <section key={p.id} className="decision-surface grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" data-testid={`inbox-${p.route}`}>
          <ProposalCard p={p} />
          <div className="grid content-start gap-3">
            <h3 className="label">{t('approvals.evidence')}</h3>
            <ul className="grid gap-2 text-sm">
              {rec ? <li><Citation>{rec.id}</Citation> {t('rec.balance')}: <span className="figure">{formatAmount(rec.balance)} USD</span> · {t(`rec.${rec.status}`)}</li> : null}
              {quote ? <li><Citation>{quote.id}</Citation> {t('cost.total')}: <span className="figure">{formatAmount(quote.totalMxn)} MXN</span></li> : <li className="note">{t('cost.title')}: {t('state.pending')}</li>}
              {openDisc.length > 0 ? <li><Stamp tone="decision">{openDisc.length} {t('disc.title').toLowerCase()}</Stamp></li> : null}
            </ul>
            <label className="field">
              <span className="label">{t('approvals.reason')}</span>
              <textarea className="input" value={reasons[p.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [p.id]: e.target.value })} data-testid={`reason-${p.route}`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-decision" onClick={() => run(() => server.decide(ctx, { proposalId: p.id, decision: 'aprobada', approver: ctx.actor, version: p.version }))} data-testid={`approve-${p.route}`}>
                {t('approvals.approve')}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => run(() => server.decide(ctx, { proposalId: p.id, decision: 'rechazada', approver: ctx.actor, reason: reasons[p.id], version: p.version }))} data-testid={`reject-${p.route}`}>
                {t('approvals.reject')}
              </button>
            </div>
          </div>
        </section>
      ))}

      {approvals.length > 0 ? (
        <section className="sheet" aria-labelledby="history">
          <header className="sheet-head"><h2 id="history" className="text-lg">{t('approvals.history')}</h2></header>
          <div className="table-scroll">
            <table className="ledger" data-testid="approvals-history">
              <thead><tr><th>ID</th><th>{t('approvals.approver')}</th><th>{t('file.status')}</th><th>{t('approvals.version')}</th><th>{t('gov.when')}</th><th>{t('rec.reasons')}</th></tr></thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.proposalId}</td>
                    <td>{a.approver}</td>
                    <td>{a.decision === 'aprobada' ? <span className="grid justify-items-start gap-1"><Stamp tone="authorized-sim" enter>{t('proposal.autorizada_simulada')}</Stamp><span className="note text-xs" data-testid="no-money">{t('approvals.noMoney')}</span></span> : <Stamp tone="neutral">{t('proposal.rechazada')}</Stamp>}</td>
                    <td className="mono">v{a.version}</td>
                    <td className="mono text-xs">{a.decidedAt.replace('T', ' ').slice(0, 19)}Z</td>
                    <td className="note">{a.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
