# Iniciar WhatsApp — Tarea 27

En la ficha del prospecto sin chat aparece **Iniciar WhatsApp**. Se confirma el envío de una plantilla; el alta manual ya no manda mensajes automáticamente. Si hay conversación (por lead o teléfono equivalente), aparece **Ver conversación**. Un WhatsApp vacío deshabilita el botón. El número se valida nuevamente en el servidor.

`POST /api/whatsapp/iniciar` recibe exclusivamente `{ "lead_id": "uuid" }`. Exige sesión Supabase, consulta el lead con RLS y confirma su asignación/admin dentro de la transacción. No acepta teléfono, usuario o texto arbitrarios. `/api/whatsapp/bienvenida` es un alias protegido para clientes anteriores; ya no usa `seguimiento_general` ni permite acceso anónimo. No se modifica `/reactivar-manual`.

La conversación nueva queda abierta, ligada al lead, en modo humano, con `humano_intervino=true`, `tomado_por` igual al usuario autenticado y fase `esperando_asesor`. La respuesta del prospecto se registra por el webhook habitual, sin crear otro lead. El asesor puede usar **Volver a BOT** con el comportamiento existente. No se altera el pipeline ni se promete entrega: el éxito indica aceptación por Meta.

## Persistencia y fallos

**Antes del código**, Claude debe revisar y aplicar `supabase/migration_v14_iniciar_whatsapp.sql` con autorización de Harold. En esta entrega no se aplica SQL remoto. Requiere el esquema productivo existente, incluido `humano_intervino` (v6) y `provider`. Sin v14, el endpoint devuelve 503 y no llama a Meta.

La migración agrega `whatsapp_inicios` (RLS, sin acceso de anon/authenticated) y dos RPC exclusivos de service_role. La reserva toma un advisory lock transaccional por teléfono canónico, verifica de nuevo el lead y su acceso, crea/reutiliza el chat y guarda un mensaje **sin confirmar** antes de contactar a Meta. Ningún error de SQL permite el envío. La confirmación cambia atómicamente el mensaje al texto de la plantilla con el identificador Meta y marca el intento como aceptado.

- Doble clic: bloqueo local inmediato y reserva persistente compartida entre instancias; intentos del mismo número <24 h devuelven 409, aunque se usen leads duplicados o formatos +521/+52/locales.
- Chat previo sin mensajes: se reutiliza para el envío y pasa a humano. Chat con historial: se reutiliza sin mandar otra plantilla ni modificar fase/control humano. Chat de otro lead: conflicto; no se cambia su dueño.
- Error o timeout de Meta, caída del proceso, o aceptación sin confirmación de historial: queda el registro pendiente y se avisa. No hay reintento automático. No se afirma que Meta lo rechazó si pudo aceptarlo.
- Pasadas 24 h, si ya hay historial, este botón sigue reutilizando el chat sin envío. Cualquier reactivación requiere revisión del asesor y su acción habitual; no desbloquear un intento a ciegas.
- La reserva serializa este endpoint y el alias. No impone un índice único global ni cambia el webhook/otras rutas históricas; un primer mensaje entrante exactamente simultáneo con la creación está sujeto a la carrera preexistente del webhook.

En una incidencia, comprobar `raw_payload.status` y `meta_message_id`, el estado real en Meta y el chat antes de decidir una reactivación. Un registro pendiente no equivale a entrega ni a rechazo. No borrar los intentos para reintentar.

Para revertir el código, conservar la tabla y sus intentos; no hace falta borrar objetos SQL ni historial. Restaurar el código anterior también restaura su antigua bienvenida automática y su endpoint sin sesión: revisar ese efecto antes de cualquier reversa. No hay rollback destructivo automático.

## Plantilla actual y propuesta (no creada)

Se usa `seguimiento_solicitud_anax`, español México (`es_MX`), un parámetro `nombre`. Texto documentado en el endpoint de reactivación del repositorio, compartido en `lib/whatsapp/iniciar.js`:

> Hola {{1}}, seguimos con tu solicitud de información sobre disponibilidad en Anaxágoras 41 para las fechas que nos compartiste. ¿Sigue vigente tu interés para que un asesor te confirme los detalles?

**No es un primer contacto universal:** supone que ya se compartieron fechas. Se conserva por la instrucción de usarla por ahora; la interfaz lo advierte antes de enviar. No se consultó ni modificó Meta para verificar su estado actual. Harold debe validar su vigencia antes de usarla en producción.

Propuesta para aprobación de Harold, nombre sugerido `primer_contacto_anax` (no creada, sin categoría ni aprobación prometida):

> Hola {{1}}, recibimos tus datos porque solicitaste información sobre hospedaje en Anaxágoras 41. ¿Buscas una estancia por noche o por mes? Responde a este mensaje y un asesor te ayudará con los detalles.

Solo usarla con personas que efectivamente solicitaron información. Cambiar a esta plantilla requiere su aprobación en Meta y un cambio posterior de nombre/texto en código.

## Validación reproducible

```
npm test
npx tsc --noEmit
NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=qa-ficticia npm run build -- --webpack
```

Las pruebas ejecutan el endpoint real con Supabase/Meta simulados y renderizan la ficha real, incluidos estados oculto/deshabilitado. El webhook real se prueba en memoria al responder en modo humano y al volver al bot.

Validación adicional del SQL con PostgreSQL WASM local (PGlite de una instalación de QA, sin agregar dependencia de producción):

```
PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/iniciar-whatsapp-sql.mjs
```

Comprueba migración reejecutable, permisos, reserva/repetición, ventana de 24 h, duplicados, conversación vacía/historial, cambio de teléfono/asignación y confirmación. PGlite serializa sus consultas en una sola conexión; esto comprueba la transición real en SQL, no sustituye una prueba de contención con varias conexiones PostgreSQL de producción.

`vercel.json` deshabilita deploy Git solo para `codex/crmanax-iniciar-whatsapp`. No se crea preview ni se cambia Production.
