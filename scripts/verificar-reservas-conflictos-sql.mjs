// PostgreSQL temporal, sin red ni secretos. Instalar PGlite fuera del repo y pasar PGLITE_MODULE.
// PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/verificar-reservas-conflictos-sql.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const migration = readFileSync(new URL('../supabase/migration_v13_reservas_conflictos.sql', import.meta.url), 'utf8')
const reversa = readFileSync(new URL('../supabase/migration_v13_reservas_conflictos_reversa.sql', import.meta.url), 'utf8')
const loft = '00000000-0000-0000-0000-000000000001'
const now = '2026-10-31T18:00:00Z'
const conflict = { loft_id: loft, tipo: 'doble_reserva_riesgo', fecha_inicio: '2026-12-05', fecha_fin: '2026-12-08', detalle: 'Bloquear en Airbnb' }
async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table lofts(id uuid primary key, nombre text, activo boolean);
    insert into lofts values('${loft}','PB-01',true);
    create table reservas_sync(origen text,status text,finished_at timestamptz);
    insert into reservas_sync values('excel','success','${now}'),('airbnb_ical','success','${now}');`)
  await db.exec(migration)
  return db
}
const estados = ok => [ { fuente_key:'excel', origen:'excel', loft_id:null, ok }, { fuente_key:`airbnb_ical:${loft}`, origen:'airbnb_ical', loft_id:loft, ok } ]
async function apply(db, conflicts = [], evaluated = [loft], time = now, sources = estados(true)) {
  await db.query('select actualizar_monitor_reservas($1::jsonb,$2::jsonb,$3::uuid[],$4::timestamptz)', [JSON.stringify(sources),JSON.stringify(conflicts),evaluated,time])
}
const count = async (db, table, where = '') => Number((await db.query(`select count(*) as n from ${table} ${where}`)).rows[0].n)

test('SQL: dos syncs, una push; rango que se recorta no renotifica; resuelto y reaparición sin spam', async () => {
  const db = await setup()
  try {
    await apply(db,[conflict]); await apply(db,[conflict])
    assert.equal(await count(db,'reservas_conflictos'),1)
    assert.equal(await count(db,'reservas_avisos_push'),1)
    assert.equal((await db.query('select * from reclamar_avisos_reservas()')).rows.length,1)
    assert.equal((await db.query('select * from reclamar_avisos_reservas()')).rows.length,0)
    await apply(db,[{ ...conflict, fecha_inicio:'2026-12-06' }])
    assert.equal(await count(db,'reservas_conflictos'),1)
    assert.equal(await count(db,'reservas_avisos_push'),1)
    await apply(db,[])
    assert.equal(await count(db,'reservas_conflictos','where resuelto_at is not null'),1)
    await apply(db,[{ ...conflict, fecha_inicio:'2026-12-06' }])
    assert.equal(await count(db,'reservas_conflictos','where resuelto_at is null'),1)
    assert.equal(await count(db,'reservas_avisos_push'),1)
  } finally { await db.close() }
})

test('SQL: feed caído o Excel caído no resuelve conflicto existente ni borra último éxito', async () => {
  const db = await setup()
  try {
    await apply(db,[conflict])
    await apply(db,[],[],'2026-10-31T18:30:00Z',estados(false))
    assert.equal(await count(db,'reservas_conflictos','where resuelto_at is null'),1)
    const state = (await db.query("select ultimo_exito_at,ultimo_intento_ok from reservas_fuentes where fuente_key='excel'")).rows[0]
    assert.equal(state.ultimo_intento_ok,false)
    assert.equal(new Date(state.ultimo_exito_at).toISOString(),'2026-10-31T18:00:00.000Z')
  } finally { await db.close() }
})

test('SQL: frescura >2h, una push por episodio/fuente, nueva alerta después de recuperación', async () => {
  const db = await setup()
  try {
    await apply(db,[],[], '2026-10-31T20:00:00Z',[])
    assert.equal(await count(db,'reservas_avisos_push'),0)
    await apply(db,[],[], '2026-10-31T20:00:01Z',[])
    assert.equal(await count(db,'reservas_avisos_push'),2)
    await apply(db,[],[], '2026-10-31T21:00:00Z',[])
    assert.equal(await count(db,'reservas_avisos_push'),2)
    await apply(db,[],[], '2026-10-31T21:00:00Z',estados(true))
    await apply(db,[],[], '2026-11-01T00:00:00Z',[])
    assert.equal(await count(db,'reservas_avisos_push'),4)
  } finally { await db.close() }
})

test('SQL: solo Airbnb no manda push; un rojo nuevo sí', async () => {
  const db = await setup()
  try {
    await apply(db,[{ ...conflict,tipo:'solo_airbnb',detalle:'Revisar preparación' }])
    assert.equal(await count(db,'reservas_avisos_push'),0)
    await apply(db,[conflict])
    assert.equal(await count(db,'reservas_avisos_push'),1)
    assert.equal(await count(db,'reservas_conflictos','where resuelto_at is not null'),1)
  } finally { await db.close() }
})

test('SQL: RLS y RPC impiden escritura/reclamo de avisos desde anon/autenticado', async () => {
  const db = await setup()
  try {
    await db.exec('set role authenticated')
    await assert.rejects(db.query('select * from reclamar_avisos_reservas()'), /permission denied/)
    await assert.rejects(db.query("select actualizar_monitor_reservas('[]','[]','{}',now())"), /permission denied/)
    await assert.rejects(db.query('insert into reservas_conflictos default values'), /permission denied/)
    await db.exec('reset role')
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from reservas_avisos_push'), /permission denied/)
  } finally { await db.close() }
})

test('SQL: reversa conserva tablas y datos para auditoría', async () => {
  const db = await setup()
  try {
    await apply(db,[conflict])
    await db.exec(reversa)
    assert.equal(await count(db,'reservas_conflictos_respaldo_v13'),1)
    assert.equal(await count(db,'reservas_avisos_push_respaldo_v13'),1)
    assert.equal(await count(db,'reservas_fuentes_respaldo_v13'),2)
  } finally { await db.close() }
})
