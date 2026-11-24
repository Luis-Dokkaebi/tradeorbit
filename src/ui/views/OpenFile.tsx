import { useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import { ErrorNote, PageHead, Sheet } from '../components/primitives';
import { useAction, useServer } from '../serverContext';

/** US-01: open the file from a purchase order (seed document) or from the form. */
export function OpenFile() {
  const t = useT();
  const { server, ctx } = useServer();
  const [run, error] = useAction();
  const [mode, setMode] = useState<'doc' | 'form'>('doc');
  const pos = server.seedLibrary(ctx).filter((d) => d.type === 'orden_compra');
  const [form, setForm] = useState({ supplier: '', goods: '', quantity: '200', amount: '', eta: '', incoterm: 'FOB Ningbo' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => {
      const quantity = Number(form.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('La cantidad debe ser un entero positivo');
      if (!/^\d+(\.\d{1,2})?$/.test(form.amount)) throw new Error('El importe debe ser un decimal con hasta 2 decimales');
      server.createShipmentFromForm(ctx, { ...form, quantity });
    });
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t('open.title')} lede={t('open.lede')} />
      <div className="seg w-fit" role="group" aria-label={t('open.title')}>
        <button type="button" aria-pressed={mode === 'doc'} onClick={() => setMode('doc')}>{t('open.fromDoc')}</button>
        <button type="button" aria-pressed={mode === 'form'} onClick={() => setMode('form')}>{t('open.fromForm')}</button>
      </div>
      <ErrorNote message={error} />
      {mode === 'doc' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {pos.map((po) => (
            <Sheet key={po.id} title={po.fileName} aside={<span className="label">{t('doctype.orden_compra')}</span>}>
              <pre className="mono mb-4 whitespace-pre-wrap text-xs text-ink-2">{po.pages[0]?.join('\n')}</pre>
              <button type="button" className="btn" onClick={() => run(() => server.createShipmentFromDocument(ctx, po.id))} data-testid="open-from-po">
                {t('open.upload')}
              </button>
            </Sheet>
          ))}
        </div>
      ) : (
        <form className="sheet sheet-body grid gap-4 md:grid-cols-3" onSubmit={submit}>
          {(
            [
              ['supplier', 'open.supplier', 'text'],
              ['goods', 'open.goods', 'text'],
              ['quantity', 'open.quantity', 'number'],
              ['amount', 'open.amount', 'text'],
              ['eta', 'open.eta', 'date'],
              ['incoterm', 'open.incoterm', 'text'],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="field">
              <span className="label">{t(label)}</span>
              <input className="input" type={type} required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} inputMode={key === 'amount' ? 'decimal' : undefined} pattern={key === 'amount' ? '\\d+(\\.\\d{1,2})?' : undefined} />
            </label>
          ))}
          <div className="md:col-span-3">
            <button type="submit" className="btn">{t('open.create')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
