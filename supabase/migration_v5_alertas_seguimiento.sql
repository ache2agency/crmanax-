-- MIGRACIÓN v5 — soporte para 2 alertas nuevas:
-- 1) Resumen a Alexis 15 min después de un lead nuevo
-- 2) Mensaje de seguimiento a quien deja la conversación sin contestar (10-20h)

alter table public.leads
  add column if not exists resumen_alertado boolean not null default false;

alter table public.whatsapp_conversaciones
  add column if not exists seguimiento_enviado boolean not null default false;
