import { addDays, formatDateEs } from '../../shared/dates';
import type { DocumentType, ScenarioName } from '../../shared/schemas';

/**
 * Synthetic seed set (NFR-08): zero real customer data. Supplier, importer, carrier and numbers are fictitious.
 * 3 purchase orders + 12 supporting documents (4 per scenario) with 3 planted discrepancies in 'discrepancia'.
 */
export const IMPORTER = 'Camisería Ejemplo del Bajío, S.A. de C.V. (ficticia)';
export const SUPPLIER_NAME = 'Dongyuan Muestra Garments Co., Ltd.';
export const SUPPLIER_VARIANT = 'Dongyuan Muestra Apparel Trading Co., Ltd.';
export const CARRIER = 'Línea Naviera Orbe (ficticia)';

export interface SeedDocument {
  id: string;
  scenario: ScenarioName;
  type: DocumentType;
  fileName: string;
  pages: string[][];
  /** Ground truth for the extraction eval (NFR-02). */
  truth: Record<string, string>;
}

interface ScenarioFacts {
  docPrefix: string;
  po: string;
  invoice: string;
  qtyOrdered: number;
  qtyInvoiced: number;
  qtyPacked: number;
  invoiceAmount: string;
  invoiceSupplier: string;
  packingSupplier: string;
  paid: string;
  poDate: string;
  eta: string;
  sail: string;
  bl: string;
  container: string;
  etaLineNoisy: boolean;
}

const UNIT_PRICE = '27.40';
const ORDER_AMOUNT = '5480.00';

const facts = (base: string): Record<ScenarioName, ScenarioFacts> => ({
  limpio: {
    docPrefix: 'LIM', po: 'OC-2026-0141', invoice: 'DYM-INV-26-0388', qtyOrdered: 200, qtyInvoiced: 200, qtyPacked: 200,
    invoiceAmount: ORDER_AMOUNT, invoiceSupplier: 'DONGYUAN MUESTRA GARMENTS CO LTD', packingSupplier: SUPPLIER_NAME,
    paid: ORDER_AMOUNT, poDate: addDays(base, -48), eta: addDays(base, -6), sail: addDays(base, -30),
    bl: 'ORB-NGB-261031', container: 'ORBU 482113-6', etaLineNoisy: false,
  },
  discrepancia: {
    docPrefix: 'DIS', po: 'OC-2026-0152', invoice: 'DYM-INV-26-0411', qtyOrdered: 200, qtyInvoiced: 200, qtyPacked: 180,
    invoiceAmount: '5840.00', invoiceSupplier: SUPPLIER_VARIANT, packingSupplier: SUPPLIER_NAME,
    paid: '1644.00', poDate: addDays(base, -21), eta: addDays(base, 18), sail: addDays(base, -2),
    bl: 'ORB-NGB-261122', container: 'ORBU 490257-1', etaLineNoisy: true,
  },
  retraso: {
    docPrefix: 'RET', po: 'OC-2026-0137', invoice: 'DYM-INV-26-0372', qtyOrdered: 200, qtyInvoiced: 200, qtyPacked: 200,
    invoiceAmount: ORDER_AMOUNT, invoiceSupplier: SUPPLIER_NAME, packingSupplier: SUPPLIER_NAME,
    paid: '1644.00', poDate: addDays(base, -55), eta: addDays(base, -4), sail: addDays(base, -33),
    bl: 'ORB-NGB-261019', container: 'ORBU 471880-4', etaLineNoisy: false,
  },
});

