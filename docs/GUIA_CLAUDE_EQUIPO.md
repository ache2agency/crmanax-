# Guía para trabajar con Claude Code (web) — equipo Windsor/Anaxágoras

Esta guía la siguen las sesiones de Claude Code en claude.ai/code de **Carlos (Plataforma-cpu)**. Dueño y aprobador: Harold.

## Entorno: "CRMs lectura" (uno solo para los dos CRMs)
Si no existe, créalo así (no inventes otro):
- **Red permitida:** `aws-1-us-east-1.pooler.supabase.com` (Windsor) y `aws-1-us-west-2.pooler.supabase.com` (Anaxágoras), más gestores de paquetes (npm) para instalar el cliente `pg`.
- **Variables (secretas, por formulario seguro):** `WINDSOR_DB_URL` y `ANAX_DB_URL`. Carlos las tiene. Nunca las escribas en archivos, commits, PRs ni en el chat.
- **Repositorios:** `ache2agency/windsorcrm` y `ache2agency/crmanax-`.
- NO uses hosts `*.supabase.co` directos ni pidas la llave `service_role`, `CRON_SECRET`, tokens de Meta ni ninguna otra credencial. Si algo no funciona con lo de arriba, detente y avisa a Carlos.

## Qué puedes hacer con la base de datos
- Usuario `lectura_carlos`: **solo lectura** de `leads`, `whatsapp_conversaciones` y `whatsapp_mensajes`. Cualquier escritura falla (es a propósito).
- Úsalo para: revisar conversaciones (últimas 24 h, por número), detectar respuestas equivocadas del bot, leads sin atender y armar reportes.
- Identifica a los leads por **número de WhatsApp**, no por nombre.
- Tablas útiles: `whatsapp_conversaciones` (whatsapp, fase, modo_humano, ultimo_mensaje_at), `whatsapp_mensajes` (conversacion_id, rol usuario/bot/agente, contenido, created_at). Hora local: `created_at at time zone 'America/Mexico_City'`.

## Contestar a un lead
- Tú **redactas** la respuesta; **Carlos la revisa y la envía desde el chat del CRM** (crm.windsor.edu.mx o el CRM de Anaxágoras). Tú no envías mensajes.
- Si el mensaje lleva **precios, promociones o fechas**, Carlos lo confirma con Harold antes de enviarlo.

## Cambios al código
- Siempre en una rama nueva y con **PR** hacia `main`, con descripción en español (qué y por qué). `main` está protegida: requiere aprobación de Harold.
- En windsorcrm, merge a `main` = publicar en producción; por eso solo Harold aprueba.
- No pruebes nada que mande WhatsApps o correos a leads reales. No incluyas datos de alumnos/clientes en código, PRs ni pruebas.
