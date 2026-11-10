# Guía para trabajar con Claude Code (web) — equipo Windsor/Anaxágoras

Esta guía la siguen las sesiones de Claude Code en claude.ai/code de **Carlos (Plataforma-cpu)**. Dueño y aprobador: Harold.

## Entorno: "CRMs lectura" (uno solo para los dos CRMs)

El método principal es HTTPS 443: Claude Code web no puede conectar al pooler PostgreSQL por 5432. El rol `lectura_carlos` sigue existiendo, pero no se usa desde este entorno.

- **Red permitida:** `crm.windsor.edu.mx` y `crmanax.vercel.app`.
- **Variables secretas del entorno de Carlos:** `WINDSOR_LECTURA_TOKEN` y `ANAX_LECTURA_TOKEN`, entregadas por formulario seguro. No escribir sus valores en archivos, commits, PRs ni en el chat; no activar `set -x` o `curl -v`.
- **Repositorios:** `ache2agency/windsorcrm` y `ache2agency/crmanax-`.
- No pedir URLs PostgreSQL, `service_role`, `CRON_SECRET`, tokens Meta ni otras credenciales. No llamar directamente a Supabase.
- Cada CRM lee su propia variable privada **`LECTURA_TOKEN`** en el servidor (valores distintos por CRM). Las variables `WINDSOR_LECTURA_TOKEN`/`ANAX_LECTURA_TOKEN` pertenecen al entorno de Carlos; no son los nombres del servidor.
- **Activación pendiente de Harold:** revisar/mergear cada PR, configurar `LECTURA_TOKEN` mediante canal seguro y publicar cada CRM. Esta tarea deja código y guía, sin cambiar variables ni desplegar. Antes de esa publicación las rutas pueden devolver 404; si falta la variable devolverán 503.

## Consultar conversaciones por HTTPS

Solo `GET`, con `Authorization: Bearer <token>`; no hay CORS abierto ni caché. No se admiten tokens en URL o cookies. La API no inserta, actualiza ni marca mensajes como leídos.

Ejemplos (los números son ficticios):

```bash
# Windsor: conversaciones activas en las últimas 24 h.
curl --fail-with-body --get 'https://crm.windsor.edu.mx/api/lectura/conversaciones' \
  -H "Authorization: Bearer ${WINDSOR_LECTURA_TOKEN}" \
  --data-urlencode 'horas=24' --data-urlencode 'limite=200'

# Anaxágoras: historial por WhatsApp. --data-urlencode conserva el signo +.
curl --fail-with-body --get 'https://crmanax.vercel.app/api/lectura/conversacion' \
  -H "Authorization: Bearer ${ANAX_LECTURA_TOKEN}" \
  --data-urlencode 'whatsapp=+525500000052' --data-urlencode 'limite=500'
```

Las dos rutas existen en ambos dominios; cambiar dominio y variable juntos.

