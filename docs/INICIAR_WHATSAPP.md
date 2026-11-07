# Iniciar WhatsApp — Tarea 27

En la ficha del prospecto sin chat aparece **Iniciar WhatsApp**. El alta manual no manda mensajes automáticamente. Con conversación existente, por lead o teléfono equivalente, aparece **Ver conversación**. Un WhatsApp vacío o un envío en curso deshabilitan el botón; el servidor vuelve a validar el número.

`POST /api/whatsapp/iniciar` recibe exclusivamente `{ "lead_id": "uuid" }`. Exige sesión Supabase, consulta el lead con RLS y confirma asignación/admin dentro de la reserva transaccional. No acepta teléfono, usuario o texto arbitrarios. `/api/whatsapp/bienvenida` es un alias protegido para clientes anteriores. No se modifica `/reactivar-manual` ni el pipeline.

## Plantilla configurable y respaldo

`META_TEMPLATE_PRIMER_CONTACTO` configura el nombre; sin valor o con valor vacío usa **`primer_contacto_anax`**. La configuración está documentada en `.env.example`; no se cambia ningún secreto real.

Solo cuando Meta rechaza explícitamente la principal con **132001** (plantilla no disponible en el idioma solicitado), se intenta **`seguimiento_solicitud_anax`** como respaldo. El rechazo debe conservar su código estructurado; no se decide por texto del error. Si ya se configuró el respaldo como principal, no se repite. Un timeout, error de credenciales, 5xx u otro error no dispara respaldo. Se conserva el bloqueo del intento, porque un fallo de red puede ocurrir después de que Meta acepte.

Ambas usan `es_MX` y un parámetro de cuerpo (`nombre`). El historial confirmado guarda el **nombre efectivo de la plantilla** y el identificador Meta. Una plantilla personalizada debe conservar el cuerpo y los botones de la principal; no se consulta su cuerpo automáticamente.

Definición propuesta para **`primer_contacto_anax`**, pendiente de aprobación/publicación por Harold, **no creada en Meta en esta tarea**:

> Hola {{1}}, recibimos tus datos porque solicitaste información sobre hospedaje en Anaxágoras 41. ¿Buscas una estancia por noche o por mes? Responde a este mensaje y un asesor te ayudará con los detalles.

Dos botones **QUICK_REPLY**, en este orden:

1. **Sí, me interesa**
2. **Ahora no**

Son botones estáticos de la plantilla, no botones nuevos enviados como mensaje separado. Deben existir en su definición aprobada en Meta. El remitente usa `sendMetaWhatsAppTemplate`; no crea ni modifica plantillas.

Texto documentado del respaldo:

> Hola {{1}}, seguimos con tu solicitud de información sobre disponibilidad en Anaxágoras 41 para las fechas que nos compartiste. ¿Sigue vigente tu interés para que un asesor te confirme los detalles?

Este respaldo presupone fechas compartidas; la confirmación del CRM lo advierte. No se consultó Meta para verificar la vigencia de ninguna plantilla. Sus botones históricos **Sí, envíame la info** y **Ya no, gracias** también se interpretan como consentimiento/negativa cuando corresponden a este primer contacto. Las reactivaciones ajenas conservan su manejo anterior.

## Respuesta y control humano

La conversación inicial queda abierta, ligada al lead, en modo humano, con `humano_intervino=true`, responsable igual al usuario autenticado y fase `esperando_asesor`. Espera la respuesta del prospecto; aceptar una plantilla no equivale a entrega.

El webhook procesa los títulos exactos de respuesta mediante `button`, `interactive.button_reply` o texto escrito antes del manejo de reactivación y del filtro de modo humano:

- **Sí, me interesa**: libera la espera inicial (`modo_humano=false`, `tomado_por=null`), conserva `humano_intervino` como historia y entra al flujo normal. Si hay nombre, comparte el catálogo habitual y deja `confirmar_precios`; si falta, pide el nombre. Las siguientes respuestas usan el bot existente. Si el lead estaba en `no_interesado`, vuelve a `nuevo_contacto`.
- **Ahora no**: guarda la respuesta, pasa el lead a `no_interesado`, cierra la conversación y fija la fase `no_interesado`; evita seguimientos automáticos. No manda otro WhatsApp.
- Respuesta repetida: el RPC consume el consentimiento una sola vez, sin duplicar mensajes de usuario ni saludo del bot.

