import { useT } from '../../i18n';
import { Amount, Citation, PageHead, Stamp } from '../components/primitives';
import { useServer } from '../serverContext';
import { useShipment } from '../useShipment';
import { NeedsFile } from './NeedsFile';

/** US-09: four-way match of order, invoice, payment and reception. */
export function ReconciliationView() {
  const t = useT();
  const { server, ctx } = useServer();
  const shipment = useShipment();
  if (!shipment) return <NeedsFile />;
  const rec = server.getReconciliation(ctx, shipment.id);
  const tone = rec.status === 'conciliado' ? 'ok' : rec.status === 'con_diferencia' ? 'decision' : 'wait';

  const rows = [
    { label: t('rec.ordered'), value: <Amount value={rec.ordered} currency="USD" />, qty: rec.orderedQty },
    { label: t('rec.invoiced'), value: <Amount value={rec.invoiced} currency="USD" />, qty: null },
    { label: t('rec.paid'), value: <Amount value={rec.paid} currency="USD" />, qty: null },
    { label: t('rec.received'), value: <span className="note">—</span>, qty: rec.receivedQty },
  ];

  return (
    <div className="grid gap-5">
      <PageHead title={t('rec.title')} lede={t('rec.lede')} aside={<Stamp tone={tone} enter>{t(`rec.${rec.status}`)}</Stamp>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="sheet">
          <div className="table-scroll">
            <table className="ledger" data-testid="reconciliation">
              <thead><tr><th>Registro</th><th className="num-col">USD</th><th className="num-col">{t('file.quantity')}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}><td>{r.label}</td><td className="num-col">{r.value}</td><td className="num-col figure">{r.qty ?? '—'}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>{t('rec.balance')}</td><td className="num-col text-lg" data-testid="balance"><Amount value={rec.balance} currency="USD" /></td><td /></tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section className="sheet sheet-body grid content-start gap-4">
          <div className="grid gap-2">
            <h2 className="label">{t('rec.reasons')}</h2>
            {rec.reasons.length === 0 ? <p className="note">—</p> : <ul className="grid gap-1">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          </div>
          <div className="grid gap-2">
            <h2 className="label">{t('rec.sources')}</h2>
            <div className="flex flex-wrap gap-2"><Citation>{rec.id}</Citation>{rec.sources.map((s) => <Citation key={s}>{s}</Citation>)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
