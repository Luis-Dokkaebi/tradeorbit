# Tasa arancelaria de la mercancía semilla

**Contexto.** El SDD pide verificar contra el DOF la tasa de la fracción de la mercancía semilla (200 camisas) antes de la demo y prohíbe inventar tasas (principio 6).

**Ambigüedad.** El agente no tiene acceso verificado al DOF vigente. El decreto del 19/12/2024 elevó al 35 % los aranceles de confección para países sin tratado; en 2026 hubo cambios adicionales cuya vigencia para esta fracción no se confirmó.

**Propuesta.** Mantener la fila `6205.20.01` con tasa 0.35 y estado `por_verificar` (la UI lo muestra en ocre: "Por verificar contra el DOF"). Una persona confirma fracción, NICO, tasa y vigencia; al confirmarla se agrega una nueva versión de la fila con `verification: 'verificada'` y su fecha.

**Alternativa.** Cambiar la mercancía semilla por una con tasa confirmada.
