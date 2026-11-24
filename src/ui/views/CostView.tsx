import { useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import { formatDateEs } from '../../shared/dates';
import { dec } from '../../shared/money';
import type { LandedCostResult } from '../../shared/schemas';
import { DEMO_FX_RATE } from '../../server/seed/scenarios';
import { Amount, ErrorNote, Field, PageHead, Sheet, Stamp } from '../components/primitives';
import { useAction, useServer } from '../serverContext';
import { useShipment } from '../useShipment';
import { NeedsFile } from './NeedsFile';

/** US-04: landed cost with the exact versioned rule, source, date and validity. */
export function CostView() {
  const t = useT();
  const { server, ctx } = useServer();
  const shipment = useShipment();
  const [run, error] = useAction();
  const [form, setForm] = useState({ hsCode: '6205.20.01', freightUsd: '420.00', brokerFeesMxn: '4500.00', fxRate: DEMO_FX_RATE });
  const [result, setResult] = useState<LandedCostResult | null>(null);
  if (!shipment) return <NeedsFile />;

  const latest = server.latestQuote(ctx, shipment.id);
  const shown: LandedCostResult | null = result ?? latest;
  const confirmation = server.tariffConfirmation(ctx, shipment.id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => setResult(server.computeLandedCost(ctx, shipment.id, form)));
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t('cost.title')} lede={t('cost.lede')} />
      <form className="sheet sheet-body grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" onSubmit={submit}>
        <label className="field"><span className="label">{t('cost.hsCode')}</span><input className="input" value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} data-testid="hs-input" /></label>
        <label className="field"><span className="label">{t('cost.freight')}</span><input className="input" inputMode="decimal" value={form.freightUsd} onChange={(e) => setForm({ ...form, freightUsd: e.target.value })} /></label>
        <label className="field"><span className="label">{t('cost.fees')}</span><input className="input" inputMode="decimal" value={form.brokerFeesMxn} onChange={(e) => setForm({ ...form, brokerFeesMxn: e.target.value })} /></label>
        <label className="field"><span className="label">{t('cost.fx')}</span><input className="input" inputMode="decimal" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value })} /></label>
        <button type="submit" className="btn" data-testid="calc-cost">{t('cost.calculate')}</button>
      </form>
      <ErrorNote message={error} />

      {shown?.status === 'sin_dato' ? (
        <section className="decision-surface sheet-body grid gap-2" data-testid="cost-sin-dato">
          <Stamp tone="decision">{t('cost.sinDato')}</Stamp>
          <p>{shown.reason}</p>
          <p className="note">{t('cost.escalate')}</p>
        </section>
      ) : null}

      {shown?.status === 'calculado' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <Sheet id="cost-breakdown" title={t('cost.title')} aside={<span className="label">{t('pay.rate')} {shown.inputs.fxRate}</span>}>
            <div className="table-scroll">
              <table className="ledger" data-testid="cost-table">
                <thead><tr><th>{t('cost.component')}</th><th>{t('cost.basis')}</th><th className="num-col">{t('cost.amount')}</th></tr></thead>
                <tbody>
                  {shown.components.map((c) => (
                    <tr key={c.key}>
                      <td><div className="grid gap-1"><span>{c.label}</span><span className="citation">↳ {c.source}</span></div></td>
                      <td className="mono text-xs text-ink-2">{c.basis}</td>
                      <td className="num-col"><Amount value={c.amountMxn} currency="MXN" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2}>{t('cost.total')}</td><td className="num-col" data-testid="cost-total"><Amount value={shown.totalMxn} currency="MXN" /></td></tr>
                  <tr><td colSpan={2} className="note">{t('cost.perUnit')} · {shown.inputs.quantity} pzs</td><td className="num-col"><Amount value={shown.perUnitMxn} currency="MXN" /></td></tr>
                </tfoot>
              </table>
            </div>
            <p className="note mt-3">{t('cost.ivaNote')}</p>
          </Sheet>

          <Sheet id="cost-rule" title={t('cost.rule')} aside={shown.rule.verification === 'verificada' ? <Stamp tone="ok">{t('cost.verified')}</Stamp> : <Stamp tone="wait">{t('cost.unverified')}</Stamp>}>
            <dl className="grid gap-4">
              <Field label={t('file.hsCode')}><span className="mono text-lg">{shown.rule.hsCode}</span> <span className="note">v{shown.rule.version}</span></Field>
              <Field label={t('file.goods')}>{shown.rule.description}</Field>
              <Field label={t('cost.rate')}><span className="figure text-lg">{dec(shown.rule.rate).times(100).toString()}%</span></Field>
              <Field label={t('cost.source')}><span className="text-sm">{shown.rule.source}</span></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('cost.published')}><span className="mono">{formatDateEs(shown.rule.publishedAt)}</span></Field>
                <Field label={t('cost.validity')}><span className="mono">{formatDateEs(shown.rule.validFrom)} – {shown.rule.validTo ? formatDateEs(shown.rule.validTo) : t('cost.open')}</span></Field>
              </div>
              <Field label={t('cost.noms')}>
                <ul className="grid gap-1">{shown.rule.noms.map((n) => <li key={n.code}><span className="mono">{n.code}</span> <span className="note">{n.title}</span></li>)}</ul>
              </Field>
            </dl>
            <div className="mt-4 border-t border-rule pt-4">
              {confirmation?.hsCode === shown.rule.hsCode ? (
                <Stamp tone="ok" enter>{t('cost.confirmedBy')}: {confirmation.by}</Stamp>
              ) : (
                <button type="button" className="btn btn-decision" onClick={() => run(() => server.confirmTariff(ctx, shipment.id, shown.rule.hsCode))} data-testid="confirm-hs">{t('cost.confirm')}</button>
              )}
            </div>
          </Sheet>
        </div>
      ) : null}
    </div>
  );
}
