-- MIGRACIÓN v7 — notificaciones push (Web Push) para la app instalada en el teléfono
-- Guarda la suscripción push de cada usuario que instaló el CRM como app y aceptó
-- notificaciones. El webhook la usa (con service role) para avisar de mensajes nuevos.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "usuarios ven y crean su propia suscripción"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
