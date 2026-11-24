import { useContext } from 'react';
import { SCENARIOS } from '../../server/seed/scenarios';
import { I18nContext, LOCALES, useT } from '../../i18n';
import { ErrorNote } from './primitives';
import { useAction, useServer } from '../serverContext';

interface DemoBandProps {
  notesOpen: boolean;
  onToggleNotes: () => void;
}

/** Global DEMO band, visible on every screen (US-12, principle 4). */
export function DemoBand({ notesOpen, onToggleNotes }: DemoBandProps) {
  const t = useT();
  const { server, ctx } = useServer();
  const { locale, setLocale } = useContext(I18nContext);
  const flags = server.getFlags();
  const [run, error] = useAction();

  return (
    <div className="demo-band" role="region" aria-label={t('demo.notice')} data-testid="demo-band">
      <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="demo-mark" data-testid="demo-mark">{t('demo.mark')}</span>
        <span className="hidden text-xs lg:inline mono">{t('demo.notice')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label" id="scenario-label">{t('demo.scenario')}</span>
          <div className="seg" role="group" aria-labelledby="scenario-label">
            {SCENARIOS.map((s) => (
              <button key={s.name} type="button" title={s.summary} aria-pressed={flags.scenario === s.name} onClick={() => run(() => server.loadScenario(ctx, s.name))} data-testid={`scenario-${s.name}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {flags.paused ? <span className="stamp stamp-decision">{t('demo.paused')}</span> : null}
          <button type="button" className="btn btn-sim" onClick={() => run(() => server.resetDemo(ctx))} data-testid="demo-reset">{t('demo.reset')}</button>
          <button type="button" className="btn btn-sim" onClick={() => run(() => server.setReplay(ctx, !flags.replay))} data-testid="demo-replay">
            {t('demo.replay')}: {flags.replay ? 'ON' : 'OFF'}
          </button>
          <button type="button" className="btn btn-sim" aria-expanded={notesOpen} aria-controls="presenter-notes" onClick={onToggleNotes} data-testid="demo-notes">
            {notesOpen ? t('demo.hideNotes') : t('demo.notes')}
          </button>
          <div className="seg" role="group" aria-label={t('demo.language')}>
            {LOCALES.map((l) => (
              <button key={l.code} type="button" lang={l.code} aria-pressed={locale === l.code} onClick={() => setLocale(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? <div className="px-4 pb-2"><ErrorNote message={error} /></div> : null}
      {flags.replay ? (
        <p className="mono border-t border-dashed border-sim px-4 py-1 text-center text-xs" data-testid="replay-banner">{t('demo.replayOn')}</p>
      ) : null}
    </div>
  );
}
