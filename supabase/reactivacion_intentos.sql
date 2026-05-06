-- Intentos de reactivación por lead y etapa (GRUPO 4c)
create table if not exists public.reactivacion_intentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  etapa text not null,
  intento smallint not null check (intento in (1, 2)),
  enviado_at timestamptz not null default now(),
  unique (lead_id, etapa, intento)
);

create index if not exists reactivacion_intentos_lead_etapa_idx
  on public.reactivacion_intentos (lead_id, etapa);

alter table public.reactivacion_intentos enable row level security;

-- Solo service role / admin en la práctica (cron usa service role)
create policy "admin acceso total reactivacion_intentos"
  on public.reactivacion_intentos
  for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve intentos de sus leads"
  on public.reactivacion_intentos
  for select
  using (
    exists (
      select 1
      from public.leads l
      where l.id = reactivacion_intentos.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

-- Opcional: proveedor por conversación (Twilio vs Meta)
alter table public.whatsapp_conversaciones
  add column if not exists provider text;

comment on column public.whatsapp_conversaciones.provider is 'twilio | meta — si null, usa WHATSAPP_PROVIDER en el servidor';
