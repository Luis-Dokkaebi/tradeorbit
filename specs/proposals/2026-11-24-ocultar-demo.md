# Ocultar la etiqueta DEMO en la vista pública

**Decisión del dueño (2026-11-24).** Luis pidió quitar de la página toda mención visible de "DEMO" para presentarla a inversionistas. Aclaró que nadie ingresará dinero real.

**Qué se hizo.**
- La vista pública ya no muestra la banda DEMO, las notas "DEMO" junto a cifras ni el sufijo "(DEMO)" en nombres y fuentes.
- Los controles del presentador (escenario, reinicio, reproducción, notas, idioma) solo aparecen con `?presentador` en la URL.
- Se conservan, porque describen el comportamiento real del producto y no son etiquetas de demo: "Autorizada (simulada)", "No se movió dinero", `execute: false`, "Por verificar contra el DOF" en la tasa arancelaria y "Ilustrativo, no medido" en la política sandbox.

**Conflicto con el harness.** Esto contradice el principio 4 de `specs/constitution.md` ("Todo dato de demo lleva la etiqueta DEMO") y el criterio US-12.c de `feature_list.json`. Ambos archivos están protegidos y solo los cambia una persona, así que el agente no los modificó:
- US-12.c quedó en `passes: false`.
- Para ratificar la decisión, el dueño debe enmendar el principio 4 y el criterio US-12.c (`ALLOW_CONSTITUTION_EDIT=1`, `ALLOW_FEATURE_LIST_EDIT=1`), por ejemplo: "Lo simulado se declara verbalmente al presentar; la vista pública puede omitir la etiqueta".

**Riesgo que se mantiene.** Las cifras (tipo de cambio, comisiones, rutas, flete, tasa arancelaria) siguen siendo ilustrativas y los datos son sintéticos. Al presentar, decirlo de viva voz, como prevé la sección "Preguntas probables" del SDD.
