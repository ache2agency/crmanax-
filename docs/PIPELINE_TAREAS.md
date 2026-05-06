# Pipeline Windsor — Tareas para Agentes

Este documento define todo el trabajo necesario para implementar el pipeline de prospectos de Instituto Windsor. Está organizado en 4 grupos con dependencias claras para que múltiples agentes trabajen en paralelo.

---

## Contexto general

### El sistema tiene dos tracks de prospecto:

**TRACK A — Idiomas (inglés adultos / inglés niños)**
```
contactado → examen_ubicacion → clase_muestra → seguimiento → promo_enviada → inscripcion_pendiente → inscrito
```

**TRACK B — Licenciaturas / Bachillerato / Maestrías / Diplomados**
```
contactado → seguimiento → promo_enviada → inscripcion_pendiente → inscrito
```

Desde cualquier etapa: `perdido` (dijo que no) o `archivado` (no respondió después de 2 intentos de reactivación).

### Rol del bot vs asesor humano:
- **Bot**: maneja todo el proceso desde el primer contacto hasta que el lead confirma pago y documentos
- **Asesor entra SOLO en dos casos**:
  1. El lead pide hablar con un humano
  2. El lead confirmó pago y documentos → asesor confirma la inscripción

### Reactivación automática:
- Cada etapa tiene un tiempo máximo sin respuesta antes de mandar un mensaje de reactivación
- Se hacen **2 intentos** por etapa antes de archivar
- Los mensajes de reactivación son diferentes en cada intento y según la etapa

### Tiempos de reactivación por etapa:
| Etapa | Días sin respuesta | Enfoque intento 1 | Enfoque intento 2 |
|---|---|---|---|
| `contactado` | 2 días | ¿Revisaste la info? ¿Dudas? | Más directo + promo |
| `examen_ubicacion` | 2 días | ¿Agendamos tu examen? | Urgencia |
| `clase_muestra` | 2 días | ¿Agendamos tu clase de prueba? | Urgencia |
| `seguimiento` | 3 días | ¿Cómo vas con tu decisión? | Oferta de ayuda concreta |
| `promo_enviada` | 2 días | La promo tiene fecha límite | Último aviso |
| `inscripcion_pendiente` | 1 día | ¿Ayuda con documentos o pago? | Urgencia |

---

## GRUPO 1 — BASE de conocimiento
> **Puede arrancar de inmediato. No depende de otros grupos.**
> El agente de este grupo solo actualiza documentos en Supabase via el endpoint `/api/rag/upload`.

### 1a — RVOEs faltantes
Agregar el RVOE a los siguientes documentos en la BASE. Los documentos ya existen, solo hay que actualizarlos con el campo RVOE correspondiente:
- Licenciatura en Psicología (presencial)
- Licenciatura en Inglés (presencial)
- Licenciatura en Administración Turística (presencial)

**Pendiente**: el usuario debe proveer los números de RVOE de estos tres programas.

### 1b — Examen de ubicación
Agregar a la BASE un documento con:
- Instrucciones paso a paso para realizar el examen de ubicación de inglés
- El PDF del examen (cuando el usuario lo proporcione)

**Pendiente**: el usuario debe proveer el PDF y las instrucciones del examen.

### 1c — Clase de prueba: cómo llegar y qué llevar
Agregar a la BASE un documento con:
- Dirección de las instalaciones (Chilpancingo e Iguala)
- Indicaciones de cómo llegar
- Qué debe llevar el prospecto a la clase de prueba

**Pendiente**: el usuario debe proveer esta información.

### 1d — Fechas de inicio por programa
Agregar las fechas de inicio de cada programa a sus respectivos documentos en la BASE:
- Licenciaturas (todas)
- Bachillerato
- Maestrías
- Cursos de idiomas

**Pendiente**: el usuario debe proveer las fechas de inicio.

---

## GRUPO 2 — Estructura de mensajes del bot
> ✅ COMPLETADO — Mensajes hardcodeados en `app/api/whatsapp/lab/route.ts` y `app/api/whatsapp/webhook/route.ts`
> Los textos de reactivación y recordatorios están documentados abajo para uso del Grupo 4.

### 2a — Mensajes Track A (idiomas)
Redactar y codificar los mensajes del bot para cada paso del flujo de idiomas:

1. **Info del programa** → qué contiene: nombre, modalidad, horarios, costos, promo vigente + CTA: A) Tengo dudas B) Agendar examen de ubicación
2. **Instrucciones examen de ubicación** → texto + link/PDF del examen
3. **Invitación clase de prueba** (después de confirmar examen) → CTA: A) Tengo dudas B) Agendar clase de prueba (link agenda interna)
4. **Seguimiento post clase de prueba** → ¿cómo te fue? + CTA: A) Tengo dudas B) Quiero inscribirme
5. **Proceso de inscripción** → documentos necesarios + datos bancarios + formulario + CTA: A) Inscribirme online B) Ir a las instalaciones
6. **Confirmación de inscripción online** → instrucciones para subir documentos y confirmar pago

