// Solo PostgreSQL WASM en memoria. PGLITE_MODULE permite usar una instalación de QA.
// PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node tests/iniciar-whatsapp-sql.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite')
const db = new PGlite()
const actor = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const migration = readFileSync(new URL('../supabase/migration_v14_iniciar_whatsapp.sql',import.meta.url),'utf8')
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.profiles(id uuid primary key, rol text);
    create table public.leads(id uuid primary key default gen_random_uuid(), whatsapp text, asignado_a uuid, nombre text default 'Ana', stage text default 'nuevo_contacto');
    create table public.whatsapp_conversaciones(id uuid primary key default gen_random_uuid(), whatsapp text not null,
      lead_id uuid references leads(id), estado text default 'abierta', fase text default 'saludo',
      modo_humano boolean default false, humano_intervino boolean default false, tomado_por uuid,
      provider text, ultimo_mensaje_at timestamptz default now(), created_at timestamptz default now());
    create table public.whatsapp_mensajes(id uuid primary key default gen_random_uuid(), conversacion_id uuid references whatsapp_conversaciones(id),
      rol text not null, contenido text not null, raw_payload jsonb, created_at timestamptz default now());`)
  await db.exec(migration)
  await db.exec(migration) // Reejecutable, sin borrar intentos.
  const scalar = async (sql, params=[]) => (await db.query(sql,params)).rows[0]
  const lead = async phone => (await scalar('insert into leads(whatsapp,asignado_a) values ($1,$2) returning id',[phone,actor])).id
  const claim = async (id,phone,who=actor) => (await scalar('select reservar_inicio_whatsapp($1,$2,$3) result',[id,phone,who])).result
  const phone = '+525512345678', id = await lead('55 1234 5678')
  const results = await Promise.all([claim(id,phone),claim(id,phone),claim(id,phone)])
  assert.deepEqual(results.map(r=>r.status).sort(),['claimed','cooldown','cooldown'])
  const first = results.find(r=>r.status==='claimed')
  assert.equal((await scalar('select count(*)::int n from whatsapp_conversaciones')).n,1)
  assert.equal((await scalar('select count(*)::int n from whatsapp_mensajes')).n,1)
  const conv=await scalar('select * from whatsapp_conversaciones where id=$1',[first.conversacion_id])
  assert.equal(conv.lead_id,id); assert.equal(conv.whatsapp,phone)
  assert.equal(conv.modo_humano,true); assert.equal(conv.humano_intervino,true); assert.equal(conv.tomado_por,actor)
  assert.match((await scalar('select contenido from whatsapp_mensajes where id=$1',[first.mensaje_id])).contenido,/sin confirmar/)
  await db.query('select confirmar_inicio_whatsapp($1,$2,$3)',[first.mensaje_id,'Texto exacto','wamid.falso'])
  assert.equal((await scalar('select raw_payload from whatsapp_mensajes where id=$1',[first.mensaje_id])).raw_payload.meta_message_id,'wamid.falso')
  assert.equal((await claim(id,phone)).status,'cooldown')
  // <24 h bloqueado; >24 h reutiliza sin plantilla nueva ni cambiar takeover.
  await db.exec("update whatsapp_inicios set solicitado_at=now()-interval '23 hours 59 minutes'")
  assert.equal((await claim(id,phone)).status,'cooldown')
  await db.exec("update whatsapp_inicios set solicitado_at=now()-interval '24 hours 1 minute'")
  assert.equal((await claim(id,phone)).status,'existing')
  const duplicate = await lead('+5215512345678')
  assert.equal((await claim(duplicate,phone)).status,'conflict')
  const id2=await lead('+525599999999')
  await db.query(`insert into whatsapp_conversaciones(whatsapp,lead_id,modo_humano,humano_intervino,fase)
    values ('+5215599999999',null,false,true,'confirmado')`)
  await db.exec("insert into whatsapp_mensajes(conversacion_id,rol,contenido) select id,'usuario','Mensaje anterior' from whatsapp_conversaciones where whatsapp='+5215599999999'")
  assert.equal((await claim(id2,'+525599999999')).status,'existing')
  const preserved=await scalar('select * from whatsapp_conversaciones where lead_id=$1',[id2])
  assert.equal(preserved.modo_humano,false); assert.equal(preserved.humano_intervino,true); assert.equal(preserved.fase,'confirmado')
  await assert.rejects(()=>claim(id2,'+525500000000'),/teléfono cambió/)
  await assert.rejects(()=>claim(id2,'+525599999999',other),/Sin acceso/)
  await db.query("insert into profiles values ($1,'admin')",[other])
  assert.equal((await claim(id2,'+525599999999',other)).status,'existing')
  for(const role of ['anon','authenticated']) {
    const perms=await scalar(`select has_function_privilege($1,'reservar_inicio_whatsapp(uuid,text,uuid)','execute') reserve,
      has_function_privilege($1,'confirmar_inicio_whatsapp(uuid,text,text,text)','execute') finish`,[role])
    assert.equal(perms.reserve,false); assert.equal(perms.finish,false)
  }
  assert.equal((await scalar("select has_function_privilege('service_role','reservar_inicio_whatsapp(uuid,text,uuid)','execute') ok")).ok,true)
  const emptyId=await lead('+525588888888')
  const emptyConv=await scalar("insert into whatsapp_conversaciones(whatsapp,lead_id) values ('+525588888888',$1) returning id",[emptyId])
  const reused=await claim(emptyId,'+525588888888')
  assert.equal(reused.status,'claimed'); assert.equal(reused.conversacion_id,emptyConv.id)
  assert.equal((await claim(emptyId,'+525588888888')).status,'cooldown')
  assert.equal((await scalar('select count(*)::int n from whatsapp_mensajes')).n,3)
  const answer = async (phone,decision,context='wamid.falso',input='entrada') =>
    (await scalar('select resolver_respuesta_inicio_whatsapp($1,$2,$3,$4,$5) result',[phone,decision,context,input,decision==='si'?'Sí, me interesa':'Ahora no'])).result
  // El contexto de otra plantilla jamás habilita el bot.
  assert.equal((await answer(phone,'si','wamid.otro')).status,'ignored')
  assert.equal((await answer(phone,'si')).status,'processed')
  const active=await scalar('select * from whatsapp_conversaciones where id=$1',[first.conversacion_id])
  assert.equal(active.modo_humano,false); assert.equal(active.tomado_por,null)
  assert.equal(active.fase,'confirmar_precios'); assert.equal(active.humano_intervino,true)
  assert.equal((await answer(phone,'si')).status,'duplicate')
  const createInitiation = async (phone,extra={}) => {
    const id=await lead(phone)
    const c=await claim(id,phone)
    await db.query('select confirmar_inicio_whatsapp($1,$2,$3,$4)',[c.mensaje_id,'Texto de contacto','wamid.falso','primer_contacto_anax'])
    return {id,...c}
  }
  const negative=await createInitiation('+525577777777')
  assert.equal((await answer('+525577777777','no')).status,'processed')
  assert.equal((await scalar('select stage from leads where id=$1',[negative.id])).stage,'no_interesado')
  const closed=await scalar('select * from whatsapp_conversaciones where id=$1',[negative.conversacion_id])
  assert.equal(closed.estado,'cerrada'); assert.equal(closed.fase,'no_interesado'); assert.equal(closed.humano_intervino,true)
  assert.equal((await answer('+525577777777','no')).status,'duplicate')
  const protectedLead=await createInitiation('+525566666666')
  await db.query("insert into whatsapp_mensajes(conversacion_id,rol,contenido) values ($1,'agente','Asesor posterior')",[protectedLead.conversacion_id])
  assert.equal((await answer('+525566666666','si')).status,'protected')
  assert.equal((await scalar('select modo_humano from whatsapp_conversaciones where id=$1',[protectedLead.conversacion_id])).modo_humano,true)
  for(const stage of ['deposito_pendiente','reservado','hospedado','completado']) {
    await db.query('update leads set stage=$1 where id=$2',[stage,protectedLead.id])
    assert.equal((await answer('+525566666666','no')).status,'protected')
    assert.equal((await scalar('select stage from leads where id=$1',[protectedLead.id])).stage,stage)
  }
  const noName=await createInitiation('+525555555555')
  await db.query("update leads set nombre='' where id=$1",[noName.id])
  assert.equal((await answer('+525555555555','si')).status,'processed')
  assert.equal((await scalar('select fase from whatsapp_conversaciones where id=$1',[noName.conversacion_id])).fase,'nombre')
  const late=await createInitiation('+525544444444')
  await db.query("update whatsapp_inicios set solicitado_at=now()-interval '25 hours' where telefono='+525544444444'")
  assert.equal((await answer('+525544444444','si',null)).status,'ignored')
  assert.equal((await answer('+525544444444','si','wamid.falso')).status,'processed')
  await db.query('select confirmar_inicio_whatsapp($1,$2,$3,$4)',[late.mensaje_id,'Texto exacto','wamid.falso','custom_v2'])
  const finalized=await scalar('select raw_payload from whatsapp_mensajes where id=$1',[late.mensaje_id])
  assert.equal(finalized.raw_payload.template,'custom_v2'); assert.equal(finalized.raw_payload.respuesta,'si')
  for(const role of ['anon','authenticated']) {
    assert.equal((await scalar("select has_function_privilege($1,'resolver_respuesta_inicio_whatsapp(text,text,text,text,text)','execute') ok",[role])).ok,false)
  }
  assert.equal((await scalar("select count(*)::int n from whatsapp_mensajes where rol='usuario' and raw_payload->>'source'='respuesta_inicio_whatsapp'")).n,4)
  console.log('SQL v14 OK: reserva/24 h, plantilla efectiva, consentimiento Sí/Ahora no, contexto, duplicados, protección del asesor/reservas y permisos; base local en memoria.')
} finally { await db.close() }
