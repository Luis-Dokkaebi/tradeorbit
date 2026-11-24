# Kiilonova Trade — Expediente inteligente de importación (MVP)

Aplicación web donde una pyme mexicana abre una importación desde China y el sistema organiza documentos, costo puesto en bodega, propuesta de pago, seguimiento y conciliación. **Los agentes proponen, una persona autoriza, no se mueve dinero.**

```bash
./init.sh        # instala, activa hooks y corre los sensores
npm run dev      # http://localhost:5173
npm run e2e      # guion de demo de 8 minutos en navegador
npm run db:test  # migración Supabase + pruebas de RLS en Postgres efímero
```

- Especificación: [`specs/spec.md`](specs/spec.md) · Constitución: [`specs/constitution.md`](specs/constitution.md)
- Guía para agentes: [`CLAUDE.md`](CLAUDE.md) · Estado: [`feature_list.json`](feature_list.json), [`claude-progress.md`](claude-progress.md)
- Diseño: [`design/direction.md`](design/direction.md), [`design/tokens.css`](design/tokens.css)

Modo demo: datos sintéticos, tipo de cambio y rutas ilustrativas, etiqueta DEMO en todas las pantallas.
