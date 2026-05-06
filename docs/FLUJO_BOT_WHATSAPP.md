# Secuencia de la conversación del bot WhatsApp

Define el flujo de la plática según **botwindsor.txt**: nombre → programa → correo → información → dudas → acción. Referencia para mantener el flujo consistente.

---

## Orden de evaluación

1. **Modo humano** – Si `modo_humano = true`, el bot no responde.
2. **Reglas por palabra clave (FLOWS)** – Si hay match en el flow activo, se usa esa respuesta.
3. **Fases del flujo** – Se aplica la lógica de la fase actual.
4. **RAG** – Resto de mensajes (sobre todo dudas) se responden con base de conocimiento + contexto del lead.

---

## Fases (flujo botwindsor)

### 1. SALUDO – Pedir nombre

| Bot dice | Usuario responde | Siguiente |
|----------|------------------|-----------|
| "Hola, gracias por contactarnos. ¿Me compartes tu nombre, por favor?" | Si parece un **nombre** (no saludo tipo "hola", no correo) → se guarda en el lead. | **programa** |
| (igual) | Si no da nombre (ej. "hola", "buenas") | Repite pidiendo nombre (sigue en **saludo**). |

- **Sin conversación:** primer mensaje recibe el mismo saludo pidiendo nombre (luego se crea lead y conversación).

---

### 2. PROGRAMA – Identificar programa de interés

| Bot dice | Usuario responde | Siguiente |
|----------|------------------|-----------|
| "Mucho gusto, [nombre]. ¿Qué programa te interesa? Tenemos: *Inglés para niños*, *Inglés para adultos*, *Licenciaturas*, *Maestrías* y *Diplomados*." | Indica un programa (inglés niños/adultos, licenciaturas, maestrías, diplomados, idiomas). | **correo** |
| (igual) | Respuesta ambigua | Repite pidiendo que indique el programa. |

- Se guarda en el lead el `curso` según lo que diga.

---

### 3. CORREO – Pedir correo para enviar información

| Bot dice | Usuario responde | Siguiente |
|----------|------------------|-----------|
| "Perfecto. Compárteme tu correo y te envío la información completa del programa." | Con o sin correo (si da correo válido se guarda). **No se bloquea** si no lo comparte. | **info_enviada** |

- El correo se pide como parte del envío de información, no como barrera inicial.

---

### 4. INFO_ENVIADA – Enviar información y preguntar dudas

| Bot dice | Usuario responde | Siguiente |
|----------|------------------|-----------|
| Bloque de información del programa + "¿Te gustaría que resolviera alguna duda?" | "Sí", "tengo dudas", preguntas → | **dudas** (RAG). |
| (igual) | "No", "listo", "perfecto", etc. → | **accion** (oferta de siguiente paso). |

- La información detallada de cada programa se puede cargar después por separado (por ahora se envía un bloque genérico por tipo de programa).

---

### 5. DUDAS – Resolución con RAG

| Bot dice | Usuario responde | Siguiente |
|----------|------------------|-----------|
| "Con gusto te ayudo. ¿Qué te gustaría saber?" y respuestas desde la **base de conocimiento** (RAG). | Preguntas → RAG responde. | Sigue en **dudas**. |
| (igual) | "Siguiente paso", "avanzar", "agendar", "dale", etc. → | **accion**. |

- Si no sabe responder algo, se puede escalar a humano (modo humano en el CRM).

---

### 6. ACCIÓN – CTA según tipo de programa

| Programa | Oferta del bot | Si acepta |
|----------|----------------|-----------|
| **Inglés niños / Inglés adultos / Idiomas** | "Puedes agendar una *clase de prueba gratuita*. ¿Te gustaría agendarla?" | Link de agendar clase de prueba → **cerrado**. |
| **Licenciaturas, Maestrías, Diplomados** | "Te podemos apoyar con *examen de ubicación*, *inscripción* o *asesoría por llamada*. ¿Te gustaría que te comparta el enlace?" | Link para examen/inscripción/asesoría → **cerrado**. |

- **No interesado** (no quiero, no gracias, cancelar, baja) → despedida y lead `stage: perdido` → **perdido**.
- **Acepta** → se envía el link correspondiente, lead `stage: en_proceso` → **cerrado**.

---

### 7. CERRADO / PERDIDO

- **cerrado:** El usuario recibió el enlace; la conversación queda cerrada. Mensajes posteriores pueden pasar por reglas FLOWS o RAG.
- **perdido:** No interesado. Mismo criterio para mensajes posteriores.

---

## Compatibilidad con conversaciones antiguas

- Si la conversación tiene fase **datos** o **info_programa** (flujo anterior), se trata como fase **programa**: se pide programa de interés y se sigue el flujo nuevo desde ahí.

---

## Modo humano

- Por defecto la conversación está en **modo BOT**.
- Solo pasa a **modo humano** cuando un vendedor hace clic en "Tomar control" en el CRM.
- Vuelve a BOT con el botón "Volver a BOT" o con la confirmación al salir del chat: "Al salir, la conversación pasará a modo BOT. ¿Aceptar o Cancelar?"

---

## Sincronía con el CRM

| Momento | Cambio en el lead |
|---------|--------------------|
| Se captura nombre (saludo) | `stage: contactado` |
| Se elige programa | `curso: Inglés niños / Inglés adultos / Licenciaturas / etc.` |
| Se captura correo (opcional) | `email` |
| Acepta acción (link) | `stage: en_proceso` |
| No interesado | `stage: perdido` |

---

## Dónde está implementado

- Webhook: `app/api/whatsapp/webhook/route.ts`
- Fases en `whatsapp_conversaciones.fase`: saludo | programa | correo | info_enviada | dudas | accion | cerrado | perdido | seguimiento
- Referencia de producto: `botwindsor.txt`

---

*Última actualización: flujo alineado con botwindsor.txt.*
