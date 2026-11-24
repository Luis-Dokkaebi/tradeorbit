import { formatAmount } from '../shared/money';
import { formatDateEs } from '../shared/dates';
import type { AskResult, Reconciliation, TradeDocument } from '../shared/schemas';
import type { ChecklistItem } from './customsPackage';
import type { TimelineStep } from './logistics';

export interface AskContext {
  shipmentId: string;
  reconciliation: Reconciliation;
  documents: readonly TradeDocument[];
  checklist: readonly ChecklistItem[];
  timeline: readonly TimelineStep[];
}

const SIN_DATO = 'Sin dato: el expediente no contiene evidencia para responder eso.';

const normalize = (q: string): string =>
  q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();

type Intent = 'pagado' | 'falta_pagar' | 'falta_documento' | 'llegada';

const INTENTS: readonly { intent: Intent; re: RegExp }[] = [
  { intent: 'falta_documento', re: /\b(que|cual|cuales)\b.*\bdocumento/ },
  { intent: 'falta_pagar', re: /\b(cuanto|que)\b.*\b(falta|debo|saldo|resta|pendiente)/ },
  { intent: 'pagado', re: /\b(ya )?(pague|pagamos|pagado|pago)\b/ },
  { intent: 'llegada', re: /\b(cuando|fecha)\b.*\b(llega|arriba|entrega|llegada)/ },
];

/** Answers four questions from the record with citations; anything else is "sin dato" (US-10, principle 3). */
export const askShipment = (question: string, ctx: AskContext): AskResult => {
  const q = normalize(question);
  const intent = INTENTS.find((i) => i.re.test(q))?.intent;
  const rec = ctx.reconciliation;
  const recCitation = { entity: 'reconciliations', id: rec.id, label: `Conciliación ${ctx.shipmentId}` };
  const paymentDocs = ctx.documents.filter((d) => d.type === 'comprobante_pago' && d.status === 'extraido');

  switch (intent) {
    case 'pagado': {
      if (paymentDocs.length === 0) {
        return { question, answer: 'No hay ningún comprobante de pago en el expediente. Las propuestas autorizadas (simuladas) no cuentan como pago.', citations: [recCitation], sinDato: false };
      }
      const full = rec.balance === '0.00';
      return {
        question,
        answer: `${full ? 'Sí, completo' : 'Parcialmente'}: pagado ${formatAmount(rec.paid)} USD de ${formatAmount(rec.invoiced)} USD facturados.`,
        citations: [...paymentDocs.map((d) => ({ entity: 'documents', id: d.id, label: d.fileName })), recCitation],
        sinDato: false,
      };
    }
    case 'falta_pagar':
      return {
        question,
        answer: `Falta por pagar ${formatAmount(rec.balance)} USD (facturado ${formatAmount(rec.invoiced)} − pagado ${formatAmount(rec.paid)}). Estado: ${rec.status.replace('_', ' ')}.`,
        citations: [recCitation, ...rec.sources.map((id) => ({ entity: 'documents', id, label: id }))],
        sinDato: false,
      };
    case 'falta_documento': {
      const pending = ctx.checklist.filter((c) => c.kind === 'documento' && c.satisfiedBy === null);
      return {
        question,
        answer: pending.length === 0 ? 'No falta ningún documento de soporte.' : `Falta: ${pending.map((p) => p.label).join(', ')}.`,
        citations: [{ entity: 'customs_checklist', id: ctx.shipmentId, label: 'Lista de pendientes aduanales' }],
        sinDato: false,
      };
    }
    case 'llegada': {
      const delivery = ctx.timeline.find((s) => s.type === 'entrega');
      const arrival = ctx.timeline.find((s) => s.type === 'arribo');
      if (delivery?.state === 'hecho' && delivery.date && delivery.eventId) {
        return { question, answer: `Ya se entregó el ${formatDateEs(delivery.date)}.`, citations: [{ entity: 'shipment_events', id: delivery.eventId, label: delivery.label }], sinDato: false };
      }
      if (arrival?.date && arrival.eventId) {
        const overdue = arrival.state === 'vencido' ? ' La fecha ya venció: el expediente está en retraso.' : '';
        return {
          question,
          answer: `Arribo estimado a puerto: ${formatDateEs(arrival.date)} (${arrival.origin === 'demo' ? 'evento registrado' : 'captura manual'}).${overdue}`,
          citations: [{ entity: 'shipment_events', id: arrival.eventId, label: arrival.label }],
          sinDato: false,
        };
      }
      return { question, answer: SIN_DATO, citations: [], sinDato: true };
    }
    default:
      return { question, answer: SIN_DATO, citations: [], sinDato: true };
  }
};
