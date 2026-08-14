-- ============================================================
-- MIGRACIÓN v10 — Tabla `reservas` (fuente de verdad de ocupación real)
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- No modifica leads ni el pipeline de ventas.
-- ============================================================

-- ========================
-- TABLA: RESERVAS
-- ========================
-- Representa ocupación real de un loft en un rango de fechas, sin importar
-- si vino de Airbnb o directo, y sin importar si pasó o no por el pipeline
-- de leads (las reservas de Airbnb nunca generan un lead).
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  excel_control_no integer unique,          -- columna A del Excel histórico, para dedupe del import
  origen text not null check (origen in ('airbnb', 'directo')),
  nombre_huesped text not null,
  telefono text,
  email text,
  loft_id uuid references public.lofts(id) on delete set null,
  tipo_renta text not null check (tipo_renta in ('dia', 'mes')),
  fecha_checkin date not null,
  fecha_checkout date not null,
  num_adultos integer default 1,
  monto numeric default 0,
  extras numeric default 0,
  lead_id uuid references public.leads(id) on delete set null,  -- si vino del bot/CRM
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reservas_loft_fechas_idx
  on public.reservas (loft_id, fecha_checkin, fecha_checkout);

alter table public.reservas enable row level security;

-- Cualquier usuario autenticado del CRM (admin o vendedor) necesita ver
-- toda la ocupación (no solo la de sus leads) para poder checar disponibilidad.
create policy "usuarios autenticados ven reservas"
  on public.reservas for select
  using (auth.uid() is not null);

create policy "usuarios autenticados capturan reservas"
  on public.reservas for insert
  with check (auth.uid() is not null);

create policy "usuarios autenticados actualizan reservas"
  on public.reservas for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "solo admin borra reservas"
  on public.reservas for delete
  using (public.es_admin());

-- ========================
-- CLASIFICACIÓN DE CAPACIDAD DE LOFTS (columna `tipo`, quedó vacía en v4)
-- ========================
-- Necesaria para poder filtrar disponibilidad por num_personas.
-- Fuente: pestaña "CONTEXTO PROYECTO" del Excel de reservaciones.
update public.lofts l set tipo = v.tipo
from (values
  ('PB-01', 'mediano'),
  ('PB-02', 'chico'),
  ('PB-03', 'mediano'),
  ('PB-04', 'grande'),
  ('1ER-11', 'grande'),
  ('1ER-12', 'chico'),
  ('1ER-13', 'mediano'),
  ('1ER-14', 'grande'),
  ('2DO-21', 'grande'),
  ('2DO-22', 'chico'),
  ('2DO-23', 'mediano'),
  ('2DO-24', 'grande')
) as v(nombre, tipo)
where l.nombre = v.nombre;
