-- ============================================================
-- MIGRACIÓN v2 — Nuevo pipeline, lofts, mensajes programados
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- No modifica datos existentes, solo agrega columnas y tablas
-- ============================================================

-- ========================
-- FUNCIÓN HELPER (si no existe)
-- ========================
create or replace function public.es_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ========================
-- TABLA: LOFTS
-- ========================
create table if not exists public.lofts (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,              -- e.g. "Loft 04", "Loft 1ER13"
  tipo text not null default 'grande', -- grande | mediano | pequeño
  ical_airbnb_url text,              -- URL iCal exportada desde Airbnb
  activo boolean not null default true,
  created_at timestamptz default now()
);
alter table public.lofts enable row level security;

create policy "admin acceso total lofts"
  on public.lofts for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve lofts activos"
  on public.lofts for select
  using (auth.uid() is not null and activo = true);

-- ========================
-- NUEVOS CAMPOS EN LEADS
-- ========================
alter table public.leads
  add column if not exists tipo_renta text default 'noche',       -- 'noche' | 'mes'
  add column if not exists fecha_checkin date,
  add column if not exists fecha_checkout date,
  add column if not exists num_personas integer default 1,
  add column if not exists loft_id uuid references public.lofts(id) on delete set null,
  add column if not exists deposito_monto numeric default 0,
  add column if not exists deposito_pagado boolean default false,
  add column if not exists deposito_devuelto boolean default false,
  add column if not exists yale_email text,
  add column if not exists id_recibida boolean default false,
  add column if not exists docs_recibidos boolean default false;  -- solo renta mensual

-- Nota: el campo `stage` ya existe como text libre.
-- Nuevos valores del pipeline:
--   nuevo_contacto → cotizado → deposito_pendiente → reservado → hospedado → completado → no_interesado
-- Los leads existentes conservan su stage anterior sin cambios.

-- ========================
-- TABLA: MENSAJES PROGRAMADOS
-- ========================
create table if not exists public.mensajes_programados (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  parte integer not null,            -- 1 al 7 (+ 8 para devolución depósito)
  contenido text not null,
  programado_para timestamptz not null,
  enviado boolean not null default false,
  enviado_at timestamptz,
  created_at timestamptz default now()
);
alter table public.mensajes_programados enable row level security;

create index if not exists mensajes_programados_lead_idx
  on public.mensajes_programados (lead_id);

create index if not exists mensajes_programados_pendientes_idx
  on public.mensajes_programados (programado_para)
  where enviado = false;

create policy "admin acceso total mensajes_programados"
  on public.mensajes_programados for all
  using (public.es_admin())
  with check (public.es_admin());

create policy "vendedor ve mensajes de sus leads"
  on public.mensajes_programados for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = mensajes_programados.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor inserta mensajes de sus leads"
  on public.mensajes_programados for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = mensajes_programados.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

create policy "vendedor actualiza mensajes de sus leads"
  on public.mensajes_programados for update
  using (
    exists (
      select 1 from public.leads l
      where l.id = mensajes_programados.lead_id
        and (l.asignado_a = auth.uid() or public.es_admin())
    )
  );

-- ========================
-- DATOS INICIALES: LOFTS
-- ========================
insert into public.lofts (nombre, tipo) values
  ('Loft 04', 'grande'),
  ('Loft 11', 'grande'),
  ('Loft 14', 'grande'),
  ('Loft 21', 'grande'),
  ('Loft 24', 'grande'),
  ('Loft 03', 'mediano'),
  ('Loft 13', 'mediano')
on conflict do nothing;