### 2b — Mensajes Track B (licenciaturas / bachillerato / diplomados / maestrías)
Redactar y codificar los mensajes del bot para cada paso del flujo de licenciaturas:

1. **Info del programa** → qué contiene: nombre, modalidad, duración, horarios, costos, campo laboral, link plan de estudios, promo vigente + CTA: A) Tengo dudas B) Quiero inscribirme
2. **Seguimiento** → ¿pudiste revisar la información? ¿tienes alguna duda?
3. **Proceso de inscripción** → documentos necesarios + datos bancarios + formulario + CTA: A) Inscribirme online B) Ir a las instalaciones
4. **Confirmación de inscripción online** → instrucciones para subir documentos y confirmar pago

### 2c — Mensajes de reactivación (ambos tracks)
> ✅ COMPLETADO — Textos aprobados por el usuario

**TRACK A — Idiomas**

`contactado` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Pudiste revisar la información que te compartimos? Si tienes alguna duda con gusto te ayudamos. 😊"*
- Intento 2: *"Hola [nombre], queremos asegurarnos de que tengas toda la información que necesitas para tomar la mejor decisión. Recuerda que tenemos una promoción activa con descuento en inscripción. ¿Te gustaría agendar tu examen de ubicación gratuito?"*

`examen_ubicacion` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Pudiste realizar tu examen de ubicación? Es el primer paso para unirte a la familia Windsor. Si necesitas ayuda con el proceso, aquí estamos. 😊"*
- Intento 2: *"Hola [nombre], tu lugar está disponible. El examen de ubicación es gratuito y solo toma unos minutos. ¿Lo agendamos hoy?"*

`clase_muestra` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Te gustaría agendar tu clase de prueba gratuita? Es la mejor manera de conocer nuestra metodología y al equipo. 😊"*
- Intento 2: *"Hola [nombre], tu clase de prueba gratuita sigue disponible. Son pocos los lugares y queremos asegurarnos de que puedas vivirla. ¿La agendamos?"*

