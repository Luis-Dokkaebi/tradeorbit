import type { ReactNode } from 'react';
import { formatAmount } from '../../shared/money';
import { useT } from '../../i18n';

export type StampTone = 'ok' | 'wait' | 'decision' | 'neutral' | 'sim' | 'authorized-sim';

export function Stamp({ tone, children, enter = false }: { tone: StampTone; children: ReactNode; enter?: boolean }) {
  return <span className={`stamp stamp-${tone}${enter ? ' stamp-enter' : ''}`}>{children}</span>;
}

export function Amount({ value, currency }: { value: string; currency: string }) {
  return (
    <span className="figure">
      {formatAmount(value)}
      <small>{currency}</small>
    </span>
  );
}

export function Field({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="field" data-testid={testId}>
      <dt className="label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Sheet({ title, aside, children, id, className = '' }: { title: ReactNode; aside?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section className={`sheet ${className}`} aria-labelledby={id}>
      <header className="sheet-head">
        <h2 id={id} className="text-lg">{title}</h2>
        {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  const t = useT();
  if (!message) return null;
  return (
    <p role="alert" className="alert-error">
      <strong>{t('common.error')}:</strong> {message}
    </p>
  );
}

export function PageHead({ title, lede, aside }: { title: string; lede: string; aside?: ReactNode }) {
  return (
    <header className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="grid gap-2">
        <h1 className="text-2xl">{title}</h1>
        <p className="note max-w-[62ch]">{lede}</p>
      </div>
      {aside}
    </header>
  );
}

export function Citation({ children }: { children: ReactNode }) {
  return <span className="citation">↳ {children}</span>;
}
