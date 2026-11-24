import { useT } from '../../i18n';
import { formatDateEs } from '../../shared/dates';
import type { Shipment, ShipmentStatus } from '../../shared/schemas';
import { useServer } from '../serverContext';
import { Amount, Field, Stamp, type StampTone } from './primitives';

const STATUS_TONE: Record<ShipmentStatus, StampTone> = {
  abierto: 'neutral', en_revision: 'decision', en_transito: 'neutral', retraso: 'wait', entregado: 'ok', conciliado: 'ok',
};

/** File cover: the key facts an import operator reads first. */
export function Caratula({ shipment }: { shipment: Shipment }) {
  const t = useT();
  const { server, ctx } = useServer();
  const supplier = server.getSupplier(ctx, shipment.supplierId);
  const field = (key: string) => shipment.fields.find((f) => f.key === key);
  const etaField = field('fecha_estimada');

  return (
    <section className="sheet" aria-labelledby="file-title">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] md:gap-6 md:p-5">
        <div className="grid content-start gap-3">
          <h1 id="file-title" className="grid gap-1">
            <span className="label">{t('nav.file')} · {t('file.folio')}</span>
            <span className="folio" data-testid="file-folio">{shipment.id}</span>
          </h1>
          <div className="flex flex-wrap gap-2">
            <Stamp tone={STATUS_TONE[shipment.status]} enter>{t(`status.${shipment.status}`)}</Stamp>
            <span className="stamp stamp-neutral">MX ← CN</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
          <Field label={t('file.supplier')}>{supplier.name}<span className="mono text-xs text-ink-3"> · {supplier.country} · KYB DEMO</span></Field>
          <Field label={t('file.goods')}>{shipment.goods}</Field>
          <Field label={t('file.quantity')}><span className="figure">{shipment.quantity}</span> <span className="note">{shipment.unit}</span></Field>
          <Field label={t('file.amount')}><Amount value={shipment.amount} currency={shipment.currency} /></Field>
          <Field label={t('file.hsCode')}>
            {shipment.hsCode ? <span className="mono">{shipment.hsCode}</span> : <span className="stamp stamp-neutral">{t('file.hsPending')}</span>}
          </Field>
          <Field label={t('file.eta')} testId="eta-field">
            <span className="mono">{formatDateEs(shipment.eta)}</span>{' '}
            {etaField?.needsReview ? <Stamp tone="decision">{t('file.review')} · {etaField.confidence.toFixed(2)}</Stamp> : null}
          </Field>
        </dl>
      </div>
    </section>
  );
}
