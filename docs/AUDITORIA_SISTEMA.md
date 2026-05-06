# Auditoría del Sistema — Instituto Windsor CRM
**Fecha:** 2026-04-12
**Elaborado con:** Claude Code (claude-sonnet-4-6)

---

## Mapa de Pilares del Sistema

El bot de WhatsApp y CRM se divide en 12 pilares. Cada uno tiene su propio estado, problemas y pendientes.

---

### 1. Base de Conocimiento (RAG)
**Archivos:** `/app/api/rag/query/route.ts`, `/app/api/rag/upload/route.ts`
**Estado:** ⚠️ Parcial

**Qué existe:**
- Tabla `documentos` en Supabase con embeddings (vector 1536, text-embedding-ada-002)
- Función `match_documents()` con búsqueda por similitud coseno (pgvector)
- Endpoint de consulta con timeout de 60s, match_count configurable (máx 20)
- Endpoint de subida de documentos

**Qué funciona bien:**
- Consulta retorna contexto para GPT correctamente
- Formato de respuesta compatible con WhatsApp

**Qué está roto o incompleto:**
- Endpoint de subida no integrado al flujo del webhook
- Sin mecanismo de actualización/refresco de documentos
- Sin chunking strategy visible para documentos grandes

**Qué falta:**
- Versioning de documentos
- Filtros por programa o categoría
- Eliminar/archivar docs desactualizados
- Interfaz de administración para subir docs desde el CRM

---

### 2. INFO_MSGS — Mensajes Estructurados por Programa
**Archivo:** `app/api/whatsapp/webhook/route.ts` (líneas 367–570)
**Estado:** ✅ Bien (pero estático)

**Qué existe:**
- 12+ bloques de info hardcodeados por programa
- Cubre: Inglés adultos/niños, Psicología, Lic. Inglés (presencial/online), Administración Turística (presencial/online), Relaciones Públicas y Mercadotecnia (presencial/online), Bachillerato

**Qué funciona bien:**
- Formato WhatsApp correcto (asteriscos, bullets)
- Incluye precios, horarios, promociones del mes, links a planes de estudio
- Coherente con buildCTA()

**Qué está roto o incompleto:**
- Porcentajes de descuento hardcodeados (no se actualizan solos)
- Sin fechas de vencimiento de promos
- Faltan programas: Francés, Italiano, Diplomados, Maestrías

**Qué falta:**
- Tabla en DB para administrar INFO_MSGS dinámicamente
- Scheduler de promociones con fecha de inicio/fin
- Sincronización con el lab route (actualmente desactualizado)

---

### 3. Comportamiento del Bot — Flujo de Fases
**Archivo:** `app/api/whatsapp/webhook/route.ts`
**Estado:** ✅ Bien (con bugs conocidos)

**Fases del flujo:**
```
saludo → programa → correo → accion → (inscripcion | clase_prueba | asesor | dudas) → seguimiento/cerrado
```

**Qué funciona bien:**
- Transiciones de fase persistidas en DB por conversación
- Detección de programa 100% en código (sin GPT) — `detectarPrograma()`
- Detección de correo en código — `detectarEmail()` / `noQuiereEmail()`
- Captura de nombre en código (heurística sin GPT)
- Manejo de inglés ambiguo (menú A/B/C)
- Interceptor de cambio de programa post-correo

**Bugs conocidos / incompletos:**
- `detectProgramaCambio` (interceptor de cambio) es función separada de `detectarPrograma()` — hay que mantenerlas en sync. No tiene `mkt`, `mercado`, ni shorthands.
- Fase `accion`: cualquier mensaje que no sea eligeA/eligeB repite el CTA en lugar de responder preguntas ("promo", "cuánto cuesta", etc.)
- Fase `examen` existe en mensajes pero no en handlers
- Fase `clase_prueba` post-examen incompleta (sin integración de agendamiento real)

**Qué falta:**
- Unificar `detectProgramaCambio` con `detectarPrograma()` (fix de raíz)
- Fase `accion`: si mensaje parece pregunta (>12 chars o termina en `?`) → pasar a GPT con RAG
- Timeout/expiración de conversaciones inactivas
- Override manual de fase desde el CRM

---

### 4. Prompt de GPT (askGPT)
**Archivo:** `app/api/whatsapp/webhook/route.ts` (líneas ~790–940)
**Estado:** ⚠️ Parcial

**Qué existe:**
- Función `askGPT()` con instrucciones por fase (`faseInstruccion{}`)
- Respuesta en JSON forzado (`response_format: json_object`)
- Temperature 0.6, max_tokens 800, timeout 13s
- Campos: respuesta, siguienteFase, nombre, email, programa, telefono, requestedHuman, noInterest
- Fallback si falla el parse de JSON

**Qué funciona bien:**
- GPT solo genera TEXTO, el código decide el FLUJO (arquitectura correcta desde refactor)
- Historial de conversación pasa a GPT (últimos 6 mensajes)
- Manejo de timeout con AbortSignal

