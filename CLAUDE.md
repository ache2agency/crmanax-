# CRM Anaxagoras — Contexto para Claude Code

## ¿Qué es este proyecto?

CRM para **Anaxagoras**, empresa de renta de departamentos. Permite a los asesores gestionar prospectos, agendar visitas y dar seguimiento hasta cerrar contratos de renta.

## Stack

- **Next.js 16** (App Router) + React 19
- **Supabase** — base de datos y autenticación
- **OpenAI** — chat AI del bot de WhatsApp y del asistente del asesor
- **Meta WhatsApp Cloud API** — bot de WhatsApp (número real +52 55 3466 9642). El código todavía soporta Twilio como proveedor alterno vía `lib/whatsapp/provider.ts` (`WHATSAPP_PROVIDER=twilio|meta`), pero producción corre sobre Meta.
- **Resend** — emails
- **Vercel** — deployment (https://crmanax.vercel.app) — deploy manual con `vercel --prod`, no auto

## Pipeline de ventas

7 etapas, definidas en `app/crm.jsx` (`STAGES`), en este orden:

1. `nuevo_contacto` — primer contacto, prospecto nuevo
2. `cotizado` — se le mandó cotización/info
3. `deposito_pendiente` — esperando depósito
4. `reservado` — depósito pagado, fecha apartada
5. `hospedado` — ya está en el loft
6. `completado` — estancia terminada
7. `no_interesado` — descartado

Etapas viejas (`interesado`, `en_proceso`, `rentado`, `nuevo`, `contactado`) siguen mapeadas a las nuevas vía `LEGACY_STAGE_MAP` en `app/crm.jsx` para no romper leads antiguos.

## Campos del prospecto (lead)

| Campo | Descripción |
|-------|-------------|
| `nombre` | Nombre completo |
| `email` | Correo electrónico |
| `whatsapp` | Número con código de país |
| `zona` | Zona o colonia de interés (texto libre) |
| `presupuesto` | Presupuesto mensual en pesos |
| `cuartos` | 1 / 2 / 3 / 4+ |
| `fecha_entrada` | Fecha estimada de entrada |
| `valor` | Valor estimado de la renta |
| `notas` | Notas del asesor |
| `stage` | Etapa del pipeline (ver arriba) |
| `asignado_a` | ID del asesor asignado (por defecto Alexis vía `DEFAULT_LEAD_ASIGNADO_A`, no admin) |
| `tipo_renta` | `'noche'` o `'mes'` |
| `fecha_checkin` / `fecha_checkout` | Fechas de estancia |
| `num_personas` | Número de huéspedes |
| `loft_id` | Referencia a `public.lofts` (12 lofts reales: PB-01 a PB-04, 1ER-11 a 1ER-14, 2DO-21 a 2DO-24) |
| `deposito_monto` / `deposito_pagado` / `deposito_devuelto` | Seguimiento del depósito |
| `yale_email`, `id_recibida`, `docs_recibidos` | Solo aplican a renta mensual |

## Estructura de archivos clave

```
app/
  crm.jsx              # Componente principal del CRM
  page.tsx             # Entry point (auth + layout)
  login/page.jsx       # Login
  registro/            # Alta de nuevos usuarios/asesores
  agendar/[vendedor]/  # Página pública de agendar cita por vendedor
  api/
    chat/              # Chat AI del asesor
    leads/activity/    # Registro de actividades
    whatsapp/
      webhook/         # Bot de WhatsApp en producción (Meta Cloud API)
      send/            # Envío manual de mensajes desde el CRM
      bienvenida/      # Mensaje de bienvenida a lead manual
      reactivacion/    # Seguimiento 10-20h a leads sin respuesta (protegido con CRON_SECRET)
      reactivar-manual/
      lab/             # Bot de pruebas — desincronizado del webhook real, no confiar en él
      status/          # Estado de configuración del proveedor de WhatsApp
    emails/            # Secuencias de email
    rag/               # Base de conocimiento
    debug-supabase/    # Endpoint de debug para inspeccionar conversaciones reales

components/crm/
  KanbanBoard.jsx      # Tablero Kanban (7 etapas)
  LeadsTable.jsx       # Vista de lista
  LeadDetailModal.jsx  # Modal de detalle del prospecto
  NewLeadModal.jsx     # Formulario nuevo prospecto
  NewAppointmentModal.jsx # Formulario nueva cita
  AgendaPanel.jsx      # Panel de citas
  ConversationsPanel.jsx # Panel de WhatsApp
```

## Roles de usuario

- **admin** (`arrirra@gmail.com`) — ve todos los leads, puede reasignar, eliminar
- **vendedor** (Alexis, `anaxagoras41suite@gmail.com`) — solo ve los leads asignados a él; leads nuevos caen aquí por defecto vía `DEFAULT_LEAD_ASIGNADO_A`, no en admin

## Reglas importantes

- **Nunca trabajes directo en `main`** — crea siempre una rama nueva
- **Nunca subas `.env.local`** — tiene keys secretas, ya está en .gitignore
- **Siempre manda un Pull Request** para que el dueño del proyecto revise antes de fusionar (branch protection exige 1 aprobación — Harold usa `gh pr merge --admin` porque no hay más colaboradores)
- No cambies el pipeline sin consultarlo — el cliente aún lo está validando
- El bot de WhatsApp (`api/whatsapp/webhook`) **ya está en producción** para renta de deptos (no está pendiente de rediseño). Sí tócalo, pero con cuidado — es el flujo real que atienden leads reales.
- Deploy es manual: `vercel --prod`. No hay deploy automático al mergear a `main`.
- Los Preview deployments de Vercel están rotos (faltan env vars de Supabase en el ambiente Preview) — no confíes en ellos para probar, prueba en local o revisa el diff con cuidado antes de ir a producción.

## Cómo crear una rama y mandar cambios

```bash
git checkout -b nombre-descriptivo-del-cambio
# ... haz tus cambios ...
git add .
git commit -m "descripción del cambio"
git push origin nombre-descriptivo-del-cambio
# Luego abre un Pull Request en GitHub
```

## Variables de entorno necesarias

Pídele al dueño del proyecto el archivo `.env.local` — sin él la app no conecta a Supabase ni a las APIs.