- Lista: `horas` entero 1–168 (default 24), `limite` entero 1–500 (default 200 conversaciones), ordenadas por actividad reciente. Incluye hasta **20 mensajes recientes de esa ventana por conversación**, presentados en orden cronológico. `conversaciones_truncadas`/`mensajes_truncados` indican que hay más; reducir la ventana o consultar el número para profundizar. No asumir que una lista truncada cubre todo el periodo.
- Detalle: `whatsapp` internacional obligatorio (8–15 dígitos, con o sin `+`); `limite` entero 1–500 (default 500 mensajes). Devuelve los mensajes más recientes de cualquier fecha en orden cronológico, con `mensajes_truncados`. No es una exportación histórica completa.
- Respuesta lista: `{ zona_horaria, horas, limite, conversaciones, conversaciones_truncadas }`; detalle: `{ zona_horaria, conversacion }`.
- Conversación: `whatsapp`, `fase`, `modo_humano`, `ultimo_mensaje_at`, `lead` (puede ser null), `mensajes`, `mensajes_truncados`. Lead Windsor: `nombre/curso`; Anaxágoras: `nombre/loft_id/stage` (`loft_id` identifica el loft; no se consultan tarifas ni reservas).
- Mensajes: solo `rol`, `contenido`, `created_at`. Fechas ISO con offset local de **America/Mexico_City**; no convertirlas otra vez como si fueran UTC.
- No se seleccionan `raw_payload`, media, pagos, correos, notas ni credenciales. No se firman URLs. Se omiten todos los enlaces del texto y se sustituyen mensajes con patrones bancarios/credenciales reconocibles por `[contenido sensible omitido]`; texto limitado a 4,000 caracteres, nombre/curso a 200. Además se recorta el historial por tamaño (5 KB de mensajes por chat en lista; 2 MB en detalle), con `mensajes_truncados`. El filtrado puede ocultar mensajes comerciales que mencionan depósitos/bancos. No intentar reconstruir lo omitido ni usar esta API como auditoría completa de contenido sensible.
- 401: falta token o es incorrecto. 503: servidor sin `LECTURA_TOKEN`. 400: parámetros inválidos. 404: número sin conversación. 409: número ambiguo en dos formatos; Carlos debe revisarlo en CRM. 500: consulta fallida, sin detalles internos.
- 429: 60 solicitudes por 10 minutos por token, compartidas entre las dos rutas **por instancia de servidor**; respetar `Retry-After`. Es un límite simple en memoria: un reinicio o múltiples instancias tienen contadores independientes. Sin almacén remoto ni SQL adicional.
- Si falla el acceso, detener la revisión y avisar a Carlos; no buscar otras credenciales.

## Qué puedes hacer con esta lectura

Revisar conversaciones, detectar respuestas equivocadas del bot o leads sin atender y preparar reportes. Identificar siempre a los leads por **número de WhatsApp**, no por nombre. No guardar conversaciones reales en código, pruebas ni PRs.

## Contestar a un lead
- Tú **redactas** la respuesta; **Carlos la revisa y la envía desde el chat del CRM** (crm.windsor.edu.mx o el CRM de Anaxágoras). Tú no envías mensajes.
- Si el mensaje lleva **precios, promociones o fechas**, Carlos lo confirma con Harold antes de enviarlo.

## Cambios al código
- Siempre en una rama nueva y con **PR** hacia `main`, con descripción en español (qué y por qué). `main` está protegida: requiere aprobación de Harold.
- En windsorcrm, merge a `main` = publicar en producción; por eso solo Harold aprueba.
- No pruebes nada que mande WhatsApps o correos a leads reales. No incluyas datos de alumnos/clientes en código, PRs ni pruebas.

## Resumen diario sin IA — Tarea 54

Después de que Harold publique el PR correspondiente, usar primero `/api/lectura/resumen`: **mismo Bearer `LECTURA_TOKEN` y misma cuota 60/10 min compartida con lista/detalle**, sin cambiar credenciales. Solo SELECT; no marca visto, no envía ni cambia etapas. Esta ruta nueva se entrega en borrador, no está publicada por esta tarea.

```bash
# Texto compacto para el celular (hasta 20 casos prioritarios, ~30 líneas).
curl --fail-with-body --get 'https://crm.windsor.edu.mx/api/lectura/resumen' \
  -H "Authorization: Bearer ${WINDSOR_LECTURA_TOKEN}" \
  --data-urlencode 'horas=24' --data-urlencode 'formato=texto'

# Todos los motivos/casos analizados en JSON.
curl --fail-with-body --get 'https://crmanax.vercel.app/api/lectura/resumen' \
  -H "Authorization: Bearer ${ANAX_LECTURA_TOKEN}" \
  --data-urlencode 'horas=24'
```

