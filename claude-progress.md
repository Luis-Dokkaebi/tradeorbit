# Progreso del agente

Bitácora de sesiones para la siguiente sesión. La más reciente arriba.

## Sesión 2 · 2026-11-24

- `vercel.json` (Vite estático, cabeceras de seguridad, `noindex`) y Node 22. Build verificado en clon limpio.
- Por decisión del dueño, la vista pública ya no muestra la etiqueta DEMO; los controles del presentador solo aparecen con `?presentador`. Ver `specs/proposals/2026-11-24-ocultar-demo.md`.
- US-12.c queda en `passes: false` hasta que el dueño enmiende el principio 4 y el criterio (archivos protegidos).

## Sesión 1 · 2026-11-24

**Hecho**
- Harness completo: `CLAUDE.md`, `specs/` (SDD + constitución protegida), `feature_list.json` (44 criterios), `init.sh`, sensores (`check-secrets`, `check-tokens`, `check-feature-list`, `db-test.sh`), hook de Claude Code que bloquea la constitución y cualquier cambio de `feature_list.json` fuera de `passes`, y hook de git pre-commit.
- Diseño (Hallmark, ruta custom "Expediente"): `design/direction.md` (D-01, pendiente de aprobación humana) y `design/tokens.css` (D-02). Tailwind limitado a tokens.
- App React + TypeScript estricto + Tailwind: banda DEMO global con selector de 3 escenarios, reinicio, reproducción y notas del presentador; expediente con carátula y hoja de ruta de 8 etapas; documentos con origen por campo; discrepancias; costo puesto; propuestas de pago; bandeja de aprobación; conciliación; paquete aduanal; preguntas con citas; gobernanza con bitácora encadenada y pausa global. Español, inglés y chino.
- Funciones de servidor en proceso (`src/server/server.ts`) 1:1 con los endpoints del SDD.
- Migración Supabase (14 tablas, RLS por organización, bitácora inmutable, `execute=false` en la base) verificada en Postgres 16.

**Sensor inferencial (4 revisores en paralelo: spec, seguridad, React, accesibilidad)** — hallazgos corregidos:
- Spec: el reinicio ya no borra la bitácora (solo agrega); un expediente con discrepancia abierta nunca queda "Conciliado"; el formulario registra su propio proveedor (KYB pendiente) con confianza de captura manual; evaluaciones de políticas: la activa se mide en vivo sobre el set semilla y la sandbox se marca "DEMO · ilustrativo, no medido"; reproducción sirve de verdad la salida guardada; autorizar con discrepancias altas abiertas exige motivo; validación Zod en todas las funciones de servidor; montos ambiguos ("5.480,00") van a revisión; no se suman monedas distintas; la pausa detiene antes de escribir.
- Seguridad: migración con claves compuestas `(org_id, id)`, revocación explícita a `anon/authenticated`, transiciones de propuestas solo vía `app.submit_proposal` / `app.decide_proposal` (aprobador desde el JWT), políticas nacen en sandbox y sin UPDATE para inquilinos, cadena de hash de la bitácora calculada por la base, políticas de storage por carpeta de organización; bitácora en memoria con una cadena por organización, hash canónico recomputable; caché de reproducción por organización; hook de harness falla cerrado y resuelve symlinks; `db-test.sh` con directorio y socket privados; zod 4.6.7 (advisory GHSA-mrhx-c7xc-m3w5).
- React: sin efectos dentro de `setState`; `ErrorBoundary`; vistas se remontan al cambiar de escenario (época); errores de servidor visibles en banda DEMO, aduana y gobernanza.
- Accesibilidad: foco visible en grupos segmentados, pestañas y selector de archivo; borde de inputs ≥3:1 (`--color-control-border`); banda DEMO no fija en móvil; etiquetas visibles; foco y título al cambiar de sección; notas del presentador con Escape y retorno de foco.

**Verificación (verde)**: `npm run check`, `npm test` (94 pruebas, cobertura 99 % líneas), `npm run e2e` (16 pruebas: guion completo, escenarios, DEMO en 8 pantallas, <3 s y sin red, móvil), `npm run db:test` (9 verificaciones de RLS en PostgreSQL 16). `feature_list.json`: 40/44 en verde.

**Dependencias de desarrollo**: `npm audit` aún reporta avisos en herramientas de desarrollo (vitest/tinypool, esbuild, postcss). No llegan al bundle de producción; actualizar en una sesión dedicada.

**Pendiente / bloqueado**
- D-01: una persona debe aprobar `design/direction.md`.
- NFR-05: falta probar el almacenamiento privado en un proyecto Supabase real (la política de storage existe en la migración pero el Postgres local no tiene el esquema `storage`).
- D-03: revisión humana de las capturas (`npm run e2e` las deja en `test-results/`).
- Verificar contra el DOF la fracción 6205.20.01, su NICO y la tasa del 35 % antes de la demo; hasta entonces la fila dice "por verificar".
- Conectar un proyecto Supabase real y mover `KiilonovaServer` a Edge Functions; conectar el servicio de IA para extracción (decidir proveedor y presupuesto por documento: pregunta abierta del SDD).
- T-040: tres ensayos completos de 8 minutos y video de respaldo (requiere persona).
- T-042: correcciones en la página de Lovable (fuera de este repositorio).
- Preguntas abiertas del SDD siguen abiertas: mercancía semilla definitiva, aprobador de referencia, documentos reales anonimizados.
