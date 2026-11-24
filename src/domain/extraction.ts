import type { DocumentType, ExtractedField } from '../shared/schemas';

/**
 * Deterministic field extractor for text-layer documents. In production this is a server function
 * that calls the AI service; in the MVP the seed set is synthetic and this extractor is the baseline
 * the eval (NFR-02) measures. Each field records page and box of origin (US-02).
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.8;

interface FieldSpec {
  key: string;
  label: string;
  patterns: readonly { re: RegExp; confidence: number }[];
  normalize?: (raw: string) => string;
  numeric?: boolean;
}

const amount = (raw: string): string => raw.replace(/USD|USDC|MXN|\s/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
const integer = (raw: string): string => raw.replace(/[^\d]/g, '');
const decimalNumber = (raw: string): string => raw.replace(/[^\d.]/g, '');
const dateEs = (raw: string): string => {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw.trim();
};

const exact = (label: string): RegExp => new RegExp(`^${label}:\\s*(.+)$`, 'i');

const SPECS: Record<DocumentType, readonly FieldSpec[]> = {
  orden_compra: [
    { key: 'folio', label: 'Folio', patterns: [{ re: exact('Folio'), confidence: 0.98 }] },
    { key: 'proveedor', label: 'Proveedor', patterns: [{ re: exact('Proveedor'), confidence: 0.97 }] },
    { key: 'mercancia', label: 'Mercancía', patterns: [{ re: exact('Mercancía'), confidence: 0.95 }] },
    { key: 'cantidad', label: 'Cantidad', patterns: [{ re: exact('Cantidad'), confidence: 0.98 }], normalize: integer, numeric: true },
    { key: 'precio_unitario', label: 'Precio unitario', patterns: [{ re: exact('Precio unitario'), confidence: 0.97 }], normalize: amount, numeric: true },
    { key: 'importe', label: 'Importe', patterns: [{ re: exact('Importe total'), confidence: 0.98 }], normalize: amount, numeric: true },
    { key: 'moneda', label: 'Moneda', patterns: [{ re: exact('Moneda'), confidence: 0.99 }] },
    { key: 'incoterm', label: 'Incoterm', patterns: [{ re: exact('Incoterm'), confidence: 0.96 }] },
    {
      key: 'fecha_estimada',
      label: 'Fecha estimada de arribo',
      patterns: [
        { re: exact('Fecha estimada de arribo'), confidence: 0.97 },
        { re: /^Fecha est[i1l]mada de arr[i1l]bo:\s*(.+)$/i, confidence: 0.74 },
      ],
      normalize: dateEs,
    },
  ],
  factura: [
    { key: 'folio', label: 'Folio', patterns: [{ re: exact('Folio'), confidence: 0.98 }] },
    { key: 'proveedor', label: 'Proveedor', patterns: [{ re: exact('Proveedor'), confidence: 0.96 }] },
    { key: 'referencia_oc', label: 'Referencia OC', patterns: [{ re: exact('Referencia OC'), confidence: 0.97 }] },
    { key: 'cantidad', label: 'Cantidad', patterns: [{ re: exact('Cantidad'), confidence: 0.98 }], normalize: integer, numeric: true },
    { key: 'importe', label: 'Importe', patterns: [{ re: exact('Importe total'), confidence: 0.98 }], normalize: amount, numeric: true },
    { key: 'moneda', label: 'Moneda', patterns: [{ re: exact('Moneda'), confidence: 0.99 }] },
  ],
  lista_empaque: [
    { key: 'proveedor', label: 'Proveedor', patterns: [{ re: exact('Proveedor'), confidence: 0.96 }] },
    { key: 'referencia_oc', label: 'Referencia OC', patterns: [{ re: exact('Referencia OC'), confidence: 0.97 }] },
    { key: 'cantidad', label: 'Cantidad', patterns: [{ re: exact('Cantidad'), confidence: 0.98 }], normalize: integer, numeric: true },
    { key: 'bultos', label: 'Bultos', patterns: [{ re: exact('Bultos'), confidence: 0.95 }], normalize: integer, numeric: true },
    { key: 'peso_bruto', label: 'Peso bruto (kg)', patterns: [{ re: exact('Peso bruto'), confidence: 0.94 }], normalize: decimalNumber, numeric: true },
  ],
  comprobante_pago: [
    { key: 'referencia', label: 'Referencia', patterns: [{ re: exact('Referencia'), confidence: 0.97 }] },
    { key: 'beneficiario', label: 'Beneficiario', patterns: [{ re: exact('Beneficiario'), confidence: 0.96 }] },
    { key: 'importe', label: 'Importe', patterns: [{ re: exact('Importe'), confidence: 0.98 }], normalize: amount, numeric: true },
    { key: 'moneda', label: 'Moneda', patterns: [{ re: exact('Moneda'), confidence: 0.99 }] },
    { key: 'fecha', label: 'Fecha valor', patterns: [{ re: exact('Fecha valor'), confidence: 0.97 }], normalize: dateEs },
  ],
  transporte: [
    { key: 'numero_bl', label: 'Número de BL', patterns: [{ re: exact('Número de BL'), confidence: 0.98 }] },
    { key: 'naviera', label: 'Naviera', patterns: [{ re: exact('Naviera'), confidence: 0.95 }] },
    { key: 'puerto_carga', label: 'Puerto de carga', patterns: [{ re: exact('Puerto de carga'), confidence: 0.96 }] },
    { key: 'puerto_descarga', label: 'Puerto de descarga', patterns: [{ re: exact('Puerto de descarga'), confidence: 0.96 }] },
    { key: 'contenedor', label: 'Contenedor', patterns: [{ re: exact('Contenedor'), confidence: 0.95 }] },
    { key: 'fecha_zarpe', label: 'Fecha de zarpe', patterns: [{ re: exact('Fecha de zarpe'), confidence: 0.97 }], normalize: dateEs },
  ],
};

/** Approximate box in PDF points for a given text line (A4, 48 pt margin, 20 pt leading). */
const boxFor = (line: number): [number, number, number, number] => [48, 72 + line * 20, 480, 16];

