import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

/** Keeps a failing view from blanking the whole demo; offers a one-click reset to the seed state. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Vista con error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="decision-surface sheet-body grid justify-items-start gap-3">
        <p className="font-display text-lg">No se pudo mostrar esta sección.</p>
        <p className="mono text-sm">{this.state.error.message}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        >
          Reiniciar demo
        </button>
      </div>
    );
  }
}
