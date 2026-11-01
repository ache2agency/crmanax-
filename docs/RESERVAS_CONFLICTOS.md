# Conflictos y frescura de disponibilidad (8-bis)

El sync de Excel e iCal termina con un monitor que compara los dos orígenes por loft entre hoy (Ciudad de México) y +12 meses. La salida es exclusiva. No modifica ni Excel ni Airbnb.

- **Rojo: doble_reserva_riesgo.** Excel ocupado, Airbnb libre. Acción: **Bloquear en Airbnb**, tanto para reservas directas como las etiquetadas Airbnb.
- **Rojo: traslape_excel.** Dos o más reservas del Excel ocupan las mismas noches. Acción: **Revisar Excel: dos reservas encimadas**. Salir el día en que llega otro huésped no es traslape.
- **Amarillo: solo_airbnb.** Preparación o reserva no registrada en Excel. Informativo y plegado en el panel; no envía push.

El detector agrupa noches consecutivas en rangos. Solo compara lofts cuyo feed se descargó y guardó en este sync; un feed caído no se interpreta como libre. Si Excel falla, no se recalculan ni resuelven conflictos: se conservan los anteriores y se actualiza el estado de frescura. El calendario y el bot siguen usando la unión de ocupaciones conservadas.

## Panel y bot

La franja muestra conflictos rojos primero, loft, entrada/salida y acción; las celdas afectadas tienen borde rojo. Los amarillos quedan en una sección plegada. El panel muestra el último **éxito** de Excel y el éxito más antiguo de los feeds activos, con minutos transcurridos, recuento de feeds OK y nombres de los fallidos. Refresca la lectura cada minuto sin lanzar sincronizaciones. Un intento fallido no rejuvenece el último éxito. >2 h, o no tener éxito conocido, muestra alerta roja.

Con fuentes viejas o estado de frescura inaccesible, el bot conserva loft/precio/depósito y no afirma que haya disponibilidad: termina con **«Un asesor te confirma disponibilidad antes de apartar»**. Las alternativas tampoco se afirman como libres con datos viejos.

Se excluye la cola automática de Airbnb que empieza después de hoy +8 meses y termina en el horizonte de 12 meses o más allá. Se admite un margen de 7 días al final para que una cola de un snapshot anterior no vuelva a aparecer al cambiar de día. Es una regla heurística acordada en la tarea: puede excluir un bloqueo real que tenga esa forma. No excluye reservas cortas que terminan antes de esa zona. Se aplica al parsear y al leer snapshots anteriores. Los fixtures usan URLs ficticias `www.airbnb.mx/calendar/ical/…?t=…`.

## Persistencia y push

`migration_v13_reservas_conflictos.sql` crea:

- `reservas_conflictos`: tipo, loft, fechas, acción genérica, primera/última vez y resolución. Sin nombres ni teléfonos. Si un rango activo se recorta o amplía manteniendo intersección, conserva su identidad. Una reaparición exacta recupera el mismo registro.
- `reservas_fuentes`: último éxito e intento de Excel y de cada feed iCal. El arranque aprovecha el último éxito global de v12 como base inicial; a partir del primer sync 8-bis el estado es individual por loft.
- `reservas_avisos_push`: claves únicas para un intento por conflicto rojo, y por episodio de fuente vieja (Excel o feed). El reclamo es atómico, incluso ante ejecuciones concurrentes; no repite push en cada sync. Una fuente recuperada puede emitir otro aviso si vuelve a pasar >2 h. Los amarillos no generan push.

Se reutiliza `enviarPushATodos` (`lib/push.ts`): envía a todas las suscripciones registradas, sin WhatsApp. Sin VAPID se conservan pendientes. Después de reclamar se realiza **como máximo un intento** por dispositivo con la infraestructura existente; un cierre del proceso o una falla del proveedor después del reclamo puede perder el aviso. El conflicto permanece visible en el panel. No se promete entrega al dispositivo.

Inventario consultado en SOLO LECTURA el **1-nov-2026, 18:06 UTC**: **3 suscripciones**: `arrirra@gmail.com` tiene 2; `anaxagoras41suite@gmail.com` (Alexis) tiene 1. La tabla no guarda modelo ni nombre físico del teléfono; las cifras son suscripciones, no confirmación de entrega. No se extrajeron endpoints ni claves. No se envió push de prueba.

**Alexis:** en iPhone abrir `crmanax.vercel.app` en Safari → Compartir → Agregar a pantalla de inicio → abrir desde el ícono → iniciar sesión con su usuario → **Activar notificaciones** → Permitir. En Android/Chrome abrir el CRM, instalarlo si se ofrece y pulsar el mismo botón. Si aparece bloqueado, habilitar notificaciones en Ajustes y volver a registrarlo desde el CRM. Cada teléfono/navegador se registra por separado. La push enlaza a Disponibilidad al abrir una ventana nueva; si la app ya está abierta, el service worker existente puede limitarse a enfocarla.

## Activación por Harold/Claude

1. Revisar el PR y aplicar **v13 antes del código** (v12 ya está en producción). Los archivos SQL no fueron ejecutados en producción por Codex. Migración, permisos/RLS, dedupe, resolución, frescura y reversa validados en PostgreSQL temporal PGlite.
2. Merge/deploy solo con instrucción de Harold. No se necesita nueva variable; conservar VAPID, AIRBNB_ICAL_URLS, DROPBOX_RESERVAS_URL y CRON_SECRET.
3. Ejecutar `/api/reservas/sync` o Actualizar ahora y revisar el monitor. Si falla una fuente/monitor, responde HTTP 207 con `ok:false` y el panel conserva el error.
4. Mantener el sync horario existente. Para avisar incluso si el sync deja de ejecutarse, programar por separado **GET `/api/reservas/monitor`**, con `Authorization: Bearer <CRON_SECRET>` (p. ej. cada 15 min en el programador externo). No descarga calendarios ni cambia reservas: evalúa frescura e intenta push pendientes. Esta tarea entrega el endpoint, sin activar ningún cron. El mero paso del tiempo no ejecuta código: sin el monitor independiente no habrá push hasta la siguiente ejecución de sync/monitor, aunque el panel y el bot sí detectan la antigüedad al leer.
5. Alexis revisa PB-01 en diciembre y el traslape PB-03, corrige en la fuente y vuelve a sincronizar: se registra resolución, sin borrar historial.

Reversa: volver primero al código anterior y ejecutar `migration_v13_reservas_conflictos_reversa.sql`. Renombra las tres tablas como respaldo conservando RLS/datos, retira las RPC nuevas y conserva `feeds_ok` en la bitácora.

## Validación local

`npm test` incluye fixtures y render del panel. SQL aislado, sin servicios reales:

```
PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/verificar-reservas-conflictos-sql.mjs
```

PGlite se instala fuera del repo; no es una dependencia de producción. No se le pasan secretos. El script crea todo en memoria y cierra las bases al terminar.
