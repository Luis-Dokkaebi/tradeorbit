import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nContext, type Locale } from './i18n';
import { KiilonovaServer } from './server/server';
import { App } from './ui/App';
import { ServerProvider } from './ui/serverContext';
import './styles/index.css';

const server = new KiilonovaServer({ scenario: 'discrepancia' });

function Root() {
  const [locale, setLocale] = useState<Locale>('es');
  const value = useMemo(
    () => ({
      locale,
      setLocale: (l: Locale) => {
        setLocale(l);
        document.documentElement.lang = l === 'es' ? 'es-MX' : l;
      },
    }),
    [locale],
  );
  return (
    <I18nContext.Provider value={value}>
      <ServerProvider server={server}>
        <App />
      </ServerProvider>
    </I18nContext.Provider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root no encontrado');
createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
