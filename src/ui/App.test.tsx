import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../i18n';
import { App } from './App';
import { ServerProvider } from './serverContext';
import { makeServer } from '../test/fixtures';

const renderApp = (scenario: 'limpio' | 'discrepancia' | 'retraso' = 'discrepancia') => {
  const server = makeServer(scenario);
  render(
    <I18nContext.Provider value={{ locale: 'es', setLocale: () => undefined }}>
      <ServerProvider server={server}>
        <App />
      </ServerProvider>
    </I18nContext.Provider>,
  );
  return server;
};

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/expediente';
  });

  it('always shows the DEMO band', () => {
    renderApp();
    expect(within(screen.getByTestId('demo-band')).getByTestId('demo-mark')).toHaveTextContent('DEMO');
  });

  it('opens the file from the purchase order and flags the low-confidence ETA', async () => {
    renderApp();
    await userEvent.click(screen.getByTestId('open-from-po'));
    expect(screen.getByTestId('file-folio')).toHaveTextContent('SHP-0001');
    expect(within(screen.getByTestId('eta-field')).getByText(/Requiere revisión/)).toBeInTheDocument();
  });

  it('shows the three planted discrepancies after uploading the documents', async () => {
    renderApp();
    await userEvent.click(screen.getByTestId('open-from-po'));
    for (const id of ['DIS-FAC', 'DIS-LE', 'DIS-CP', 'DIS-BL']) await userEvent.click(screen.getByTestId(`upload-${id}`));
    for (const type of ['importe', 'cantidad', 'proveedor']) expect(screen.getByTestId(`disc-${type}`)).toBeInTheDocument();
  });

  it('clean scenario shows no discrepancies and a reconciled stamp', () => {
    renderApp('limpio');
    expect(screen.getByTestId('discrepancies-none')).toBeInTheDocument();
    expect(within(screen.getByTestId('route-slip')).getAllByText('Conciliado').length).toBeGreaterThan(0);
  });

  it('switching scenario from the band reloads the seed state', async () => {
    renderApp('limpio');
    await userEvent.click(screen.getByTestId('scenario-retraso'));
    expect(screen.getByTestId('delay-alert')).toBeInTheDocument();
  });
});
