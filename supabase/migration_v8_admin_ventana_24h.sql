-- MIGRACIÓN v8 — mantener abierta la ventana de 24h de WhatsApp de los admin
-- (Alexis, Harold). Registra la última vez que cada número admin le mandó algo
-- al bot (mensaje de texto o toque del botón del template de alerta). El cron
-- /api/whatsapp/mantener-ventana-admin la usa para saber a quién nudgear antes
-- de que su ventana se cierre.

create table if not exists public.admin_ventana_24h (
  whatsapp text primary key,
  ultima_apertura timestamptz not null default now()
);

alter table public.admin_ventana_24h enable row level security;

create policy "solo service role"
  on public.admin_ventana_24h for all
  using (false)
  with check (false);
