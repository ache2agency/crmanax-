-- Tarea 27. Solo archivo: aplicar antes de desplegar. No modifica filas existentes.
create or replace function public.telefono_inicio_whatsapp(p_valor text)
returns text language sql immutable strict set search_path = public as $$
  select case
    when length(d) = 10 and left(trim(p_valor), 1) <> '+' then '+52' || d
    when d ~ '^521[0-9]{10}$' then '+52' || substr(d, 4)
    when d ~ '^[1-9][0-9]{10,14}$' then '+' || d
    else null end
  from (select regexp_replace(p_valor, '[^0-9]', '', 'g') d) t;
$$;

create table if not exists public.whatsapp_inicios (
  telefono text primary key,
  solicitado_at timestamptz not null default now(),
  mensaje_id uuid not null references public.whatsapp_mensajes(id),
  estado text not null check (estado in ('pendiente', 'aceptado'))
);
alter table public.whatsapp_inicios enable row level security;
revoke all on public.whatsapp_inicios from anon, authenticated;

create or replace function public.reservar_inicio_whatsapp(p_lead_id uuid, p_telefono text, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.whatsapp_conversaciones%rowtype;
  intento public.whatsapp_inicios%rowtype;
  l public.leads%rowtype;
  mensaje uuid;
begin
  -- Serializa también leads duplicados que tienen el mismo teléfono.
  perform pg_advisory_xact_lock(hashtextextended(p_telefono, 27));
  select * into l from public.leads where id = p_lead_id for update;
  if not found or public.telefono_inicio_whatsapp(l.whatsapp) is distinct from p_telefono then
    raise exception 'El teléfono cambió; vuelve a cargar el prospecto';
  end if;
  if l.asignado_a is distinct from p_usuario and not exists (
    select 1 from public.profiles where id = p_usuario and rol = 'admin'
  ) then raise exception 'Sin acceso al prospecto'; end if;
  select * into intento from public.whatsapp_inicios where telefono = p_telefono;
  if found and intento.solicitado_at > now() - interval '24 hours' then
    return jsonb_build_object('status', 'cooldown', 'conversacion_id',
      (select conversacion_id from public.whatsapp_mensajes where id = intento.mensaje_id));
  end if;
  -- Nunca apropiarse del chat de otro lead ni duplicar una conversación del mismo lead.
  if exists (select 1 from public.whatsapp_conversaciones
    where public.telefono_inicio_whatsapp(whatsapp) = p_telefono
      and lead_id is not null and lead_id <> p_lead_id) then
    return jsonb_build_object('status', 'conflict');
  end if;
  select * into c from public.whatsapp_conversaciones
    where lead_id = p_lead_id or public.telefono_inicio_whatsapp(whatsapp) = p_telefono
    order by (estado = 'abierta') desc, created_at desc limit 1 for update;
  if found then
    if public.telefono_inicio_whatsapp(c.whatsapp) is distinct from p_telefono then
      return jsonb_build_object('status', 'conflict');
    end if;
    if c.lead_id is null then
      update public.whatsapp_conversaciones set lead_id = p_lead_id where id = c.id;
    end if;
    -- Un chat con historial se abre desde Conversaciones; no reactivarlo aquí.
    if exists (select 1 from public.whatsapp_mensajes where conversacion_id = c.id) then
      return jsonb_build_object('status', 'existing', 'conversacion_id', c.id);
    end if;
    update public.whatsapp_conversaciones set whatsapp = p_telefono, lead_id = p_lead_id,
      estado = 'abierta', fase = 'esperando_asesor', modo_humano = true, humano_intervino = true, tomado_por = p_usuario,
      provider = 'meta', ultimo_mensaje_at = now() where id = c.id;
  else
    insert into public.whatsapp_conversaciones
      (whatsapp, lead_id, estado, fase, modo_humano, humano_intervino, tomado_por, provider, ultimo_mensaje_at)
      values (p_telefono, p_lead_id, 'abierta', 'esperando_asesor', true, true, p_usuario, 'meta', now())
      returning * into c;
  end if;
  -- Registro previo: si la red falla, NO afirmar que fue enviado ni volver a mandarlo.
  insert into public.whatsapp_mensajes(conversacion_id, rol, contenido, raw_payload)
    values (c.id, 'agente', 'Inicio de WhatsApp solicitado; envío sin confirmar. Requiere revisión si no se actualiza.',
      jsonb_build_object('source', 'iniciar_whatsapp', 'status', 'pendiente', 'template', null))
    returning id into mensaje;
  insert into public.whatsapp_inicios(telefono, mensaje_id, estado, solicitado_at)
    values (p_telefono, mensaje, 'pendiente', now())
    on conflict (telefono) do update set mensaje_id = excluded.mensaje_id, estado = 'pendiente', solicitado_at = now();
  return jsonb_build_object('status', 'claimed', 'conversacion_id', c.id, 'mensaje_id', mensaje);
end;
$$;

create or replace function public.confirmar_inicio_whatsapp(p_mensaje_id uuid, p_contenido text, p_meta_id text, p_template text default 'primer_contacto_anax')
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.whatsapp_inicios set estado = 'aceptado' where mensaje_id = p_mensaje_id;
  if not found then raise exception 'Intento no encontrado'; end if;
  update public.whatsapp_mensajes set contenido = p_contenido,
    raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object('source', 'iniciar_whatsapp', 'status', 'aceptado',
      'template', p_template, 'meta_message_id', p_meta_id)
    where id = p_mensaje_id;
  if not found then raise exception 'Mensaje no encontrado'; end if;
end;
$$;
revoke all on function public.reservar_inicio_whatsapp(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.confirmar_inicio_whatsapp(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reservar_inicio_whatsapp(uuid, text, uuid) to service_role;
grant execute on function public.confirmar_inicio_whatsapp(uuid, text, text, text) to service_role;

-- Los botones actúan una sola vez y exclusivamente sobre su primer contacto.
create or replace function public.resolver_respuesta_inicio_whatsapp(
  p_telefono text, p_decision text, p_contexto text, p_entrada_id text, p_texto text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  intento public.whatsapp_inicios%rowtype;
  m public.whatsapp_mensajes%rowtype;
  c public.whatsapp_conversaciones%rowtype;
  l public.leads%rowtype;
begin
  if p_decision not in ('si', 'no') then return jsonb_build_object('status', 'ignored'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_telefono, 27));
  select * into intento from public.whatsapp_inicios where telefono = p_telefono;
  if not found then return jsonb_build_object('status', 'ignored'); end if;
  select * into m from public.whatsapp_mensajes where id = intento.mensaje_id for update;
  if m.raw_payload->>'source' is distinct from 'iniciar_whatsapp' then
    return jsonb_build_object('status', 'ignored');
  end if;
  if nullif(p_contexto, '') is not null then
    if m.raw_payload->>'meta_message_id' is distinct from p_contexto then
      return jsonb_build_object('status', 'ignored');
    end if;
  elsif intento.solicitado_at < now() - interval '24 hours' then
    return jsonb_build_object('status', 'ignored');
  end if;
  if m.raw_payload ? 'respuesta' then
    return jsonb_build_object('status', 'duplicate');
  end if;
  select * into c from public.whatsapp_conversaciones where id = m.conversacion_id for update;
  select * into l from public.leads where id = c.lead_id for update;
  if not found or l.stage in ('deposito_pendiente', 'reservado', 'hospedado', 'completado')
    or c.fase <> 'esperando_asesor'
    or exists (select 1 from public.whatsapp_mensajes
      where conversacion_id = c.id and rol = 'agente' and id <> m.id and created_at >= m.created_at) then
    return jsonb_build_object('status', 'protected', 'conversacion_id', c.id);
  end if;
  update public.whatsapp_mensajes set raw_payload = raw_payload ||
    jsonb_build_object('respuesta', p_decision, 'respuesta_id', p_entrada_id) where id = m.id;
  insert into public.whatsapp_mensajes(conversacion_id, rol, contenido, raw_payload)
    values (c.id, 'usuario', p_texto, jsonb_build_object('id', p_entrada_id, 'context', p_contexto,
      'source', 'respuesta_inicio_whatsapp'));
  if p_decision = 'no' then
    update public.leads set stage = 'no_interesado' where id = l.id;
    update public.whatsapp_conversaciones set estado = 'cerrada', fase = 'no_interesado',
      ultimo_mensaje_at = now() where id = c.id;
  else
    update public.whatsapp_conversaciones set estado = 'abierta', modo_humano = false,
      tomado_por = null, fase = case when nullif(trim(l.nombre), '') is null then 'nombre' else 'confirmar_precios' end,
      ultimo_mensaje_at = now() where id = c.id;
    -- humano_intervino conserva la historia. Solo se revierte el descarte explícito.
    if l.stage = 'no_interesado' then update public.leads set stage = 'nuevo_contacto' where id = l.id; end if;
  end if;
  return jsonb_build_object('status', 'processed', 'conversacion_id', c.id, 'nombre', l.nombre);
end;
$$;
revoke all on function public.resolver_respuesta_inicio_whatsapp(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.resolver_respuesta_inicio_whatsapp(text, text, text, text, text) to service_role;
