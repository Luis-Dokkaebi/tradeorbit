import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { href, type Route } from '../useHashRoute';

const SCRIPT: readonly { at: string; title: string; story: string; route: Route; say: string }[] = [
  { at: '0:00', title: 'El problema', story: '30 s', route: 'expediente', say: 'Hoy una importación son 14 pasos repartidos entre bancos, correos, WhatsApp y hojas de cálculo.' },
  { at: '0:30', title: 'Abrir el expediente', story: 'US-01', route: 'expediente', say: 'Escenario "Con discrepancia". Sube la orden de compra: la fecha estimada sale marcada por baja confianza.' },
  { at: '1:30', title: 'Documento con error plantado', story: 'US-02 · US-03', route: 'expediente', say: 'Sube factura, lista de empaque, comprobante y BL. Aparecen 3 discrepancias con su tarea.' },
  { at: '3:00', title: 'Costo puesto en bodega', story: 'US-04', route: 'costo', say: 'Fracción, tasa con fuente y fecha, y total. Explica que los aranceles cambiaron en 2026 y la fila se verifica contra el DOF.' },
  { at: '4:30', title: 'Propuesta y aprobación', story: 'US-05 · US-06', route: 'pagos', say: 'Dos rutas con etiqueta DEMO. "Enviar a aprobación", autorizar y decir: no se movió dinero.' },
  { at: '6:00', title: 'Conciliación y pregunta', story: 'US-09 · US-10', route: 'preguntar', say: '"¿Cuánto falta por pagar?" con cita al registro.' },
  { at: '7:00', title: 'Gobernanza', story: 'US-11', route: 'gobernanza', say: 'Bitácora que no se edita y una política en "sandbox, sin despliegue".' },
  { at: '7:30', title: 'Cierre', story: '30 s', route: 'gobernanza', say: 'Piloto de 90 días: medir primero la línea base en 5 a 10 pymes. Sin esa base no se declara ahorro.' },
];

export function PresenterNotes({ onClose }: { onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <aside id="presenter-notes" ref={ref} tabIndex={-1} className="drawer" aria-label={t('notes.title')} data-testid="presenter-notes">
      <header className="sheet-head">
        <h2 className="text-lg">{t('notes.title')}</h2>
        <button type="button" className="btn btn-quiet" onClick={onClose}>{t('common.close')}</button>
      </header>
      <ol className="grid">
        {SCRIPT.map((s) => (
          <li key={s.at} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-rule px-4 py-3">
            <span className="mono text-sm">{s.at}</span>
            <div className="grid gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <a className="font-display text-base" href={href(s.route)}>{s.title}</a>
                <span className="label">{s.story}</span>
              </div>
              <p className="note">{s.say}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
