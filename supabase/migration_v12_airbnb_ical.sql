-- Aplicar ANTES del código. No ejecutado por Codex.
begin;
alter table public.reservas drop constraint reservas_origen_check;
alter table public.reservas add constraint reservas_origen_check check (origen in ('excel', 'crm', 'motor', 'airbnb_ical'));
alter table public.reservas_sync add column if not exists origen text not null default 'excel';
alter table public.reservas_sync add column if not exists avisos jsonb not null default '[]'::jsonb;

create or replace function public.replace_airbnb_ical_reservas(p_loft_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- Serializar reemplazos del mismo loft. Todo el reemplazo es transaccional.
  perform pg_advisory_xact_lock(hashtextextended('airbnb_ical:' || p_loft_id::text, 0));
  if not exists (select 1 from public.lofts where id = p_loft_id and activo) then
    raise exception 'Loft inválido';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Bloqueos inválidos'; end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as x(fecha_checkin date, fecha_checkout date)
    where fecha_checkin is null or fecha_checkout is null or fecha_checkout <= fecha_checkin) then
    raise exception 'Fechas inválidas';
  end if;
  delete from public.reservas where origen = 'airbnb_ical' and loft_id = p_loft_id;
  insert into public.reservas (origen, canal, nombre_huesped, loft_id, tipo_renta, fecha_checkin, fecha_checkout, num_adultos)
    select 'airbnb_ical', 'airbnb', 'Bloqueado en Airbnb (sin detalle)', p_loft_id, 'dia', fecha_checkin, fecha_checkout, 0
    from jsonb_to_recordset(p_rows) as x(fecha_checkin date, fecha_checkout date);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.replace_airbnb_ical_reservas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_airbnb_ical_reservas(uuid, jsonb) to service_role;
commit;
