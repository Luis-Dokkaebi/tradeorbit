import { useState, type ChangeEvent } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { DocumentType, type Shipment } from '../../shared/schemas';
import { useAction, useServer } from '../serverContext';
import { ErrorNote, Sheet, Stamp } from './primitives';

const MAX_TEXT_BYTES = 200_000;

/** US-02: supporting documents with extracted fields, confidence and origin (page + box). */
export function DocumentsPanel({ shipment }: { shipment: Shipment }) {
  const t = useT();
  const { server, ctx } = useServer();
  const [run, error] = useAction();
  const [ownType, setOwnType] = useState<DocumentType>('factura');
  const docs = server.listDocuments(ctx, shipment.id);
  const tray = server.seedLibrary(ctx).filter((d) => d.type !== 'orden_compra');

  const onOwnFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_TEXT_BYTES) {
      run(() => {
        throw new Error('Archivo demasiado grande para el modo demo (máximo 200 KB)');
      });
      return;
    }
    const shipmentId = shipment.id;
    const epoch = server.getEpoch();
    file
      .text()
      .then((text) => {
        if (server.getEpoch() !== epoch) return; // scenario changed while reading: drop the stale upload
        const isText = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
        const lines = isText ? text.split(/\r?\n/).slice(0, 200) : [];
        run(() => server.addDocument(ctx, shipmentId, { type: ownType, fileName: file.name.slice(0, 120), pages: [lines] }));
      })
      .catch((err: unknown) => {
        run(() => {
          throw err instanceof Error ? err : new Error('No se pudo leer el archivo');
        });
      });
  };

  return (
    <Sheet id="docs-title" title={t('docs.title')} aside={<span className="label">{docs.length} · {t('docs.extracted').toLowerCase()}</span>}>
      <div className="grid gap-4">
        <ErrorNote message={error} />
        {tray.length > 0 ? (
          <div className="sim-surface grid gap-2 p-3" data-testid="seed-tray">
            <span className="label">{t('docs.tray')} <span className="demo-note">DEMO</span></span>
            <ul className="grid gap-2 md:grid-cols-2">
              {tray.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 border-b border-dashed border-sim pb-2">
                  <div className="grid min-w-0">
                    <span className="mono truncate text-sm">{d.fileName}</span>
                    <span className="note text-xs">{t(`doctype.${d.type}` as MessageKey)} · {d.note}</span>
                  </div>
                  <button type="button" className="btn btn-quiet" onClick={() => run(() => server.addSeedDocument(ctx, shipment.id, d.id))} data-testid={`upload-${d.id}`}>
                    {t('docs.upload')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <li key={d.id} className="border border-rule" data-testid={`doc-${d.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper-3 px-3 py-2">
                <div className="grid min-w-0">
                  <span className="label">{t(`doctype.${d.type}` as MessageKey)}</span>
                  <span className="mono truncate text-sm">{d.fileName}</span>
                </div>
                {d.status === 'revision_manual' ? <Stamp tone="decision">{t('docs.manual')}</Stamp> : <Stamp tone="ok">{t('docs.extracted')}</Stamp>}
              </div>
              {d.fields.length > 0 ? (
                <dl className="grid">
                  {d.fields.map((f) => (
                    <div key={f.key} className="doc-field">
                      <dt className="note text-sm">{f.label}</dt>
                      <dd className="mono text-sm">{f.value}</dd>
                      <dd className="flex items-center justify-end gap-2">
                        {f.needsReview ? <Stamp tone="decision">{f.confidence.toFixed(2)}</Stamp> : <span className="figure text-xs text-ink-3">{f.confidence.toFixed(2)}</span>}
                        <span className="mono text-xs text-ink-3" title={`${t('file.origin')}: página ${f.source.page}, recuadro aprox. ${f.source.box.join(',')}`}>p.{f.source.page}·≈{f.source.box[1]}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="note p-3">{t('docs.manual')}: sin campos legibles. El expediente sigue abierto.</p>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3 border-t border-rule pt-3">
          <label className="field">
            <span className="label">{t('docs.type')}</span>
            <select className="input" value={ownType} onChange={(e) => setOwnType(DocumentType.parse(e.target.value))}>
              {DocumentType.options.filter((o) => o !== 'orden_compra').map((o) => <option key={o} value={o}>{t(`doctype.${o}` as MessageKey)}</option>)}
            </select>
          </label>
          <label className="btn btn-quiet file-picker cursor-pointer">
            {t('docs.ownFile')}
            <input type="file" accept=".txt,text/plain,application/pdf,image/*" className="sr-only" onChange={onOwnFile} aria-describedby="own-file-note" />
          </label>
          <span id="own-file-note" className="note text-xs">PDF o imagen: sin servicio de OCR en el modo demo, pasa a revisión manual.</span>
        </div>
      </div>
    </Sheet>
  );
}
