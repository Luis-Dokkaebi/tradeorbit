# Constitución — Kiilonova Trade MVP

Estos ocho artículos son la constitución del proyecto. El agente de código los lee antes de cada tarea y ninguna tarea puede violarlos. Este archivo está protegido: solo una persona lo modifica (hook `harness/hooks/guard-protected-files.mjs`).

1. **Solo proponer, nunca ejecutar.** Ninguna función mueve dinero, firma o presenta algo ante una autoridad. Los pagos terminan en estado "propuesta" y el campo `execute` vale siempre `false`.
2. **Una persona autoriza.** Todo cambio con efecto externo exige una aprobación humana registrada: quién, cuándo y sobre qué versión.
3. **Nada sin evidencia.** Cada cifra y cada respuesta del asistente cita el documento o la tabla de origen. Si no hay evidencia, la respuesta es "sin dato".
4. **Lo simulado se ve simulado.** Todo dato de demo (tipo de cambio, cotización, ruta, evento de embarque) lleva la etiqueta DEMO. Ninguna cifra ilustrativa se presenta como medida.
5. **Sin secretos en el cliente.** Las claves de API viven solo en funciones de servidor. La app no almacena llaves privadas de wallets.
6. **Aranceles y normas versionados.** Cada tasa y cada NOM tiene fuente, fecha y vigencia. El agente nunca inventa una fracción o una tasa; si no la encuentra, escala a una persona.
7. **Bitácora solo de agregar.** Cada acción de un agente o de una persona se registra y no se edita.
8. **Terminado significa verificado.** Ninguna tarea se marca hecha sin que su prueba pase. Los cálculos de costo, FX y conciliación tienen pruebas con casos del spec.

## Condiciones de parada

- Si un cambio viola esta constitución, el agente se detiene y pregunta.
- Si el spec es ambiguo, el agente propone el cambio al spec (en `specs/proposals/`) y espera aprobación en lugar de decidir.
- Si una tarea falla dos veces seguidas con la misma causa, el agente documenta el bloqueo en `claude-progress.md` y pasa a otra.