**Qué está roto o incompleto:**
- GPT a veces usa formato markdown (guiones `-`, `**texto**`) en lugar de WhatsApp (`•`, `*texto*`)
- Sin guardrails contra alucinaciones (puede inventar precios/programas)
- Bot prompt personalizado desde DB (`getBotPrompt()`) puede estar vacío

**Qué falta:**
- Instrucción explícita de formato WhatsApp en system prompt
- Validación del campo `programa` que devuelve GPT (que coincida con programas reales)
- Few-shot examples en el prompt
- Límite de tokens por conversación antes de llamar GPT

---

### 5. Captura de Datos del Lead
**Archivo:** `app/api/whatsapp/webhook/route.ts`
**Estado:** ✅ Bien

**Qué existe:**
- **Nombre:** heurística en código (fase saludo) — sin dígitos, sin keywords de programa, 1-3 palabras
- **Programa:** `detectarPrograma()` en código (fase programa)
- **Correo:** regex en código (fase correo) + skip si no quiere
- **WhatsApp:** normalizado y guardado al crear lead
- **Teléfono:** capturado por GPT en fase asesor (no validado)

**Qué funciona bien:**
- Los 3 datos principales capturados sin GPT
- Guard contra teléfono como nombre (`hasLeadName()`)
- Lead creado automáticamente si es nuevo contacto

**Qué está roto o incompleto:**
- Captura de teléfono solo en fase asesor y via GPT (no validado)
- Si el usuario da un correo inválido, se guarda igual

**Qué falta:**
- Validación básica de formato de email antes de guardar
- Campo `fuente` del lead (actualmente hardcodeado como 'WhatsApp - Instituto Windsor')
- Flag de consentimiento/opt-in

---

### 6. Escalamiento a Asesor
**Archivo:** `app/api/whatsapp/webhook/route.ts` (función `notifyAsesor`)
**Estado:** ✅ Bien

**Qué existe:**
- 5 tipos de evento: `lead_pide_humano`, `inscripcion_confirmada`, `examen_confirmado`, `cita_agendada`, `nuevo_lead`
- Registra en `lead_activities` + manda WhatsApp al asesor asignado
- Soporta Twilio y Meta

**Qué funciona bien:**
- Logging + notificación en una sola función
- Manejo graceful de errores (try/catch, no bloquea el flujo)

**Qué está roto o incompleto:**
- `cita_agendada` definido pero nunca se dispara en el webhook
- `examen_confirmado` se dispara para clase_prueba (nombre inconsistente)

**Qué falta:**
- Asesor de respaldo si el primario no está disponible
- Rate limiting (evitar spam al asesor)
- Confirmación de entrega del mensaje

---

### 7. Reactivación (Cron)
**Archivos:** `app/api/whatsapp/reactivacion/route.ts`, `vercel.json`
**Estado:** ✅ Bien

**Qué existe:**
- Cron diario (15:00 UTC) — `"0 15 * * *"`
- Busca leads en 13 etapas sin respuesta X días
- Máx 2 intentos por etapa, 48h entre intentos
- Archiva al lead después de 2 intentos sin respuesta
- Mensajes Track A (idiomas) y Track B (licenciaturas)

**Qué funciona bien:**
- CRON_SECRET para autenticación
- Registro en `reactivacion_intentos` con unique constraint
- Registra evento en `lead_activities` al archivar

**Qué está roto o incompleto:**
- Mapeo de etapas incompleto (algunas etapas del CRM no mapeadas)
- No detecta si el usuario ya respondió (podría reactivar a alguien activo)

**Qué falta:**
- Detección de actividad reciente antes de enviar
- Aprendizaje de respuestas (si respondió positivo, cambiar etapa)
- A/B testing de mensajes

---

### 8. Analítica y Trazabilidad
**Tabla:** `lead_activities`
**Estado:** ⚠️ Parcial

**Qué existe:**
- Tabla `lead_activities` con event_type, title, detail, meta (jsonb)
- Eventos del bot: `primer_contacto`, `inscripcion_confirmada`, `examen_confirmado`, `nuevo_lead`, `reactivacion_archivado`

**Qué funciona bien:**
- Cobertura de eventos de escalamiento (100%)
- Campo `meta` con contexto (source='bot', provider, etapa)

**Qué está roto o incompleto:**
- No registra transiciones de fase (solo eventos finales)
- No registra errores/fallbacks de GPT o RAG
- Sin métricas de embudo (cuántos llegan a correo, cuántos a inscripción)

**Qué falta:**
- Tracking de conversión por fase
- Tiempo promedio en cada fase
- Score de engagement del lead
- Dashboard de métricas en el CRM

---

### 9. Gestión de Conversación / Sesión
**Tablas:** `whatsapp_conversaciones`, `whatsapp_mensajes`
**Estado:** ✅ Bien

