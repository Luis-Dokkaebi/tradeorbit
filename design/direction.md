# Kiilonova Trade — Dirección visual (D-01)

> Hallmark · genre: modern-minimal (registro utilitario) · theme route: custom (tuned) · macrostructure: Workbench
> Estado: **propuesta, pendiente de aprobación humana** (D-01 se marca hecha solo cuando una persona la aprueba).

## Contexto inferido

- **Audiencia.** Dueño de una pyme mexicana que importa desde China; segundo público: quien decide si la idea vale la pena (jefe, distribuidores, fondos) y debe ver el valor en 8 minutos.
- **Uso.** Operar un expediente de importación y **autorizar** propuestas. La acción principal de la app no es "pagar"; es "revisar evidencia y decidir".
- **Tono.** Utilitario y documental. Un expediente aduanal bien llevado, no un panel de SaaS.

## Idea rectora: el expediente físico

La app se lee como la carpeta de una operación de comercio exterior: un folder con su hoja de ruta, documentos foliados, sellos y copias al carbón. Tres referencias visuales, todas de objetos de oficio y no de productos digitales:

1. **El pedimento y la hoja de ruta impresos.** Retícula de campos con etiqueta pequeña en mayúsculas encima del valor, folios, claves a la izquierda. De aquí salen las etiquetas monoespaciadas y los campos "etiqueta arriba / dato abajo".
2. **El conocimiento de embarque (bill of lading).** Bloques separados por filetes de 1 px, numeración por casilla, cifras alineadas a la derecha. De aquí salen los filetes en lugar de tarjetas con sombra.
3. **El sello y la copia al carbón.** Un sello bermellón significa "aquí decide una persona". La copia al carbón azul significa "esto es una copia, no el original": es el lenguaje visual de lo simulado.

## Decisiones distintivas

1. **Color con significado, no con decoración.**
   - `--color-decision` (bermellón de sello) se reserva **solo** para lo que exige una decisión humana: aprobar o rechazar, discrepancias abiertas, campos de baja confianza que requieren revisión. Ningún botón de navegación ni título lo usa.
   - `--color-sim` (azul carbón) es exclusivo de lo simulado: etiqueta DEMO, estado "propuesta", "autorizada (simulada)", datos DEMO y modo reproducción.
   - Verde (`--color-ok`) y ocre (`--color-wait`) solo para estado: conciliado / pendiente o retraso.
   - Sin degradados. El rayado de lo simulado es un patrón SVG, no un degradado.
2. **Lenguaje propio de lo simulado (principios 1 y 4).** Todo lo simulado lleva tres señales a la vez: borde discontinuo, rayado diagonal tenue de copia al carbón y una etiqueta monoespaciada en azul carbón. "Propuesta" = borde discontinuo; "autorizada (simulada)" = sello rectangular azul carbón con rayado; nunca el verde de un estado real.
3. **La pantalla central es el expediente.** Encabezado tipo carátula (folio, proveedor, mercancía, fracción, estado) y debajo una **hoja de ruta** de ocho etapas con su sello de estado. No hay rejilla de tarjetas iguales.
4. **Cifras en monoespaciada, alineadas a la derecha**, con la moneda como sufijo pequeño. Cada cifra lleva su cita de origen (documento, página, recuadro o tabla).
5. **Filetes, no sombras.** Superficies definidas por filetes de 1 px; radio de 3 px (papel cortado, no píldora).

## Tipografía (2 familias)

- **Archivo** (variable, ejes `wght` y `wdth`): títulos en ancho expandido (`font-stretch: 118%`, peso 640) como rótulo de caja de embarque; texto en ancho normal, peso 420.
- **IBM Plex Mono**: folios, fracciones arancelarias, montos, etiquetas de campo en mayúsculas (`letter-spacing: 0.06em`) y etiquetas DEMO.
- Fuentes autoalojadas con `@fontsource` para que la demo funcione sin red (NFR-04, plan B).

## Paleta (OKLCH, en `design/tokens.css`)

| Token | Uso |
| --- | --- |
| `--color-paper` | Fondo manila muy claro, nunca `#fff` |
| `--color-paper-2` | Superficie de documento |
| `--color-ink` | Tinta azul-carbón oscura, nunca `#000` |
| `--color-ink-2` | Texto secundario |
| `--color-rule` | Filetes de 1 px |
| `--color-decision` | Bermellón de sello: solo decisiones humanas |
| `--color-sim` | Azul carbón: solo lo simulado / DEMO |
| `--color-ok` / `--color-wait` | Estado conciliado / pendiente o retraso |

## Movimiento

Mínimo. Sin rebotes ni parallax. El único gesto es el "sellado": al registrar una decisión, el sello aparece con una escala de 1.04 a 1 en 160 ms. Todo se desactiva con `prefers-reduced-motion`.

## Prueba de identidad

Sin logo, una pantalla debe reconocerse por: la banda DEMO azul carbón rayada, la hoja de ruta con sellos, las etiquetas monoespaciadas sobre cada dato y el bermellón que solo aparece donde alguien tiene que decidir.

## Prohibido

- Tarjetas con sombra en rejilla de 3, degradados, glassmorphism, emojis como iconos.
- Botón "Pagar". El verbo es "Enviar a aprobación".
- Cifras ilustrativas sin etiqueta DEMO; métricas inventadas de ahorro.
- Títulos en cursiva.
- Cualquier color o fuente fuera de `design/tokens.css` (lo verifica `harness/scripts/check-tokens.mjs`).
