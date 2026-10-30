# crmanax — tarea 3, cierre 27-oct-2026

PR sin merge: https://github.com/ache2agency/crmanax-/pull/54
Rama: `codex/fallas-bot-27oct`, desde `origin/main` (`0c4b0ef`, PR #53).
Worktree: `_worktrees/crmanax-fallas-27oct`.
Commit de código: `d441f3a` (el commit posterior agrega este reporte).

Solo se trabajó la sección 3 de CODEX_TAREAS_2026-10-24.md. Se leyeron PROYECTOS.md y crmanax/CLAUDE.md antes.

| Punto | Resultado y prueba con el caso reportado |
|---|---|
| 1. Personas | +525536482880: acepta «1 persona», «Una persona», «una», «dos personas», «somos 2», «1 y 1 mascota» y «Ok 2». No cuenta la mascota. Los mensajes completos llegada 23/10/2026–23/11/2026 con 2 personas y 24/10/2026–31/10/2026 con 1 persona consultan sin repreguntar. Conserva personas si se dieron con la llegada y la salida llega después. |
| 2. Fechas | «Llegada 26 de oct salida 31 de oct», «del 3 al 7 de noviembre» y «a partir del 16 noviembre». Usa el siguiente año cuando esa fecha ya pasó. Ante «llegada 27/10/20206 salida 03/11/2026» pide confirmar 27/10/20206 y no guarda 03/11 como llegada; probado desde nombre, checkin y checkout. |
| 3. FAQ | +525568714777: requisitos con correo, visto bueno, depósito, pago y #blog. +525569365879: proceso de estancia corta con INE y depósito separado de renta. +525546018614: enlaces Chico/Mediano/Grande. +529611132362: precios sin impuestos, factura más IVA. Depósito sin monto inventado. Cada pregunta se prueba desde cinco fases, incluida esperando_asesor, y conserva la fase. |
| 4. Nombres | +525659243709: «Disculpe», perdón, gracias, por mes, costo y el precio no se guardan como nombre. «Fernando Macías costo» guarda Fernando Macías y contesta tarifas desde saludo o nombre. Se conserva «María de la Luz». |
| 5. Fin de semana | +525538863786: viernes/sábado con 1 noche devuelve mínimo 2 noches para salir domingo o lunes, sin consultar disponibilidad; conserva personas y vuelve a pedir salida. Al corregirla continúa. Las alternativas de una noche también omiten viernes/sábado. Jueves 1 noche y viernes/sábado 2 noches siguen permitidos. |
| 6. Orden de fases | +525549475964: fechas válidas recibidas en nombre se guardan y avanza a personas sin «Ese no me parece un nombre». |

Validación terminada:

- `npm test`: **34/34**. Son las 24 pruebas previas y 10 nuevas, con varios casos por prueba.
- `node --test scripts/bot-parsers.test.mjs`: **10/10** adicionales.
- Build completo, TypeScript y prerender: **OK**, con `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder npm run build -- --webpack`.
- `git diff --check`: OK.

Los casos se ejecutan contra el POST real, con Supabase y WhatsApp en memoria, disponibilidad simulada y referencia 20-oct-2026 para reproducir los mensajes originales. No se usó el LAB desincronizado ni credenciales reales. El fixture compartido verifica también `ok: true` para detectar errores del webhook aunque devuelva HTTP 200.

Detalle del build: `npm run build` con Turbopack rechazó el enlace local de node_modules al proyecto original. Se usó Webpack sin cambiar package.json. El prerender requiere valores públicos de Supabase, por lo que se usaron valores ficticios; Google Fonts requirió acceso de red. Esto verifica compilación local, no servicios en producción. Node emite la advertencia ya existente sobre MODULE_TYPELESS_PACKAGE_JSON.

La lectura, sincronización y cálculo de ocupación del Excel no se modificaron (`lib/disponibilidad.ts` y `lib/reservas/` intactos). La regla de dos noches vive antes de la consulta y en la búsqueda de alternativas.

No hubo merge, vercel --prod, SQL contra bases reales ni mensajes reales. No se tocaron windsorcrm ni saas-base. Siguiente paso: revisión del PR #54 por Harold/Claude; merge y deploy quedan fuera de esta tarea.
