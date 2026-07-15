-- MIGRACIÓN v6 — modo prueba para números de admin
-- Permite que Alexis/Harold activen el flujo real del bot en su propio número
-- (mandando "test") para probar como si fueran un cliente, y salgan con "salir".
-- Se usa solo desde el webhook con el service role — no se expone en el CRM.

create table if not exists public.admin_test_mode (
  whatsapp text primary key,
  activated_at timestamptz not null default now()
);

alter table public.admin_test_mode enable row level security;

create policy "solo service role"
  on public.admin_test_mode for all
  using (false)
  with check (false);
