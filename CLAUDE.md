# CRM Anaxagoras — Contexto para Claude Code

## ¿Qué es este proyecto?

CRM para **Anaxagoras**, empresa de renta de departamentos. Permite a los asesores gestionar prospectos, agendar visitas y dar seguimiento hasta cerrar contratos de renta.

## Stack

- **Next.js 16** (App Router) + React 19
- **Supabase** — base de datos y autenticación
- **OpenAI** — chat AI de asistencia al asesor
- **Twilio** — WhatsApp
- **Resend** — emails
- **Vercel** — deployment (https://crmanax.vercel.app)

## Pipeline de ventas

4 etapas, en este orden:

1. `interesado` — primer contacto, prospecto nuevo
2. `en_proceso` — visita agendada o en negociación
3. `rentado` — contrato firmado
4. `no_interesado` — descartado

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
| `stage` | Etapa del pipeline |
| `asignado_a` | ID del asesor asignado |

## Estructura de archivos clave

```
app/
  crm.jsx              # Componente principal del CRM
  page.tsx             # Entry point (auth + layout)
  login/page.jsx       # Login
  api/
    chat/              # Chat AI del asesor
    leads/activity/    # Registro de actividades
    whatsapp/          # Bot y webhook de WhatsApp
    emails/            # Secuencias de email
    rag/               # Base de conocimiento

components/crm/
  KanbanBoard.jsx      # Tablero Kanban
  LeadsTable.jsx       # Vista de lista
  LeadDetailModal.jsx  # Modal de detalle del prospecto
  NewLeadModal.jsx     # Formulario nuevo prospecto
  AgendaPanel.jsx      # Panel de citas
  ConversationsPanel.jsx # Panel de WhatsApp
```

## Roles de usuario

- **admin** — ve todos los leads, puede reasignar, eliminar
- **vendedor** — solo ve los leads asignados a él

## Reglas importantes

- **Nunca trabajes directo en `main`** — crea siempre una rama nueva
- **Nunca subas `.env.local`** — tiene keys secretas, ya está en .gitignore
- **Siempre manda un Pull Request** para que el dueño del proyecto revise antes de fusionar
- No cambies el pipeline sin consultarlo — el cliente aún lo está validando
- El código del bot de WhatsApp (`api/whatsapp/webhook`) está pendiente de rediseño para renta de deptos, no lo toques por ahora

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