El RPC acredita el intento de ese teléfono y su conversación. Si el mensaje incluye `context.id`, debe coincidir con el identificador Meta de la plantilla. Sin contexto, solo acepta el título exacto dentro de 24 h del inicio. No interpreta un «sí» genérico como permiso para soltar modo humano.

Si un asesor escribió después de la plantilla, cambió la fase o el lead avanzó a depósito pendiente/reservado/hospedado/completado, se registra la respuesta y se avisa por push, conservando el control y la reserva. Un botón ajeno sin intento coincidente no habilita el bot. No se crea un lead al responder.

## Persistencia y operación

**Antes del código**, Claude debe revisar y aplicar la versión final de `supabase/migration_v14_iniciar_whatsapp.sql` con autorización. Solo está en archivo; requiere el esquema existente con `humano_intervino` y `provider`. Sin v14 el inicio devuelve 503 antes de enviar. Esta versión incorpora `resolver_respuesta_inicio_whatsapp` y el parámetro `p_template` de `confirmar_inicio_whatsapp`; no aplicar una copia anterior del PR.

La migración agrega `whatsapp_inicios` (RLS, sin acceso anon/authenticated) y RPC exclusivos de service_role. La reserva toma un advisory lock por teléfono canónico, verifica el acceso y crea/reutiliza el chat. Guarda un mensaje **sin confirmar** antes de contactar a Meta. La confirmación actualiza atómicamente historial e intento. El RPC de respuesta usa el mismo lock y registra estado/consentimiento en una transacción.

- Doble clic o solicitudes en varias instancias: un intento persistente por teléfono, incluso para formatos +521/+52/local y leads duplicados. Intentos <24 h devuelven 409.
- Chat previo vacío: se reutiliza y queda en espera inicial. Chat con historial: devuelve existente sin otra plantilla ni alterar fase/control. Chat de otro lead: conflicto, sin cambiar dueño.
- Error/timeout de Meta, proceso interrumpido o historial no confirmado: conserva el registro pendiente y avisa; sin reintento automático. Revisar historial y Meta antes de cualquier reactivación. No borrar intentos para forzar un reenvío.
- Pasadas 24 h, si ya hay historial, Iniciar sigue reutilizando sin reenviar. Las reactivaciones habituales quedan fuera del bloqueo de este endpoint.
- El consentimiento se consume antes del saludo del bot para evitar saludos duplicados ante reentregas. Si ese envío o su registro falla, no se repite automáticamente: requiere revisión del asesor.
- El bloqueo protege inicio/alias/respuesta; no impone unicidad global a conversaciones históricas ni cambia la creación habitual del webhook. Un primer entrante exactamente simultáneo con la creación sigue sujeto a su carrera preexistente.

La reversa del código puede conservar tabla e historial; no requiere borrados SQL. Restaurar código anterior también restaura la bienvenida automática y su ruta sin sesión: revisar antes de hacerlo. No hay rollback destructivo automático.

## Validación reproducible

```
npm test
npx tsc --noEmit
NEXT_PUBLIC_SUPABASE_URL=https://example.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=qa-ficticia npm run build -- --webpack
PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/iniciar-whatsapp-sql.mjs
```

Pruebas del endpoint con Meta/Supabase simulados, proveedor real con fetch simulado, ficha real renderizada y webhook real en memoria. SQL validado con PostgreSQL WASM local; PGlite serializa en una conexión y no sustituye contención multiconexión. No hay aceptación con Meta ni recorrido visual de navegador.

`vercel.json` deshabilita deploy Git solo para `codex/crmanax-iniciar-whatsapp`. Sin merge/deploy/SQL remoto, envíos reales ni cambios de secretos.