- `horas`: entero 1–168 (24 por defecto); periodo para actividad, preguntas sin atender y automáticos. `formato`: `json` (defecto) o `texto`. Parámetros duplicados/desconocidos → 400. 401/503/429 como en las otras rutas; 504 si la consulta excede el presupuesto de 2.5 s. No repetir inmediatamente si el servidor está lento.
- `totales.ventana_24h`: último mensaje **del usuario** hace menos de 24 h, aunque haya mensajes posteriores del bot/asesor. `por_fase` cuenta solo esa ventana, usando etiquetas del CRM; Anax incluye además `por_etapa` con su pipeline y equivalencias antiguas. `modo_humano` cuenta todas las conversaciones consultadas. Nuevos hoy/ayer se cuentan por alta del lead, incluso sin chat, con cortes de medianoche CDMX.
- Excluye chats `fase=nota` y el canal de asesores Windsor `+527474722466` (también su variante mexicana `+521…`). Los nuevos/eventos de leads cuyo único chat es nota también se excluyen. Un lead con un chat normal y otro de nota conserva su alta/eventos, sin sumar la conversación de nota.
- `requieren_atencion`: número, nombre, programa/loft, fase y lista de `{regla,motivo,accion_sugerida}`. Reglas a–g: sin respuesta >15 min; humano sin agente; intención/etapa de inscripción/reserva sin avance en 24 h; pregunta comercial posiblemente sin dato; diplomado grupal inicia ≤2 días; ventana de lead caliente cierra <3 h; posible automático comercial para sacar de seguimiento. Las acciones son sugerencias para una persona, nunca se ejecutan.
- Las preguntas se comprueban con patrones: importe/moneda para precio, porcentaje/importe o negativa explícita para promoción, calle/avenida/colonia o enlace Maps para dirección, horas/día con cifra para horario. Respuestas posteriores pueden resolver la alerta. Son **indicios**: enlaces de ubicación distintos de Maps, respuestas repartidas, negaciones o contexto no reconocido pueden requerir revisión. Un horario preguntado no se clasifica como automático si contiene signos de pregunta o un inicio interrogativo reconocido. El calendario grupal se lee de `DATOS_DIPLOMADOS`, excluyendo programa marcado como individual.
- “Sin avance” usa intenciones de los últimos 7 días, fase/etapa caliente, fecha del paso de Windsor y actividades de avance registradas. No usa el último envío del bot como evidencia de avance. Sin fecha específica de etapa en Anax se toma el alta como referencia; verificar el historial antes de actuar. Los casos terminales no generan alertas de inscripción/reserva caliente.
- `ayer`: inscritos Windsor/reservas Anax con transición registrada (`stage_changed` → etapa destino); Windsor también usa fecha del paso confirmado Inscrito. Archivados: transición a Archivado (Anax No interesado) o eventos explícitos de archivo. Se deduplican por lead, sin deducir fecha desde su etapa actual. Las reservas de este conteo son cambios a **Reservado**, no cobros, ocupación ni importaciones de Excel.
- `ayer.plantillas_enviadas_detectadas` es un **mínimo**, no el total certificado: marca `[Template: …]`, metadato del motor de seguimiento o inicio Anax aceptado. Hay envíos cuyo historial solo guarda texto renderizado y no se distinguen con certeza. No inventar ese total ni considerar un pendiente como envío confirmado.
- Lectura acotada: máximo 500 conversaciones, 5,000 mensajes de hasta 7 días, 1,000 altas hoy/ayer y 2,000 actividades de hasta 7 días; páginas ≤1,000, cuatro consultas en paralelo, sin consulta por chat. Alcanzar cualquier tope activa `parcial` y `limites_alcanzados`; **todos los conteos pueden ser menores a los reales**. El texto lo muestra como PARCIAL. El JSON conserva todos los casos de la muestra; el texto muestra solo 20 y avisa de los restantes. No es una exportación histórica.
- El endpoint analiza texto en servidor pero no lo devuelve: solo motivos y sugerencias fijas. Reutiliza el filtrado de T52 para nombre/programa/loft y omite enlaces/credenciales reconocibles. La proyección selecciona únicamente tres valores escalares de `raw_payload` para reconocer plantillas y el destino de `meta` para transiciones; nunca selecciona ni devuelve esos objetos completos, parámetros, datos bancarios ni media. No se consulta OpenAI ni otro proveedor de IA.
- Rendimiento validado con fixtures ficticios y fetch simulado; el corte Windsor del 10-nov 9:45 CDMX reproduce 42 (Programa 11, Decidiendo 9, Saludo 8, Info 5, Inscribiéndose 4, Correo 2, Archivado 2, Dudas 1). No se cotejó con producción ni se consultó SQL remoto. Si el resultado es parcial o una regla parece equivocada, profundizar por número con `/api/lectura/conversacion` y revisar el CRM.
