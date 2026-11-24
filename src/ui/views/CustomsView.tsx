import { useT } from '../../i18n';
import { PageHead, Stamp } from '../components/primitives';
import { useServer } from '../serverContext';
import { useShipment } from '../useShipment';
import { NeedsFile } from './NeedsFile';

/** US-08: pending list for the customs broker and file export. The app never files the pedimento. */
export function CustomsView() {
  const t = useT();
  const { server, ctx } = useServer();
  const shipment = useShipment();
  if (!shipment) return <NeedsFile />;
  const pkg = server.getCustomsPackage(ctx, shipment.id);

  const download = () => {
    const json = server.exportCustomsPackage(ctx, shipment.id);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `expediente-${shipment.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t('customs.title')} lede={pkg.disclaimer} />
      <section className="sheet">
        <ol className="grid" data-testid="customs-checklist">
          {pkg.checklist.map((c, i) => (
            <li key={c.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-rule px-4 py-3">
              <span className="mono text-xs text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              <div className="grid gap-1"><span>{c.label}</span><span className="note text-xs">{c.note}</span></div>
              {c.satisfiedBy ? <Stamp tone="ok">{t('customs.done')}</Stamp> : <Stamp tone="wait">{t('customs.pending')}</Stamp>}
            </li>
          ))}
        </ol>
      </section>
      <label className="decision-surface flex items-start gap-3 p-4">
        <input type="checkbox" className="mt-1" checked={pkg.padronConfirmed} onChange={(e) => server.confirmPadron(ctx, shipment.id, e.target.checked)} data-testid="padron" />
        <span>{t('customs.padron')}</span>
      </label>
      <button type="button" className="btn w-fit" onClick={download} data-testid="export">{t('customs.export')}</button>
    </div>
  );
}
