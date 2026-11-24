import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useT, type MessageKey } from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { useServer } from './serverContext';
import { DemoBand } from './components/DemoBand';
import { Masthead } from './components/Masthead';
import { PresenterNotes } from './components/PresenterNotes';
import { useHashRoute, type Route } from './useHashRoute';
import { ApprovalsView } from './views/ApprovalsView';
import { AskView } from './views/AskView';
import { CostView } from './views/CostView';
import { CustomsView } from './views/CustomsView';
import { FileView } from './views/FileView';
import { GovernanceView } from './views/GovernanceView';
import { PaymentsView } from './views/PaymentsView';
import { ReconciliationView } from './views/ReconciliationView';

const VIEWS: Record<Route, ComponentType> = {
  expediente: FileView,
  costo: CostView,
  pagos: PaymentsView,
  aprobaciones: ApprovalsView,
  conciliacion: ReconciliationView,
  aduana: CustomsView,
  preguntar: AskView,
  gobernanza: GovernanceView,
};

const TITLES: Record<Route, MessageKey> = {
  expediente: 'nav.file', costo: 'nav.cost', pagos: 'nav.payments', aprobaciones: 'nav.approvals',
  conciliacion: 'nav.reconciliation', aduana: 'nav.customs', preguntar: 'nav.ask', gobernanza: 'nav.governance',
};

export function App() {
  const t = useT();
  const route = useHashRoute();
  const { server, ctx } = useServer();
  const [notesOpen, setNotesOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const View = VIEWS[route];
  const closeNotes = useCallback(() => setNotesOpen(false), []);

  useEffect(() => {
    document.title = `${t(TITLES[route])} · Kiilonova Trade`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [route, t]);

  return (
    <>
      <button type="button" className="sr-only focus:not-sr-only" onClick={() => mainRef.current?.focus()}>{t('common.skip')}</button>
      <DemoBand notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((o) => !o)} />
      <Masthead route={route} />
      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-shell px-4 py-6 outline-none">
        <ErrorBoundary key={`${route}-${server.getEpoch()}`} onReset={() => server.resetDemo(ctx)}>
          <View key={server.getEpoch()} />
        </ErrorBoundary>
      </main>
      <footer className="mx-auto w-full max-w-shell border-t border-rule px-4 py-4">
        <p className="mono text-xs text-ink-3">Kiilonova Trade · Entorno de demostración · Datos sintéticos · Ninguna función mueve dinero, firma o presenta ante una autoridad.</p>
      </footer>
      {notesOpen ? <PresenterNotes onClose={closeNotes} /> : null}
    </>
  );
}
