-- Solo archivo. Aplicar tras v12, antes del código 8-bis.
begin;
alter table public.reservas_sync add column if not exists feeds_ok jsonb not null default '[]'::jsonb;
create table public.reservas_fuentes (
  fuente_key text primary key,
  origen text not null check (origen in ('excel','airbnb_ical')),
  loft_id uuid references public.lofts(id),
  ultimo_exito_at timestamptz,
  ultimo_intento_at timestamptz,
  ultimo_intento_ok boolean not null default false
);
insert into public.reservas_fuentes(fuente_key, origen, ultimo_exito_at)
values ('excel', 'excel', (select max(finished_at) from public.reservas_sync where origen='excel' and status='success'));
insert into public.reservas_fuentes(fuente_key, origen, loft_id, ultimo_exito_at)
select 'airbnb_ical:'||id, 'airbnb_ical', id,
  (select max(finished_at) from public.reservas_sync where origen='airbnb_ical' and status='success')
from public.lofts where activo;

create table public.reservas_conflictos (
  id uuid primary key default gen_random_uuid(),
  loft_id uuid not null references public.lofts(id),
  tipo text not null check (tipo in ('doble_reserva_riesgo','traslape_excel','solo_airbnb')),
  fecha_inicio date not null,
  fecha_fin date not null check (fecha_fin > fecha_inicio),
  detalle text not null,
  primera_vez_at timestamptz not null,
  ultima_vez_at timestamptz not null,
  resuelto_at timestamptz
);
create index on public.reservas_conflictos(loft_id, tipo, resuelto_at);
-- Registro de intentos, no una cola con reenvíos: como máximo un intento por aviso.
create table public.reservas_avisos_push (
  clave text primary key,
  creado_at timestamptz not null,
  payload jsonb not null,
  reclamado_at timestamptz
);
alter table public.reservas_fuentes enable row level security;
alter table public.reservas_conflictos enable row level security;
alter table public.reservas_avisos_push enable row level security;
create policy "CRM lee frescura" on public.reservas_fuentes for select to authenticated using (auth.uid() is not null);
create policy "CRM lee conflictos" on public.reservas_conflictos for select to authenticated using (auth.uid() is not null);
revoke all on public.reservas_avisos_push from anon, authenticated;

create or replace function public.actualizar_monitor_reservas(p_estados jsonb, p_conflictos jsonb, p_lofts_evaluados uuid[], p_now timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare s record; c record; f record; cid uuid; vistos uuid[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtextextended('monitor_reservas',0));
  for s in select * from jsonb_to_recordset(p_estados) as x(fuente_key text, origen text, loft_id uuid, ok boolean) loop
    insert into public.reservas_fuentes(fuente_key, origen, loft_id, ultimo_exito_at, ultimo_intento_at, ultimo_intento_ok)
      values(s.fuente_key,s.origen,s.loft_id,case when s.ok then p_now end,p_now,s.ok)
    on conflict(fuente_key) do update set ultimo_intento_at=p_now, ultimo_intento_ok=s.ok,
      ultimo_exito_at=case when s.ok then p_now else reservas_fuentes.ultimo_exito_at end;
  end loop;
  for c in select * from jsonb_to_recordset(p_conflictos) as x(loft_id uuid,tipo text,fecha_inicio date,fecha_fin date,detalle text) loop
    if not c.loft_id = any(p_lofts_evaluados) then raise exception 'Loft no evaluado'; end if;
    select id into cid from public.reservas_conflictos r where r.loft_id=c.loft_id and r.tipo=c.tipo
      and not (r.id = any(vistos))
      and ((r.fecha_inicio=c.fecha_inicio and r.fecha_fin=c.fecha_fin)
        or (r.resuelto_at is null and r.fecha_inicio<c.fecha_fin and r.fecha_fin>c.fecha_inicio))
      order by r.primera_vez_at limit 1;
    if cid is null then
      insert into public.reservas_conflictos(loft_id,tipo,fecha_inicio,fecha_fin,detalle,primera_vez_at,ultima_vez_at)
        values(c.loft_id,c.tipo,c.fecha_inicio,c.fecha_fin,c.detalle,p_now,p_now) returning id into cid;
    else
      update public.reservas_conflictos set fecha_inicio=c.fecha_inicio,fecha_fin=c.fecha_fin,detalle=c.detalle,ultima_vez_at=p_now,resuelto_at=null where id=cid;
    end if;
    vistos := array_append(vistos,cid);
    if c.tipo <> 'solo_airbnb' then
      insert into public.reservas_avisos_push(clave,creado_at,payload)
      values('conflicto:'||cid,p_now,jsonb_build_object('title','Conflicto de disponibilidad','body',
        (select nombre from public.lofts where id=c.loft_id)||': '||c.fecha_inicio||' → '||c.fecha_fin||'. '||c.detalle,'url','/?vista=disponibilidad'))
      on conflict do nothing;
    end if;
  end loop;
  update public.reservas_conflictos set resuelto_at=p_now
    where resuelto_at is null and loft_id=any(p_lofts_evaluados) and not (id=any(vistos));
  insert into public.reservas_fuentes(fuente_key,origen) values('excel','excel') on conflict do nothing;
  insert into public.reservas_fuentes(fuente_key,origen,loft_id)
    select 'airbnb_ical:'||id,'airbnb_ical',id from public.lofts where activo on conflict do nothing;
  -- Aviso por episodio de falta de frescura, incluso sin éxito conocido.
  for f in select r.*, l.nombre from public.reservas_fuentes r left join public.lofts l on r.loft_id=l.id
    where (r.origen='excel' or l.activo) and (r.ultimo_exito_at is null or r.ultimo_exito_at < p_now-interval '2 hours') loop
    insert into public.reservas_avisos_push(clave,creado_at,payload)
    values('vieja:'||f.fuente_key||':'||coalesce(f.ultimo_exito_at::text,'sin-exito'),p_now,
      jsonb_build_object('title','Disponibilidad sin actualizar','body',coalesce(f.nombre,'Excel')||': sin sincronización exitosa en las últimas 2 h','url','/?vista=disponibilidad'))
    on conflict do nothing;
  end loop;
end $$;

create or replace function public.reclamar_avisos_reservas()
returns setof jsonb language sql security definer set search_path = public as $$
  update public.reservas_avisos_push set reclamado_at=now() where clave in (
    select clave from public.reservas_avisos_push where reclamado_at is null order by creado_at for update skip locked
  ) returning payload;
$$;
revoke all on function public.actualizar_monitor_reservas(jsonb,jsonb,uuid[],timestamptz) from public,anon,authenticated;
revoke all on function public.reclamar_avisos_reservas() from public,anon,authenticated;
grant execute on function public.actualizar_monitor_reservas(jsonb,jsonb,uuid[],timestamptz) to service_role;
grant execute on function public.reclamar_avisos_reservas() to service_role;
commit;
