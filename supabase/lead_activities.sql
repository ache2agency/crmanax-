create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lead_activities enable row level security;

create index if not exists lead_activities_lead_created_idx
  on public.lead_activities (lead_id, created_at desc);

create policy "admin acceso total lead_activities"
  on public.lead_activities
  for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve sus actividades"
  on public.lead_activities
  for select
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_activities.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor inserta actividades de sus leads"
  on public.lead_activities
  for insert
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = lead_activities.lead_id
        and l.asignado_a = auth.uid()
    )
  );
