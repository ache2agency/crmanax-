-- ============================================================
-- MIGRACION v11 - Reservas solo lectura desde Excel + bitacora sync
-- Ejecutar despues de las migraciones existentes. No edita el Excel.
-- ============================================================

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  excel_control_no integer unique,
  origen text not null default 'excel',
  canal text not null default 'directo',
  nombre_huesped text not null,
  telefono text,
  email text,
  loft_id uuid references public.lofts(id) on delete set null,
  tipo_renta text not null,
  fecha_checkin date not null,
  fecha_checkout date not null,
  num_adultos integer default 1,
  monto numeric default 0,
  extras numeric default 0,
  lead_id uuid references public.leads(id) on delete set null,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reservas add column if not exists excel_control_no integer;
alter table public.reservas add column if not exists canal text;
alter table public.reservas add column if not exists origen text;
alter table public.reservas add column if not exists nombre_huesped text;
alter table public.reservas add column if not exists telefono text;
alter table public.reservas add column if not exists email text;
alter table public.reservas add column if not exists loft_id uuid references public.lofts(id) on delete set null;
alter table public.reservas add column if not exists tipo_renta text;
alter table public.reservas add column if not exists fecha_checkin date;
alter table public.reservas add column if not exists fecha_checkout date;
alter table public.reservas add column if not exists num_adultos integer default 1;
alter table public.reservas add column if not exists monto numeric default 0;
alter table public.reservas add column if not exists extras numeric default 0;
alter table public.reservas add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.reservas add column if not exists notas text;
alter table public.reservas add column if not exists created_at timestamptz default now();
alter table public.reservas add column if not exists updated_at timestamptz default now();

-- Si alguna prueba antigua de v10 uso origen=airbnb/directo, conservar ese dato como canal.
update public.reservas
set canal = origen
where canal is null
  and origen in ('airbnb', 'directo');

update public.reservas
set origen = 'excel'
where origen is null
   or origen in ('airbnb', 'directo');

update public.reservas set canal = 'directo' where canal is null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%origen%'
  loop
    execute format('alter table public.reservas drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.reservas
  alter column origen set default 'excel',
  alter column canal set default 'directo';

alter table public.reservas drop constraint if exists reservas_origen_check;
alter table public.reservas add constraint reservas_origen_check
  check (origen in ('excel', 'crm', 'motor'));

alter table public.reservas drop constraint if exists reservas_canal_check;
alter table public.reservas add constraint reservas_canal_check
  check (canal in ('airbnb', 'directo'));

alter table public.reservas drop constraint if exists reservas_tipo_renta_check;
alter table public.reservas add constraint reservas_tipo_renta_check
  check (tipo_renta in ('dia', 'mes'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and conname = 'reservas_excel_control_no_key'
  ) then
    alter table public.reservas
      add constraint reservas_excel_control_no_key unique (excel_control_no);
  end if;
end $$;

create index if not exists reservas_loft_fechas_idx
  on public.reservas (loft_id, fecha_checkin, fecha_checkout);

create index if not exists reservas_origen_idx
  on public.reservas (origen);

create table if not exists public.reservas_sync (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  rows_count integer default 0,
  error text,
  created_at timestamptz default now()
);

alter table public.reservas enable row level security;
alter table public.reservas_sync enable row level security;

drop policy if exists "usuarios autenticados ven reservas" on public.reservas;
create policy "usuarios autenticados ven reservas"
  on public.reservas for select
  using (auth.uid() is not null);

drop policy if exists "usuarios autenticados ven sync reservas" on public.reservas_sync;
create policy "usuarios autenticados ven sync reservas"
  on public.reservas_sync for select
  using (auth.uid() is not null);

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

create or replace function public.replace_excel_reservas(p_rows jsonb, p_sync_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  create temporary table tmp_excel_reservas (
    excel_control_no integer,
    origen text,
    canal text,
    nombre_huesped text,
    telefono text,
    email text,
    loft_id uuid,
    tipo_renta text,
    fecha_checkin date,
    fecha_checkout date,
    num_adultos integer,
    extras numeric,
    notas text
  ) on commit drop;

  insert into tmp_excel_reservas (
    excel_control_no, origen, canal, nombre_huesped, telefono, email, loft_id,
    tipo_renta, fecha_checkin, fecha_checkout, num_adultos, extras, notas
  )
  select
    excel_control_no, coalesce(origen, 'excel'), canal, nombre_huesped, telefono, email, loft_id,
    tipo_renta, fecha_checkin, fecha_checkout, coalesce(num_adultos, 1), coalesce(extras, 0), notas
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
    excel_control_no integer,
    origen text,
    canal text,
    nombre_huesped text,
    telefono text,
    email text,
    loft_id uuid,
    tipo_renta text,
    fecha_checkin date,
    fecha_checkout date,
    num_adultos integer,
    extras numeric,
    notas text
  );

  delete from public.reservas r
  where r.origen = 'excel'
    and (
      r.excel_control_no is null
      or not exists (
        select 1 from tmp_excel_reservas t
        where t.excel_control_no = r.excel_control_no
      )
    );

  insert into public.reservas (
    excel_control_no, origen, canal, nombre_huesped, telefono, email, loft_id,
    tipo_renta, fecha_checkin, fecha_checkout, num_adultos, extras, notas, updated_at
  )
  select
    excel_control_no, 'excel', canal, nombre_huesped, telefono, email, loft_id,
    tipo_renta, fecha_checkin, fecha_checkout, num_adultos, extras, notas, now()
  from tmp_excel_reservas
  where excel_control_no is not null
  on conflict (excel_control_no) do update set
    origen = 'excel',
    canal = excluded.canal,
    nombre_huesped = excluded.nombre_huesped,
    telefono = excluded.telefono,
    email = excluded.email,
    loft_id = excluded.loft_id,
    tipo_renta = excluded.tipo_renta,
    fecha_checkin = excluded.fecha_checkin,
    fecha_checkout = excluded.fecha_checkout,
    num_adultos = excluded.num_adultos,
    extras = excluded.extras,
    notas = excluded.notas,
    updated_at = now();

  get diagnostics affected_count = row_count;
  update public.reservas_sync
  set rows_count = (select count(*) from tmp_excel_reservas)
  where id = p_sync_id;

  return (select count(*) from tmp_excel_reservas);
end;
$$;
