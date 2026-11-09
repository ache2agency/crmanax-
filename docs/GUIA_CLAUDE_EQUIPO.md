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
