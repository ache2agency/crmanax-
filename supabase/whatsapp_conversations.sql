-- Tablas para conversaciones de WhatsApp y flows de reglas simples

-- Conversaciones de WhatsApp
create table if not exists public.whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  lead_id uuid references public.leads(id) on delete set null,
  estado text not null default 'abierta', -- 'abierta' | 'cerrada'
  ultimo_mensaje_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Campos adicionales para orquestar el flujo y takeover humano
alter table public.whatsapp_conversaciones
  add column if not exists fase text not null default 'saludo', -- 'saludo' | 'datos' | 'info_programa' | 'seguimiento' | 'cerrado' | 'perdido' | 'otro'
  add column if not exists modo_humano boolean not null default false,
  add column if not exists tomado_por uuid references public.profiles(id);

alter table public.whatsapp_conversaciones enable row level security;

-- Mensajes dentro de una conversación
create table if not exists public.whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.whatsapp_conversaciones(id) on delete cascade,
  rol text not null,                -- 'usuario' | 'bot' | 'agente'
  contenido text not null,
  raw_payload jsonb,
  created_at timestamptz default now()
);

alter table public.whatsapp_mensajes enable row level security;

-- Flows / reglas configurables para WhatsApp
create table if not exists public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activo boolean default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.whatsapp_flows enable row level security;

-- Políticas RLS: admin acceso total (requiere función es_admin())

create policy "admin acceso total whatsapp_conversaciones"
  on public.whatsapp_conversaciones
  for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "admin acceso total whatsapp_mensajes"
  on public.whatsapp_mensajes
  for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "admin acceso total whatsapp_flows"
  on public.whatsapp_flows
  for all
  using (public.es_admin())
  with check (public.es_admin());

-- Políticas para vendedores: pueden ver conversaciones y mensajes
-- de leads asignados a ellos. Asumimos que leads.asignado_a guarda auth.uid().

create policy "vendedor ve sus conversaciones"
  on public.whatsapp_conversaciones
  for select using (
    exists (
      select 1
      from public.leads l
      where l.id = whatsapp_conversaciones.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor ve sus mensajes"
  on public.whatsapp_mensajes
  for select using (
    exists (
      select 1
      from public.whatsapp_conversaciones c
      join public.leads l on l.id = c.lead_id
      where c.id = whatsapp_mensajes.conversacion_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

-- Vendedores pueden actualizar conversaciones de sus leads (Tomar control / Volver a BOT)
create policy "vendedor actualiza sus conversaciones"
  on public.whatsapp_conversaciones
  for update
  using (
    exists (
      select 1
      from public.leads l
      where l.id = whatsapp_conversaciones.lead_id
        and l.asignado_a = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.leads l
      where l.id = whatsapp_conversaciones.lead_id
        and l.asignado_a = auth.uid()
    )
  );

-- Vendedores pueden insertar mensajes como agente en conversaciones de sus leads
create policy "vendedor inserta mensajes agente"
  on public.whatsapp_mensajes
  for insert
  with check (
    exists (
      select 1
      from public.whatsapp_conversaciones c
      join public.leads l on l.id = c.lead_id
      where c.id = whatsapp_mensajes.conversacion_id
        and l.asignado_a = auth.uid()
    )
  );

