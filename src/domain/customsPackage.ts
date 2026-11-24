import type { DocumentType, TradeDocument } from '../shared/schemas';

export interface ChecklistItem {
  id: string;
  label: string;
  kind: 'documento' | 'requisito';
  satisfiedBy: string | null;
  note: string;
}

const REQUIRED_DOCS: readonly { type: DocumentType; label: string }[] = [
  { type: 'factura', label: 'Factura comercial' },
  { type: 'lista_empaque', label: 'Lista de empaque' },
  { type: 'transporte', label: 'Conocimiento de embarque (BL)' },
  { type: 'comprobante_pago', label: 'Comprobante de pago al proveedor' },
];

/** Requirements by goods category. Textiles add labelling and the sector registry (to verify with the broker). */
const CATEGORY_REQUIREMENTS: Record<string, readonly { id: string; label: string; note: string }[]> = {
  textil: [
    { id: 'nom-004', label: 'Evidencia de etiquetado NOM-004-SE-2021', note: 'Etiqueta en español con composición de fibra, talla, país de origen e instrucciones de cuidado.' },
    { id: 'padron-sectorial', label: 'Padrón de Importadores de Sectores Específicos (textil y confección)', note: 'Confirmar con el agente aduanal la inscripción y el sector aplicable.' },
    { id: 'origen', label: 'Declaración de origen de la mercancía', note: 'China no tiene tratado comercial con México: no aplica preferencia arancelaria.' },
  ],
};

export const buildCustomsChecklist = (documents: readonly TradeDocument[], category: string): ChecklistItem[] => {
  const docs: ChecklistItem[] = REQUIRED_DOCS.map((r) => {
    const doc = documents.find((d) => d.type === r.type && d.status === 'extraido');
    return {
      id: r.type,
      label: r.label,
      kind: 'documento',
      satisfiedBy: doc?.id ?? null,
      note: doc ? doc.fileName : 'Pendiente de subir o de revisión manual',
    };
  });
  const extra: ChecklistItem[] = (CATEGORY_REQUIREMENTS[category] ?? []).map((r) => ({ ...r, kind: 'requisito', satisfiedBy: null }));
  return [...docs, ...extra];
};

export const CUSTOMS_DISCLAIMER =
  'Kiilonova Trade prepara el expediente. El pedimento lo presenta tu agente aduanal; la app no presenta nada ante la autoridad.';
