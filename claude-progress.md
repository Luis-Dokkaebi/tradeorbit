# Progreso del agente

Bitácora de sesiones para la siguiente sesión. La más reciente arriba.

## Sesión 1 · 2026-11-24

**Hecho**
- Harness completo: `CLAUDE.md`, `specs/` (SDD + constitución protegida), `feature_list.json` (44 criterios), `init.sh`, sensores (`check-secrets`, `check-tokens`, `check-feature-list`, `db-test.sh`), hook de Claude Code que bloquea la constitución y cualquier cambio de `feature_list.json` fuera de `passes`, y hook de git pre-commit.
- Diseño (Hallmark, ruta custom "Expediente"): `design/direction.md` (D-01, pendiente de aprobación humana) y `design/tokens.css` (D-02). Tailwind limitado a tokens.
- App React + TypeScript estricto + Tailwind: banda DEMO global con selector de 3 escenarios, reinicio, reproducción y notas del presentador; expediente con carátula y hoja de ruta de 8 etapas; documentos con origen por campo; discrepancias; costo puesto; propuestas de pago; bandeja de aprobación; conciliación; paquete aduanal; preguntas con citas; gobernanza con bitácora encadenada y pausa global. Español, inglés y chino.
- Funciones de servidor en proceso (`src/server/server.ts`) 1:1 con los endpoints del SDD.
- Migración Supabase (14 tablas, RLS por organización, bitácora inmutable, `execute=false` en la base) verificada en Postgres 16.

**Verificación**: ver `feature_list.json` (`passes`) y la salida de `npm run check`, `npm test`, `npm run e2e`, `npm run db:test`.

**Pendiente / bloqueado**
- D-01: una persona debe aprobar `design/direction.md`.
- D-03: revisión humana de las capturas (`npm run e2e` las deja en `test-results/`).
- Verificar contra el DOF la fracción 6205.20.01, su NICO y la tasa del 35 % antes de la demo; hasta entonces la fila dice "por verificar".
- Conectar un proyecto Supabase real y mover `KiilonovaServer` a Edge Functions; conectar el servicio de IA para extracción (decidir proveedor y presupuesto por documento: pregunta abierta del SDD).
- T-040: tres ensayos completos de 8 minutos y video de respaldo (requiere persona).
- T-042: correcciones en la página de Lovable (fuera de este repositorio).
- Preguntas abiertas del SDD siguen abiertas: mercancía semilla definitiva, aprobador de referencia, documentos reales anonimizados.
