import { useState } from 'react';
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

const VIEWS: Record<Route, () => JSX.Element> = {
  expediente: FileView,
  costo: CostView,
  pagos: PaymentsView,
  aprobaciones: ApprovalsView,
  conciliacion: ReconciliationView,
  aduana: CustomsView,
  preguntar: AskView,
  gobernanza: GovernanceView,
};

export function App() {
  const route = useHashRoute();
  const [notesOpen, setNotesOpen] = useState(false);
  const View = VIEWS[route];
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">Saltar al contenido</a>
      <DemoBand notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((o) => !o)} />
      <Masthead route={route} />
      <main id="main" className="mx-auto w-full max-w-shell px-4 py-6">
        <View />
      </main>
      <footer className="mx-auto w-full max-w-shell border-t border-rule px-4 py-4">
        <p className="mono text-xs text-ink-3">Kiilonova Trade MVP · DEMO · Datos sintéticos · Ninguna función mueve dinero, firma o presenta ante una autoridad.</p>
      </footer>
      {notesOpen ? <PresenterNotes onClose={() => setNotesOpen(false)} /> : null}
    </>
  );
}