const usd = (amount: string): string => `USD ${amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export const purchaseOrderFor = (scenario: ScenarioName, base: string): SeedDocument => {
  const f = facts(base)[scenario];
  return {
    id: `${f.docPrefix}-OC`,
    scenario,
    type: 'orden_compra',
    fileName: `${f.po}.pdf`,
    pages: [[
      'ORDEN DE COMPRA',
      `Folio: ${f.po}`,
      `Comprador: ${IMPORTER}`,
      `Proveedor: ${SUPPLIER_NAME}`,
      'País del proveedor: CN',
      'Mercancía: Camisa de algodón para caballero, manga larga, tejido plano',
      `Cantidad: ${f.qtyOrdered} piezas`,
      `Precio unitario: ${usd(UNIT_PRICE)}`,
      `Importe total: ${usd(ORDER_AMOUNT)}`,
      'Moneda: USD',
      'Incoterm: FOB Ningbo',
      `Fecha de emisión: ${formatDateEs(f.poDate)}`,
      f.etaLineNoisy ? `Fecha est1mada de arr1bo: ${formatDateEs(f.eta)}` : `Fecha estimada de arribo: ${formatDateEs(f.eta)}`,
    ]],
    truth: {
      folio: f.po, proveedor: SUPPLIER_NAME, mercancia: 'Camisa de algodón para caballero, manga larga, tejido plano',
      cantidad: String(f.qtyOrdered), precio_unitario: UNIT_PRICE, importe: ORDER_AMOUNT, moneda: 'USD', incoterm: 'FOB Ningbo', fecha_estimada: f.eta,
    },
  };
};

export const supportingDocumentsFor = (scenario: ScenarioName, base: string): SeedDocument[] => {
  const f = facts(base)[scenario];
  return [
    {
      id: `${f.docPrefix}-FAC`, scenario, type: 'factura', fileName: `${f.invoice}.pdf`,
      pages: [[
        'COMMERCIAL INVOICE / FACTURA COMERCIAL',
        `Folio: ${f.invoice}`,
        `Proveedor: ${f.invoiceSupplier}`,
        `Cliente: ${IMPORTER}`,
        `Referencia OC: ${f.po}`,
        `Cantidad: ${f.qtyInvoiced} piezas`,
        `Importe total: ${usd(f.invoiceAmount)}`,
        'Moneda: USD',
      ]],
      truth: { folio: f.invoice, proveedor: f.invoiceSupplier, referencia_oc: f.po, cantidad: String(f.qtyInvoiced), importe: f.invoiceAmount, moneda: 'USD' },
    },
    {
      id: `${f.docPrefix}-LE`, scenario, type: 'lista_empaque', fileName: `PL-${f.invoice}.pdf`,
      pages: [[
        'PACKING LIST / LISTA DE EMPAQUE',
        `Proveedor: ${f.packingSupplier}`,
        `Referencia OC: ${f.po}`,
        `Cantidad: ${f.qtyPacked} piezas`,
        `Bultos: ${Math.ceil(f.qtyPacked / 50)} cajas`,
        `Peso bruto: ${(f.qtyPacked * 0.31).toFixed(1)} kg`,
      ]],
      truth: { proveedor: f.packingSupplier, referencia_oc: f.po, cantidad: String(f.qtyPacked), bultos: String(Math.ceil(f.qtyPacked / 50)), peso_bruto: (f.qtyPacked * 0.31).toFixed(1) },
    },
    {
      id: `${f.docPrefix}-CP`, scenario, type: 'comprobante_pago', fileName: `SWIFT-${f.po}.pdf`,
      pages: [[
        'COMPROBANTE DE TRANSFERENCIA (MT103)',
        `Referencia: TRF-${f.po.slice(-4)}-${scenario.slice(0, 3).toUpperCase()}`,
        `Beneficiario: ${SUPPLIER_NAME}`,
        `Importe: ${usd(f.paid)}`,
        'Moneda: USD',
        `Fecha valor: ${formatDateEs(addDays(f.poDate, 3))}`,
      ]],
      truth: { referencia: `TRF-${f.po.slice(-4)}-${scenario.slice(0, 3).toUpperCase()}`, beneficiario: SUPPLIER_NAME, importe: f.paid, moneda: 'USD', fecha: addDays(f.poDate, 3) },
    },
    {
      id: `${f.docPrefix}-BL`, scenario, type: 'transporte', fileName: `BL-${f.bl}.pdf`,
      pages: [[
        'BILL OF LADING / CONOCIMIENTO DE EMBARQUE',
        `Número de BL: ${f.bl}`,
        `Naviera: ${CARRIER}`,
        'Puerto de carga: Ningbo, CN',
        'Puerto de descarga: Manzanillo, MX',
        `Contenedor: ${f.container}`,
        `Fecha de zarpe: ${formatDateEs(f.sail)}`,
      ]],
      truth: { numero_bl: f.bl, naviera: CARRIER, puerto_carga: 'Ningbo, CN', puerto_descarga: 'Manzanillo, MX', contenedor: f.container, fecha_zarpe: f.sail },
    },
  ];
};

/** An unreadable scan, used to prove an illegible document never blocks the file (US-02). */
export const illegibleDocument = (docPrefix: string): SeedDocument => ({
  id: `${docPrefix}-ILEG`,
  scenario: 'discrepancia',
  type: 'transporte',
  fileName: 'escaneo-borroso.jpg',
  pages: [['#&%  ~~ ..  ;;; ||| ##', '...  ~ ~ ~  ::  ..']],
  truth: {},
});

export const SCENARIO_FACTS = facts;
