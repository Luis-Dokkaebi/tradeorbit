import { useState, type FormEvent, type ReactNode } from 'react';
import { DEMO_ROUTES } from '../../domain/paymentRoutes';
import { useT, type MessageKey } from '../../i18n';
import { DEMO_FX_RATE } from '../../server/seed/scenarios';
import type { PaymentProposal } from '../../shared/schemas';
import { Amount, ErrorNote, PageHead, Stamp } from '../components/primitives';
import { useAction, useServer } from '../serverContext';
import { useShipment } from '../useShipment';
import { NeedsFile } from './NeedsFile';

export function ProposalCard({ p, children }: { p: PaymentProposal; children?: ReactNode }) {
  const t = useT();
  const note = DEMO_ROUTES.find((r) => r.key === p.route)?.note;
  const tone = p.status === 'autorizada_simulada' ? 'authorized-sim' : p.status === 'en_aprobacion' ? 'decision' : p.status === 'rechazada' ? 'neutral' : 'sim';
  return (
    <article className="sim-surface grid gap-3 p-4" data-testid={`proposal-${p.route}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <span className="label">{p.id} · {p.corridor} · v{p.version}</span>
          <h2 className="text-lg">{p.routeLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-2"><Stamp tone={tone} enter>{t(`proposal.${p.status}` as MessageKey)}</Stamp></div>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        <div className="field"><dt className="label">{t('pay.gross')}</dt><dd><Amount value={p.grossUsd} currency="USD" /></dd></div>
        <div className="field"><dt className="label">{t('pay.net')}</dt><dd className="text-lg"><Amount value={p.netUsd} currency="USD" /></dd></div>
      </dl>
      <table className="ledger">
        <caption className="label py-1 text-left">{t('pay.fees')}</caption>
        <tbody>
          {p.fees.map((f, i) => (
            <tr key={`${i}-${f.label}`}><td><div className="grid"><span>{f.label}</span><span className="mono text-xs text-ink-3">{f.basis}</span></div></td><td className="num-col">−<Amount value={f.amount} currency={f.currency} /></td></tr>
          ))}
        </tbody>
      </table>
      <p className="mono text-xs text-ink-2">{t('pay.eta')}: {p.eta} · {t('pay.rate')}: {p.fxRate} MXN/USD · execute: <strong>false</strong></p>
      {note ? <p className="note text-xs">{note}</p> : null}
      {children}
    </article>
  );
}

/** US-05: compare routes and send one for approval. The button never says "Pagar". */
export function PaymentsView() {
  const t = useT();
  const { server, ctx } = useServer();
  const shipment = useShipment();
  const [run, error] = useAction();
  const [amount, setAmount] = useState('100000');
  if (!shipment) return <NeedsFile />;
  const proposals = server.listProposals(ctx, shipment.id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => server.createPaymentProposals(ctx, {
      shipment_id: shipment.id, corridor: 'MX-CN', send: { amount, currency: 'MXN' }, receive: { currency: 'USDC' },
      mode: 'simulation', requires_human_approval: true, execute: false,
    }));
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t('pay.title')} lede={t('pay.lede')} aside={<span className="label">{t('pay.rate')} {DEMO_FX_RATE}</span>} />
      <form className="sheet sheet-body flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label className="field"><span className="label">{t('pay.amount')}</span><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="pay-amount" /></label>
        <button type="submit" className="btn" data-testid="pay-generate">{t('pay.generate')}</button>
      </form>
      <ErrorNote message={error} />
      {proposals.length === 0 ? <p className="note">{t('pay.none')}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} p={p}>
            {p.status === 'propuesta' ? (
              <button type="button" className="btn w-fit" onClick={() => run(() => server.submitForApproval(ctx, p.id))} data-testid={`submit-${p.route}`}>{t('pay.submit')}</button>
            ) : p.status === 'en_aprobacion' ? <span className="note">{t('pay.sent')}</span> : null}
          </ProposalCard>
        ))}
      </div>
    </div>
  );
}
