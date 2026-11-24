import type { AgentName } from '../shared/schemas';

/** Agent harness table (SDD § Harness de los agentes en la app). Read-only in the governance panel. */
export interface AgentDefinition {
  name: AgentName;
  label: string;
  reads: string;
  writes: string;
  autonomy: string;
  humanApproval: string;
}

export const AGENTS: readonly AgentDefinition[] = [
  { name: 'orquestador', label: 'Orquestador', reads: 'Estado del expediente', writes: 'Solo crea tareas y enruta', autonomy: 'L4', humanApproval: 'No, no ejecuta efectos' },
  { name: 'documental', label: 'Documental', reads: 'Documentos y expediente', writes: 'Campos extraídos y discrepancias', autonomy: 'L4', humanApproval: 'Revisión si la confianza es menor a 0.80' },
  { name: 'aranceles_costo', label: 'Aranceles y costo', reads: 'Tabla de aranceles y expediente', writes: 'Cotización de costo puesto', autonomy: 'L3', humanApproval: 'Una persona confirma la fracción final' },
  { name: 'financiero', label: 'Financiero', reads: 'Costo puesto y expediente', writes: 'Propuestas de pago con execute en falso', autonomy: 'L2–L3', humanApproval: 'Siempre' },
  { name: 'logistico', label: 'Logístico', reads: 'Eventos de embarque', writes: 'Eventos y alertas de retraso', autonomy: 'L4', humanApproval: 'No' },
  { name: 'aduanero', label: 'Aduanero', reads: 'Documentos y expediente', writes: 'Lista de pendientes y paquete', autonomy: 'L3', humanApproval: 'El agente aduanal presenta el pedimento' },
  { name: 'conciliacion', label: 'Conciliación', reads: 'Registros financieros', writes: 'Conciliación y saldo', autonomy: 'L4', humanApproval: 'No' },
  { name: 'proponente_politicas', label: 'Proponente de políticas', reads: 'Corridas y evaluaciones', writes: 'Políticas en sandbox', autonomy: '—', humanApproval: 'Siempre, y nunca despliega solo' },
];

/** Write permissions per agent: the store refuses writes outside this map (least privilege). */
export const AGENT_WRITE_PERMISSIONS: Record<AgentName, readonly string[]> = {
  orquestador: [],
  documental: ['documents', 'discrepancies', 'shipments', 'suppliers'],
  aranceles_costo: ['landed_cost_quotes'],
  financiero: ['payment_proposals'],
  logistico: ['shipment_events', 'shipments'],
  aduanero: [],
  conciliacion: ['reconciliations'],
  proponente_politicas: ['policies'],
};

export const canWrite = (agent: AgentName, table: string): boolean => AGENT_WRITE_PERMISSIONS[agent].includes(table);

export const POLICY_PROMOTION_GATE = { minFieldAccuracy: '0.95', plantedRequired: 3, maxFalsePositives: 0, repetitions: 5 } as const;
