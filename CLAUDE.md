# Kiilonova Trade MVP — guía del agente de código

Expediente inteligente de importación China → México. **Los agentes proponen, una persona autoriza, no se mueve dinero.**

## Antes de cada tarea (lazo de sesión)

1. Lee `specs/constitution.md` (8 principios, no negociables), este archivo, `claude-progress.md`, `feature_list.json` y `git log --oneline -20`.
2. Corre `./init.sh` (instala, activa hooks de git, `check` + `test`, muestra el siguiente criterio pendiente).
3. Elige **una sola** tarea pendiente, la de mayor prioridad (P1 > P2 > NFR > Diseño).
4. Escribe primero la prueba que expresa su criterio de aceptación (RED).
5. Implementa hasta que la prueba pase y los sensores estén en verde (GREEN).
6. Verifica el flujo de la historia en el navegador: `npm run e2e`.
7. Pide revisión a un segundo agente contra el spec y la constitución (ver "Sensor inferencial").
8. Commit; marca `passes: true` en `feature_list.json` **solo** si todo está en verde; actualiza `claude-progress.md`.

### Condiciones de parada
- Un cambio viola la constitución: detente y pregunta.
- El spec es ambiguo: propón el cambio en `specs/proposals/` y espera aprobación.
- Una tarea falla dos veces con la misma causa: documenta el bloqueo en `claude-progress.md` y pasa a otra.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run check` | Tipado estricto, lint, escaneo de secretos, tokens de diseño, forma de `feature_list.json` |
| `npm test` | Unitarias + integración (Vitest) — dinero, costo, FX, conciliación, esquemas, servidor |
| `npm run test:coverage` | Cobertura (umbral 80 % en dominio, servidor, shared, i18n) |
| `npm run e2e` | Guion de demo completo en navegador (Playwright), identidad DEMO, rendimiento, móvil |
| `npm run db:test` | Aplica `supabase/migrations` en un Postgres efímero y corre `supabase/tests/rls.sql` |
| `npm run build` | Build de producción con CSP |

## Mapa del código

```
specs/            spec.md (SDD completo), constitution.md (protegido)
design/           direction.md (D-01) y tokens.css (D-02): única fuente de estilos
src/shared/       schemas.ts (Zod, 14 entidades + contratos), money.ts (decimal.js), dates.ts
src/domain/       lógica pura: landedCost, paymentRoutes, reconciliation, discrepancies, extraction, logistics, ask, customsPackage
src/server/       funciones de servidor (1:1 con los endpoints del SDD), bitácora encadenada, permisos de agentes, semillas
src/ui/           React: banda DEMO, hoja de ruta, vistas por sección
src/i18n/         es (por defecto), en, zh
supabase/         migración SQL con RLS por organización y pruebas de RLS
harness/          sensores (scripts/) y control (hooks/)
e2e/              Playwright
```

## Convenciones que no se discuten

- **Dinero**: siempre `decimal.js` vía `src/shared/money.ts`, montos como texto decimal; nunca `number` para importes.
- **Pagos**: `execute` es `false` en el tipo (`z.literal(false)`), en el servidor y en la base (`check`). El verbo de la UI es "Enviar a aprobación".
- **Evidencia**: cada cifra cita documento, tabla o regla. Sin evidencia: "sin dato".
- **DEMO**: todo dato simulado lleva la etiqueta y el lenguaje visual `stamp-sim` / `sim-surface`.
- **Aranceles**: solo desde la tabla versionada (`src/server/seed/tariffs.ts`, `tariff_rules`). Nunca inventes una fracción ni una tasa. La fila semilla está `por_verificar` hasta confirmarla contra el DOF.
- **Bitácora**: `AuditLog.append` es la única operación; `update`/`delete` fallan.
- **Agentes**: escriben solo lo que permite `AGENT_WRITE_PERMISSIONS`; no existe camino de despliegue de políticas.
- **Estilos**: solo tokens de `design/tokens.css` (Tailwind está restringido a ellos). Lee `design/direction.md` antes de tocar UI. Sin degradados, sin sombras, sin cursivas en títulos.
- **Secretos**: ninguno en el cliente. Las claves de IA vivirán solo en funciones de servidor (Supabase Edge Functions).
- Commits: Conventional Commits.

## Harness

| Pieza | Tipo |
| --- | --- |
| `CLAUDE.md`, `specs/`, `design/` | Guía |
| `feature_list.json` | Guía y estado — el agente solo cambia `passes` |
| `claude-progress.md`, `init.sh` | Estado |
| `npm run check`, `npm test`, `npm run db:test` | Sensores computacionales |
| `npm run e2e` | Sensor computacional (navegador) |
| Revisor de spec (subagente) | Sensor inferencial |
| `harness/hooks/guard-protected-files.mjs` (Claude Code PreToolUse) y `.githooks/pre-commit` | Control |
| `.github/workflows/ci.yml` + `.github/CODEOWNERS` | Control (mismos sensores en CI; la constitución y `feature_list.json` requieren revisión del dueño) |

### Sensor inferencial
Lanza un subagente revisor con: "Revisa el diff contra `specs/spec.md` y `specs/constitution.md`. Reporta violaciones de principios, criterios de aceptación no cubiertos y cifras sin evidencia o sin etiqueta DEMO." Corrige CRITICAL y HIGH antes del commit.

## Qué es simulado en este MVP

- Las funciones de servidor corren en el navegador (`KiilonovaServer`) con estado en memoria; la migración de Supabase está lista y probada en Postgres, pero la app aún no está conectada a un proyecto Supabase. En Supabase, las decisiones sobre propuestas pasan por `app.submit_proposal` y `app.decide_proposal`, nunca por UPDATE directo.
- La extracción usa un extractor determinista sobre documentos semilla con capa de texto; no hay servicio de IA ni OCR conectado (PDF o imagen: revisión manual).
- Tipo de cambio, rutas, comisiones, flete y eventos de embarque son DEMO.
