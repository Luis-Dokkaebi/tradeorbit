import { useState } from 'react';
import { AGENTS, POLICY_PROMOTION_GATE } from '../../server/agents';
import { useT } from '../../i18n';
import { dec } from '../../shared/money';
import type { AuditEntry, Policy } from '../../shared/schemas';
import { PageHead, Stamp } from '../components/primitives';
import { useServer } from '../serverContext';

const passesGate = (p: Policy): boolean =>
  p.evaluation !== null &&
  dec(p.evaluation.fieldAccuracy).gte(POLICY_PROMOTION_GATE.minFieldAccuracy) &&
  p.evaluation.plantedFound >= POLICY_PROMOTION_GATE.plantedRequired &&
  p.evaluation.falsePositives <= POLICY_PROMOTION_GATE.maxFalsePositives &&
  p.evaluation.repetitions >= POLICY_PROMOTION_GATE.repetitions;

/** US-11: read-only governance. The only control is the global pause switch; there is no deploy path. */
export function GovernanceView() {
  const t = useT();
  const { server, ctx } = useServer();
  const [actorFilter, setActorFilter] = useState<AuditEntry['actorType'] | ''>('');
  const runs = server.listRuns(ctx);
  const holds = runs.filter((r) => r.outcome === 'hold');
  const holdReasons = Object.entries(holds.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.holdReason ?? '—']: (acc[r.holdReason ?? '—'] ?? 0) + 1 }), {}));
  const audit = server.getAuditLog(ctx, actorFilter ? { actorType: actorFilter } : {});
  const chainOk = server.auditLog.verifyChain() === null;
  const paused = server.getFlags().paused;

  return (
    <div className="grid gap-5">
      <PageHead
        title={t('gov.title')}
        lede={t('gov.lede')}
        aside={
          <button type="button" className={paused ? 'btn' : 'btn btn-decision'} onClick={() => server.setPaused(ctx, !paused)} data-testid="pause">
            {paused ? t('gov.resume') : t('gov.pause')}
          </button>
        }
      />

      <section className="sheet" aria-labelledby="gov-agents">
        <header className="sheet-head"><h2 id="gov-agents" className="text-lg">{t('gov.agents')}</h2></header>
        <div className="table-scroll">
          <table className="ledger">
            <thead><tr><th>{t('gov.agent')}</th><th>{t('gov.reads')}</th><th>{t('gov.writes')}</th><th>{t('gov.autonomy')}</th><th>{t('gov.human')}</th></tr></thead>
            <tbody>{AGENTS.map((a) => <tr key={a.name}><td>{a.label}</td><td className="note">{a.reads}</td><td className="note">{a.writes}</td><td className="mono">{a.autonomy}</td><td>{a.humanApproval}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="sheet" aria-labelledby="gov-policies">
          <header className="sheet-head">
            <h2 id="gov-policies" className="text-lg">{t('gov.policies')}</h2>
            <span className="label">{t('gov.gate')}: ≥{POLICY_PROMOTION_GATE.minFieldAccuracy} · {POLICY_PROMOTION_GATE.plantedRequired}/3 · FP {POLICY_PROMOTION_GATE.maxFalsePositives} · ×{POLICY_PROMOTION_GATE.repetitions}</span>
          </header>
          <ul className="grid" data-testid="policies">
            {server.listPolicies(ctx).map((p) => (
              <li key={p.id} className={`grid gap-2 border-b border-rule p-4 ${p.status === 'sandbox' ? 'sim-surface' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono">{p.agent} · {p.version}</span>
                  {p.status === 'sandbox' ? <Stamp tone="sim">{t('gov.sandbox')}</Stamp> : <Stamp tone="ok">{t('gov.active')}</Stamp>}
                  {p.evaluation ? (passesGate(p) ? <Stamp tone="ok">{t('gov.gatePass')}</Stamp> : <Stamp tone="wait">{t('gov.gateFail')}</Stamp>) : null}
                </div>
                <p className="note">{p.scope}</p>
                {p.evaluation ? <p className="mono text-xs text-ink-2">acc {p.evaluation.fieldAccuracy} · plantadas {p.evaluation.plantedFound}/3 · FP {p.evaluation.falsePositives} · ×{p.evaluation.repetitions}</p> : null}
                <p className="mono text-xs text-ink-3">propuesta por {p.proposedBy} · aprobada por {p.approvedBy ?? '—'}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sheet sheet-body grid content-start gap-3" aria-labelledby="gov-runs">
          <h2 id="gov-runs" className="text-lg">{t('gov.runs')}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div className="field"><dt className="label">{t('gov.runs')}</dt><dd className="figure text-2xl text-left">{runs.length}</dd></div>
            <div className="field"><dt className="label">{t('gov.holds')}</dt><dd className="figure text-2xl text-left" data-testid="hold-count">{holds.length}</dd></div>
          </dl>
          <ul className="grid gap-1 text-sm">{holdReasons.map(([reason, n]) => <li key={reason} className="flex justify-between gap-3"><span>{reason}</span><span className="figure">{n}</span></li>)}</ul>
        </section>
      </div>

      <section className="sheet" aria-labelledby="gov-audit">
        <header className="sheet-head">
          <h2 id="gov-audit" className="text-lg">{t('gov.audit')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {chainOk ? <Stamp tone="ok">{t('gov.chain')}</Stamp> : <Stamp tone="decision">{t('gov.chainBroken')}</Stamp>}
            <select className="input w-auto" value={actorFilter} onChange={(e) => setActorFilter(e.target.value as AuditEntry['actorType'] | '')} aria-label={t('gov.actor')}>
              <option value="">todos</option><option value="persona">persona</option><option value="agente">agente</option><option value="sistema">sistema</option>
            </select>
          </div>
        </header>
        <div className="table-scroll max-h-[32rem] overflow-y-auto">
          <table className="ledger" data-testid="audit-log">
            <thead><tr><th>#</th><th>{t('gov.when')}</th><th>{t('gov.actor')}</th><th>{t('gov.action')}</th><th>{t('gov.entity')}</th><th>{t('gov.hash')}</th></tr></thead>
            <tbody>
              {[...audit].reverse().map((e) => (
                <tr key={e.id}>
                  <td className="mono text-xs">{e.seq}</td>
                  <td className="mono text-xs">{e.at.slice(11, 19)}</td>
                  <td><span className="label">{e.actorType}</span> {e.actor}</td>
                  <td className="mono text-xs">{e.action}</td>
                  <td className="mono text-xs">{e.entity}/{e.entityId}</td>
                  <td className="mono text-xs text-ink-3" title={e.contentHash}>{e.contentHash.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