`seguimiento` (3 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Cómo vas con tu decisión? Si tienes alguna duda sobre el programa o el proceso de inscripción, con gusto te orientamos. Estamos aquí para ayudarte. 😊"*
- Intento 2: *"Hola [nombre], sabemos que tomar una decisión importante lleva tiempo. Si quieres, podemos resolver cualquier duda que tengas antes de que decidas. Recuerda que la promoción actual tiene fecha límite. ¿Hablamos?"*

`promo_enviada` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 Solo para recordarte que la promoción que te compartimos tiene fecha límite. ¿Te gustaría apartar tu lugar antes de que expire? 😊"*
- Intento 2: *"Hola [nombre], este es nuestro último aviso sobre la promoción vigente. Es una oportunidad única para iniciar tu carrera con un descuento importante. ¿La aprovechamos juntos?"*

`inscripcion_pendiente` (1 día sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Pudiste reunir los documentos y realizar el pago? Si tienes alguna duda con el proceso, aquí te ayudamos paso a paso. 😊"*
- Intento 2: *"Hola [nombre], tu lugar está casi apartado. Solo falta completar el proceso de inscripción. ¿Necesitas ayuda con algún documento o con los datos de pago?"*

**TRACK B — Licenciaturas / Bachillerato / Diplomados / Maestrías**

`contactado` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Pudiste revisar la información que te compartimos? Si tienes alguna duda con gusto te ayudamos. 😊"*
- Intento 2: *"Hola [nombre], queremos asegurarnos de que tengas toda la información que necesitas para tomar la mejor decisión. Recuerda que tenemos una promoción activa. ¿Hablamos?"*

`seguimiento` (3 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Cómo vas con tu decisión? Si tienes alguna duda, con gusto te orientamos. 😊"*
- Intento 2: *"Hola [nombre], sabemos que tomar una decisión importante lleva tiempo. Recuerda que la promoción tiene fecha límite. ¿Te ayudamos a dar el siguiente paso?"*

`promo_enviada` (2 días sin respuesta)
- Intento 1: *"Hola [nombre] 👋 Solo para recordarte que la promoción que te compartimos tiene fecha límite. ¿Te gustaría apartar tu lugar? 😊"*
- Intento 2: *"Hola [nombre], este es nuestro último aviso sobre la promoción vigente. ¿La aprovechamos juntos?"*

`inscripcion_pendiente` (1 día sin respuesta)
- Intento 1: *"Hola [nombre] 👋 ¿Pudiste reunir los documentos y realizar el pago? Aquí te ayudamos. 😊"*
- Intento 2: *"Hola [nombre], tu lugar está casi apartado. Solo falta completar el proceso. ¿Necesitas ayuda?"*

### 2d — Mensajes de recordatorio para citas
> ✅ COMPLETADO — Textos aprobados por el usuario
> Aplica para clase de prueba (Track A) y visita presencial (Track B)

**Mensaje 1 — Confirmación inmediata (al agendar)**
```
¡Listo [nombre]! 🎉 Tu cita está confirmada.

📅 Fecha: [fecha]
🕐 Hora: [hora]

📍 Plantel Chilpancingo: Sofía Tena #1, Col. Viguri
📍 Plantel Iguala: Ignacio Zaragoza 99, Col. Centro

Para tu cita recuerda llevar:
• Libreta
• Bolígrafo

¡Te esperamos! Cualquier duda estamos aquí. 😊
```

**Mensaje 2 — Recordatorio 24hrs antes**
```
Hola [nombre] 👋 Te recordamos que mañana tienes tu cita con nosotros.

📅 Fecha: [fecha]
🕐 Hora: [hora]

📍 Plantel Chilpancingo: Sofía Tena #1, Col. Viguri
📍 Plantel Iguala: Ignacio Zaragoza 99, Col. Centro

¡Te esperamos! 😊
```

**Mensaje 3 — Recordatorio 2hrs antes (con confirmación)**
```
Hola [nombre] 👋 En 2 horas tienes tu cita con nosotros. ¡Ya casi!

🕐 Hora: [hora]

📍 Plantel Chilpancingo: Sofía Tena #1, Col. Viguri
📍 Plantel Iguala: Ignacio Zaragoza 99, Col. Centro

¿Nos confirmas tu asistencia?
A) ¡Ahí estaré! ✅
B) Necesito reagendar 📅
```
- Si A → bot confirma y notifica al asesor
- Si B → bot abre agenda para reagendar y actualiza la cita

---

## GRUPO 3 — Reglas del proceso de envío
> **Depende de: GRUPO 2 completo.**
> Define cuándo, cómo y a quién se manda cada mensaje. El agente implementa la lógica de decisión en el bot.

### 3a — Lógica de CTAs por track y etapa
Implementar en el bot la lógica que decide qué CTA mostrar según:
- El track del lead (idiomas vs licenciaturas/bachillerato)
- La etapa actual del lead en el pipeline
- Si el lead ya tomó el examen de ubicación
- Si el lead ya tomó la clase de prueba

Reglas clave:
- Clase de prueba: SOLO para idiomas (inglés adultos / niños)
- Examen de ubicación: SOLO para idiomas
- Promo: se ofrece en `seguimiento` (no desde el primer mensaje)
- Inscripción presencial: siempre ofrecer las dos opciones (online o ir a instalaciones)

### 3b — Lógica de respuesta a CTAs
Implementar qué hace el bot cuando el lead elige cada opción:
- **A (dudas)** → bot resuelve via RAG → vuelve a ofrecer CTA
- **B (siguiente paso)** → avanza en el flujo según track y etapa
- **Confirma asistencia** → registra en CRM + notifica asesor
- **Reagendar** → abre agenda + actualiza cita
- **Confirma pago y documentos** → registra en CRM + notifica asesor + mueve a `inscripcion_pendiente`
- **Pide hablar con humano** → activa `modo_humano` + notifica asesor

### 3c — Notificaciones al asesor
Implementar las notificaciones que llegan al asesor en los siguientes eventos:
1. Lead confirmó examen de ubicación realizado
2. Lead confirmó asistencia a clase de prueba (2hrs antes)
3. Lead no confirmó asistencia (no respondió el recordatorio de 2hrs)
4. Lead pidió hablar con humano
5. Lead confirmó pago y subida de documentos → inscripcion_pendiente
6. Lead reagendó una cita

Canal de notificación: dentro del CRM (panel CONVERSACIONES) + mensaje WhatsApp al asesor asignado.

---

## GRUPO 4 — Automatización del pipeline
> **Depende de: GRUPO 3 completo.**
> El lead se mueve solo en el pipeline. El agente implementa los jobs automáticos y triggers.

### 4a — Creación automática del lead *(implementado en `app/api/whatsapp/webhook/route.ts`)*
Cuando llega un mensaje de WhatsApp de un número nuevo:
- Crear lead en Supabase con etapa `contactado`
- Asignar al admin por defecto (`DEFAULT_LEAD_ASIGNADO_A` / `WHATSAPP_DEFAULT_ADMIN_USER_ID`, o primer `profiles` con `rol = admin`)
- Registrar en `lead_activities` con `event_type: primer_contacto`, `title: Primer contacto`
- No duplicar: si ya existe `leads.whatsapp` igual, se reutiliza el lead
- El track se detecta automáticamente cuando el lead elige un programa (idiomas vs licenciaturas)

### 4b — Movimiento automático de etapas
El sistema mueve la etapa del lead automáticamente según las acciones:

| Acción | Etapa resultante |
|---|---|
| Lead elige programa de idiomas | `contactado` (track A) |
| Lead elige licenciatura/bach/diplomado | `contactado` (track B) |
| Lead confirma que hizo el examen | `examen_ubicacion` |
| Lead agenda clase de prueba | `clase_muestra` |
| Lead confirma asistencia a clase | sigue en `clase_muestra` |
| Lead dice que quiere inscribirse | `seguimiento` → `promo_enviada` |
| Lead elige inscripción (online o presencial) | `inscripcion_pendiente` |
| Lead confirma pago y documentos | `inscripcion_pendiente` (notifica asesor) |
| Asesor confirma inscripción | `inscrito` |
| Lead dice que no le interesa | `perdido` |
| 2 intentos de reactivación sin respuesta | `archivado` |

### 4c — Job de reactivación automática *(implementado)*
- **Endpoint:** `POST /api/whatsapp/reactivacion` — protegido con header `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret: <CRON_SECRET>` (variable de entorno `CRON_SECRET`).
- **SQL:** `supabase/reactivacion_intentos.sql` (tabla `reactivacion_intentos` + columna opcional `whatsapp_conversaciones.provider`).
- **Lógica:** silencio medido desde el último mensaje del **usuario** en `whatsapp_mensajes` (fallback: `ultimo_mensaje_at` de la conversación). Días por etapa según § tiempos arriba; mínimo **48 h** entre intento 1 y 2. Tras **2 intentos** en la misma etapa canónica sin respuesta → `stage: archivado` + `lead_activities`. Mensajes: §2c (`lib/whatsapp/reactivacion-messages.ts`). Envío: Twilio o Meta según `whatsapp_conversaciones.provider` o `WHATSAPP_PROVIDER`.
- **Cron (ej. Vercel):** cada hora `POST` al endpoint con el secret (ej. `0 * * * *`).

Implementar un job (cron o trigger) que:
1. Corre cada hora
2. Busca leads con etapa activa que llevan X días sin actividad (según tabla de tiempos del Grupo 3)
3. Verifica cuántos intentos de reactivación lleva el lead en esa etapa
4. Si intentos < 2 → manda el mensaje de reactivación correspondiente + registra el intento
5. Si intentos = 2 → mueve el lead a `archivado` + registra en `lead_activities`

Tabla de referencia en Supabase necesaria: `reactivacion_intentos` con campos:
- `lead_id`
- `etapa`
- `intento` (1 o 2)
- `enviado_at`

### 4d — Scheduler de recordatorios para citas
Implementar el scheduler que manda los 3 mensajes de recordatorio cuando se agenda una cita:

1. **Inmediato** → al crear la cita en `citas`
2. **24hrs antes** → job que corre cada hora y detecta citas con `starts_at` entre 23 y 25 horas
3. **2hrs antes** → job que corre cada hora y detecta citas con `starts_at` entre 1.5 y 2.5 horas

Aplica para tipos de cita: `clase_prueba` y `visita_presencial`.

Si el lead responde **B (reagendar)**:
- Cancelar los recordatorios pendientes de la cita original
- Actualizar la cita en Supabase
- Reiniciar los 3 recordatorios con la nueva fecha

---

## Dependencias entre grupos

```
GRUPO 1 (BASE)
    │
    ▼
GRUPO 2 (Mensajes)      GRUPO 4a puede arrancar en paralelo con GRUPO 1
    │
    ▼
GRUPO 3 (Reglas)
    │
    ▼
GRUPO 4b, 4c, 4d (Automatización)
```

## Archivos clave del proyecto

- `app/api/whatsapp/webhook/route.ts` — bot productivo
- `app/api/whatsapp/lab/route.ts` — simulador del bot
- `app/api/rag/upload/route.ts` — subir documentos a la BASE
- `app/api/rag/query/route.ts` — consultar la BASE
- `components/crm/KanbanBoard.jsx` — pipeline visual
- `components/crm/ConversationsPanel.jsx` — conversaciones WhatsApp
- `components/crm/AgendaPanel.jsx` — agenda de citas
- `docs/CONTEXT.md` — contexto técnico completo del proyecto
- `.env.local` — variables de entorno (Supabase, OpenAI, Twilio)

## Stack técnico

- Next.js App Router · Supabase (auth, DB, RLS) · OpenAI GPT-4o · Twilio WhatsApp · Vercel deploy
- URL producción: https://crm.windsor.edu.mx
- Webhook WhatsApp: https://crm.windsor.edu.mx/api/whatsapp/webhook