export interface ExtractionResult {
  fields: ExtractedField[];
  status: 'extraido' | 'revision_manual';
  missing: string[];
}

export const extractFields = (documentId: string, type: DocumentType, pages: readonly (readonly string[])[], threshold = LOW_CONFIDENCE_THRESHOLD): ExtractionResult => {
  const fields: ExtractedField[] = [];
  const missing: string[] = [];
  for (const spec of SPECS[type]) {
    let found: ExtractedField | null = null;
    pages.forEach((lines, pageIndex) => {
      lines.forEach((line, lineIndex) => {
        if (found) return;
        for (const p of spec.patterns) {
          const m = line.trim().match(p.re);
          if (m?.[1]) {
            const raw = m[1].trim();
            const value = spec.normalize ? spec.normalize(raw) : raw;
            // A normalized number that is not a plain decimal (e.g. "5.480,00") is never trusted.
            const malformed = spec.numeric === true && !/^\d+(\.\d+)?$/.test(value);
            const confidence = malformed ? Math.min(p.confidence, 0.5) : p.confidence;
            found = {
              key: spec.key,
              label: spec.label,
              value: malformed ? raw : value,
              confidence,
              needsReview: confidence < threshold,
              source: { documentId, page: pageIndex + 1, box: boxFor(lineIndex) },
            };
            break;
          }
        }
      });
    });
    if (found) fields.push(found);
    else missing.push(spec.key);
  }
  const requiredRatio = fields.length / SPECS[type].length;
  return { fields, missing, status: requiredRatio >= 0.5 ? 'extraido' : 'revision_manual' };
};

export const fieldSpecsFor = (type: DocumentType): readonly { key: string; label: string }[] =>
  SPECS[type].map(({ key, label }) => ({ key, label }));
