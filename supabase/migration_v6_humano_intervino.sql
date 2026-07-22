-- MIGRACIÓN v6 — no volver a mandar el seguimiento automático (10-20h)
-- una vez que un humano ya intervino en la conversación, aunque
-- después vuelva a modo_humano = false ("Volver a BOT").

alter table public.whatsapp_conversaciones
  add column if not exists humano_intervino boolean not null default false;

-- Backfill: conversaciones que ya están en modo_humano hoy, o que
-- alguna vez tuvieron un mensaje de agente (aunque ya hayan vuelto a
-- modo_humano = false), también cuentan como intervenidas, para no
-- mandarles el seguimiento retroactivamente.
update public.whatsapp_conversaciones c
  set humano_intervino = true
  where c.modo_humano = true
     or exists (
       select 1 from public.whatsapp_mensajes m
       where m.conversacion_id = c.id
         and m.rol = 'agente'
     );
