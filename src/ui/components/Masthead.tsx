import { useT, type MessageKey } from '../../i18n';
import { useServer } from '../serverContext';
import { href, type Route } from '../useHashRoute';

const NAV: readonly { route: Route; key: MessageKey }[] = [
  { route: 'expediente', key: 'nav.file' },
  { route: 'costo', key: 'nav.cost' },
  { route: 'pagos', key: 'nav.payments' },
  { route: 'aprobaciones', key: 'nav.approvals' },
  { route: 'conciliacion', key: 'nav.reconciliation' },
  { route: 'aduana', key: 'nav.customs' },
  { route: 'preguntar', key: 'nav.ask' },
  { route: 'gobernanza', key: 'nav.governance' },
];

export function Masthead({ route }: { route: Route }) {
  const t = useT();
  const { server, ctx } = useServer();
  const waiting = server.listProposals(ctx).filter((p) => p.status === 'en_aprobacion').length;

  return (
    <header className="mx-auto w-full max-w-shell px-4 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-4">
        <a href={href('expediente')} className="grid gap-1 no-underline" aria-label={t('app.name')}>
          <span className="wordmark">KIILONOVA&nbsp;TRADE</span>
          <span className="label">{t('app.tagline')} · MX ← CN</span>
        </a>
        <p className="note mono text-xs">{t('app.principle')}</p>
      </div>
      <nav className="tabs" aria-label={t('nav.label')}>
        {NAV.map((n) => (
          <a key={n.route} className="tab" href={href(n.route)} aria-current={route === n.route ? 'page' : undefined} data-testid={`nav-${n.route}`}>
            {t(n.key)}
            {n.route === 'aprobaciones' && waiting > 0 ? <span className="count-decision" aria-label={`${waiting}`}>{waiting}</span> : null}
          </a>
        ))}
      </nav>
    </header>
  );
}