**Qué existe:**
- Conversación se reutiliza si el número ya existe
- `fase` persiste por conversación
- `modo_humano` bloquea al bot cuando está activo
- Historial de mensajes cargado para GPT (últimos 6)
- `ultimo_mensaje_at` actualizado en cada mensaje

**Qué funciona bien:**
- Persistencia de estado sólida
- Bot se detiene correctamente en modo humano

**Qué está roto o incompleto:**
- Sin timeout/expiración de conversaciones (quedan 'abierta' para siempre)
- Sin reset manual de fase desde el CRM
- Si el mismo número envía 2 mensajes simultáneos puede haber race condition

**Qué falta:**
- Expiración automática de conversaciones inactivas (ej. 30 días)
- Reset de fase desde el CRM UI
- Merger de conversaciones si el usuario cambia de número

---

### 10. Manejo de Errores y Fallbacks
**Estado:** ⚠️ Parcial

**Qué existe:**
- 26 bloques try/catch en webhook/route.ts
- Catch global al final que devuelve mensaje de error amigable
- Fallos de RAG se ignoran silenciosamente (flujo continúa)

**Qué funciona bien:**
- El bot nunca se "rompe" visiblemente ante el usuario
- Fallbacks para GPT, RAG y DB

**Qué está roto o incompleto:**
- Errores sin contexto suficiente en logs (difícil debuggear en producción)
- Sin reintentos para fallos transitorios (429, 503)
- Sin alertas cuando algo falla repetidamente

**Qué falta:**
- Integración con herramienta de monitoreo (Sentry o similar)
- Contadores de errores por tipo
- Reintentos con backoff exponencial para llamadas externas

---

### 11. Multi-Proveedor (Twilio vs Meta)
**Archivo:** `lib/whatsapp/provider.ts`
**Estado:** ✅ Bien

**Qué existe:**
- Abstracción limpia: `getWhatsAppProvider()` retorna 'meta' o 'twilio'
- Parser de webhooks para ambos formatos (JSON Meta, form-data Twilio)
- `buildProviderResponse()` retorna TwiML o JSON según proveedor

**Qué funciona bien:**
- Transparente para el resto del bot
- Normalización de número de teléfono consistente

**Qué está roto o incompleto:**
- Meta: no valida firma HMAC del webhook POST (riesgo de seguridad)
- Sin fallback automático si un proveedor falla

**Qué falta:**
- Validación de firma Meta en POST (usar META_APP_SECRET)
- Health check real por proveedor (no solo verificar config)
- Fallback: si Meta falla, intentar Twilio

---

### 12. Entorno / Configuración
**Estado:** ⚠️ Parcial

**Qué existe:**
- Variables: OPENAI_API_KEY, SUPABASE_*, TWILIO_* (3), META_WHATSAPP_* (4), CRON_SECRET, RESEND_API_KEY
- Lab route (`/api/whatsapp/lab`) como entorno de prueba en browser

**Qué funciona bien:**
- Service role key para todas las operaciones backend
- CRON_SECRET verificado antes de ejecutar reactivación

**Qué está roto o incompleto:**
- **Lab route tiene INFO_MSGS desactualizado** — si se actualiza en webhook, hay que actualizarlo también en lab
- META_APP_SECRET definido pero no usado (debería validar firmas)
- Auto-deploy de GitHub a Vercel desconectado (usar `npx vercel --prod`)

**Qué falta:**
- Sincronización de INFO_MSGS entre lab y webhook (o extraerlo a un archivo compartido)
- Validación de variables de entorno al arrancar
- Documentar cuáles variables son requeridas vs opcionales

---

## Resumen de Prioridades

### 🔴 Urgente (afecta experiencia del usuario hoy)
1. **[Pilar 3]** Unificar `detectProgramaCambio` con `detectarPrograma()` — eliminar duplicación
2. **[Pilar 3]** Fase `accion`: responder preguntas con GPT+RAG en lugar de repetir CTA
3. **[Pilar 4]** Agregar instrucción de formato WhatsApp al prompt de GPT

### 🟡 Importante (calidad y confiabilidad)
4. **[Pilar 2]** Agregar INFO_MSGS para Francés, Italiano, y al menos 1 diplomado
5. **[Pilar 12]** Sincronizar INFO_MSGS entre webhook y lab
6. **[Pilar 11]** Validar firma HMAC del webhook de Meta
7. **[Pilar 7]** Completar mapeo de etapas en reactivación

### 🟢 Mejoras futuras
8. **[Pilar 1]** Interfaz para gestionar documentos RAG desde el CRM
9. **[Pilar 8]** Dashboard de métricas de embudo
10. **[Pilar 9]** Expiración automática de conversaciones + reset de fase desde CRM
11. **[Pilar 2]** INFO_MSGS dinámico desde DB con scheduler de promos

---

*Última actualización: 2026-04-12*
