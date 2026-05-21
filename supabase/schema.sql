-- ========================
-- ANAXAGORAS CRM — Schema
-- ========================
-- Ejecutar en Supabase Dashboard → SQL Editor → New query

-- ========================
-- PROFILES (va primero porque es_admin() la necesita)
-- ========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  rol text not null default 'vendedor',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- ========================
-- FUNCIÓN HELPER (va después de profiles)
-- ========================
create or replace function public.es_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- Políticas de profiles (van después de es_admin)
create policy "usuario ve su perfil"
  on public.profiles for select
  using (id = auth.uid() or public.es_admin());

create policy "usuario actualiza su perfil"
  on public.profiles for update
  using (id = auth.uid());

create policy "admin acceso total profiles"
  on public.profiles for all
  using (public.es_admin())
  with check (public.es_admin());

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (new.id, new.email, split_part(new.email, '@', 1), 'vendedor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========================
-- LEADS
-- ========================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  email text,
  whatsapp text,
  zona text,
  presupuesto text,
  cuartos text,
  fecha_entrada date,
  stage text default 'interesado',
  valor numeric default 0,
  notas text,
  fecha date,
  asignado_a uuid references public.profiles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.leads enable row level security;

create policy "admin acceso total leads"
  on public.leads for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve sus leads"
  on public.leads for select
  using (asignado_a = auth.uid() or public.es_admin());

create policy "vendedor actualiza sus leads"
  on public.leads for update
  using (asignado_a = auth.uid() or public.es_admin())
  with check (asignado_a = auth.uid() or public.es_admin());

create policy "vendedor inserta leads"
  on public.leads for insert
  with check (auth.uid() is not null);

-- ========================
-- LEAD ACTIVITIES
-- ========================
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
  on public.lead_activities for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve sus actividades"
  on public.lead_activities for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_activities.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor inserta actividades"
  on public.lead_activities for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_activities.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

-- ========================
-- CITAS
-- ========================
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  vendedor_id uuid references public.profiles(id) on delete set null,
  fecha date not null,
  hora time not null,
  tipo text default 'visita',
  duracion integer default 60,
  notas text,
  status text default 'pendiente',
  created_at timestamptz default now()
);
alter table public.citas enable row level security;

create policy "admin acceso total citas"
  on public.citas for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve sus citas"
  on public.citas for select
  using (vendedor_id = auth.uid() or public.es_admin());

create policy "vendedor inserta citas"
  on public.citas for insert
  with check (auth.uid() is not null);

create policy "vendedor actualiza sus citas"
  on public.citas for update
  using (vendedor_id = auth.uid() or public.es_admin());

-- ========================
-- WHATSAPP
-- ========================
create table if not exists public.whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  lead_id uuid references public.leads(id) on delete set null,
  estado text not null default 'abierta',
  fase text not null default 'saludo',
  modo_humano boolean not null default false,
  tomado_por uuid references public.profiles(id),
  ultimo_mensaje_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.whatsapp_conversaciones enable row level security;

create table if not exists public.whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.whatsapp_conversaciones(id) on delete cascade,
  rol text not null,
  contenido text not null,
  raw_payload jsonb,
  created_at timestamptz default now()
);
alter table public.whatsapp_mensajes enable row level security;

create table if not exists public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.whatsapp_flows enable row level security;

create policy "admin acceso total whatsapp_conversaciones"
  on public.whatsapp_conversaciones for all
  using (public.es_admin()) with check (public.es_admin());

create policy "vendedor ve sus conversaciones"
  on public.whatsapp_conversaciones for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = whatsapp_conversaciones.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor actualiza sus conversaciones"
  on public.whatsapp_conversaciones for update
  using (
    exists (
      select 1 from public.leads l
      where l.id = whatsapp_conversaciones.lead_id
        and l.asignado_a = auth.uid()
    )
  );

create policy "admin acceso total whatsapp_mensajes"
  on public.whatsapp_mensajes for all
  using (public.es_admin()) with check (public.es_admin());

create policy "vendedor ve sus mensajes"
  on public.whatsapp_mensajes for select
  using (
    exists (
      select 1 from public.whatsapp_conversaciones c
      join public.leads l on l.id = c.lead_id
      where c.id = whatsapp_mensajes.conversacion_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor inserta mensajes"
  on public.whatsapp_mensajes for insert
  with check (
    exists (
      select 1 from public.whatsapp_conversaciones c
      join public.leads l on l.id = c.lead_id
      where c.id = whatsapp_mensajes.conversacion_id
        and l.asignado_a = auth.uid()
    )
  );

create policy "admin acceso total whatsapp_flows"
  on public.whatsapp_flows for all
  using (public.es_admin()) with check (public.es_admin());

-- ========================
-- DOCUMENTOS (RAG / Base de conocimiento)
-- ========================
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  contenido text,
  created_at timestamptz default now()
);
alter table public.documentos enable row level security;

create policy "admin acceso total documentos"
  on public.documentos for all
  using (public.es_admin()) with check (public.es_admin());

create policy "vendedor ve documentos"
  on public.documentos for select
  using (auth.uid() is not null);
