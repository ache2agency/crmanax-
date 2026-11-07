import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as iniciar from '../lib/whatsapp/iniciar.js'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { escenario } from './webhook-fixture.mjs'

const leadId = '11111111-1111-4111-8111-111111111111'
class MetaTemplateError extends Error { constructor(message,code,status=400) {super(message);this.code=code;this.status=status} }
function load(path, mocks, env = {}, globals = {}) {
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  runInNewContext(source, { exports, Response, process:{env}, ...globals, require(name) { assert.ok(name in mocks, `Mock obligatorio: ${name}`); return mocks[name] } })
  return exports
}
function endpoint(options = {}) {
  const calls = [], sent = []
  let claimed = false
  const db = { async rpc(name, args) {
    calls.push({ name, args })
    if (options.dbError) return { error: { message: 'sin migración' } }
    if (name === 'confirmar_inicio_whatsapp') return { error: options.finishError ? {} : null }
    if (options.status) return { data: { status: options.status, conversacion_id: 'conv' } }
    if (claimed) return { data: { status: 'cooldown', conversacion_id: 'conv' } }
    claimed = true
    return { data: { status: 'claimed', conversacion_id: 'conv', mensaje_id: 'msg' } }
  } }
  const session = { auth: { async getUser() { return { data: { user: options.unauthorized ? null : { id: 'user' } } } } }, from(table) {
    assert.equal(table, 'leads')
    const q = { select() { return q }, eq(k,v) { assert.equal(k,'id'); assert.equal(v,leadId); return q },
      async maybeSingle() { return { data: options.forbidden ? null : { id:leadId,nombre:'Ana',whatsapp:options.phone ?? '(55) 1234-5678' }, error: options.leadError ? {} : null } } }
    return q
  } }
  const route = load('../app/api/whatsapp/iniciar/route.ts', {
    '@/utils/supabase/server': { createClient: async () => session, createServiceRoleClient: () => db },
    '@/lib/whatsapp/iniciar': iniciar,
    '@/lib/whatsapp/provider': { MetaTemplateError, getWhatsAppProvider: () => options.provider || 'meta', async sendMetaWhatsAppTemplate(msg) {
      sent.push(msg)
      if (options.templateError && sent.length===1) throw new MetaTemplateError('Plantilla no disponible',options.templateError,options.templateHTTPStatus)
      if (options.sendError) throw Error('timeout')
      return { id: options.noId ? null : 'wamid.falso' }
    } },
  },options.env)
  return { calls, sent, async post(body = JSON.stringify({ lead_id: leadId })) {
    return route.POST(new Request('http://localhost/api/whatsapp/iniciar', { method:'POST', body }))
  } }
}

test('normaliza México local, internacional y legacy; rechaza vacío, texto y número incompleto', () => {
  for (const value of ['55 1234 5678', '+52 (55) 1234-5678', 'whatsapp:+5215512345678']) assert.equal(iniciar.normalizarTelefonoInicio(value), '+525512345678')
  assert.equal(iniciar.normalizarTelefonoInicio('+1 (212) 555-0100'), '+12125550100')
  for (const value of ['', null, '555', 'tel:5512345678', '+00000000000', '5512345678 ext 5']) assert.equal(iniciar.normalizarTelefonoInicio(value), null)
})
test('lookup por teléfono equivalente o lead, sin confundir números vacíos', () => {
  const c = { id:'conv', whatsapp:'+5215512345678' }
  assert.equal(iniciar.conversacionDelLead([c], { whatsapp:'55 1234 5678' }), c)
  assert.equal(iniciar.conversacionDelLead([{lead_id:'otro',whatsapp:null}], {id:leadId,whatsapp:null}), null)
})
test('sin sesión o sin acceso al lead: no reserva ni manda Meta', async () => {
  for (const [options,status] of [[{unauthorized:true},401],[{forbidden:true},404],[{leadError:true},503]]) {
    const e=endpoint(options); assert.equal((await e.post()).status,status); assert.equal(e.calls.length,0); assert.equal(e.sent.length,0)
  }
})
test('JSON, id, teléfono y proveedor inválidos no envían', async () => {
  for (const body of ['{','null','{}','{"lead_id":123}','{"lead_id":"no"}']) {
    const e=endpoint(); assert.equal((await e.post(body)).status,400); assert.equal(e.sent.length,0)
  }
  for (const options of [{phone:'123'},{phone:''},{provider:'twilio'}]) {
    const e=endpoint(options); assert.equal((await e.post()).status,400); assert.equal(e.calls.length,0)
  }
})
test('reserva antes de Meta, usa plantilla exacta y confirma historial con wamid', async () => {
  const e=endpoint(); const r=await e.post(); assert.equal(r.status,200)
  assert.equal(e.calls[0].name,'reservar_inicio_whatsapp'); assert.equal(e.calls[0].args.p_usuario,'user')
  assert.equal(e.sent[0].to,'+525512345678'); assert.equal(e.sent[0].templateName,'primer_contacto_anax')
  assert.deepEqual(Array.from(e.sent[0].parameters),['Ana'])
  assert.equal(e.calls[1].name,'confirmar_inicio_whatsapp'); assert.equal(e.calls[1].args.p_meta_id,'wamid.falso')
  assert.equal(e.calls[1].args.p_contenido,iniciar.textoPlantillaInicio('Ana'))
})
test('solicitudes concurrentes y repetición no envían dos veces (RPC mock atómico)', async () => {
  const e=endpoint(); const rs=await Promise.all([e.post(),e.post(),e.post()]); assert.deepEqual(rs.map(r=>r.status).sort(),[200,409,409]); assert.equal(e.sent.length,1)
})
test('conversación existente se reutiliza; cooldown y conflicto no llaman Meta', async () => {
  for (const [status,http] of [['existing',200],['cooldown',409],['conflict',409]]) {
    const e=endpoint({status}); assert.equal((await e.post()).status,http); assert.equal(e.sent.length,0)
  }
})
test('sin migración no envía; timeout o falta de wamid no confirman ni reintentan', async () => {
  const missing=endpoint({dbError:true}); assert.equal((await missing.post()).status,503); assert.equal(missing.sent.length,0)
  for (const options of [{sendError:true},{noId:true}]) {
    const e=endpoint(options); assert.equal((await e.post()).status,502); assert.equal((await e.post()).status,409)
    assert.equal(e.sent.length,1); assert.ok(e.calls.every(c=>c.name!=='confirmar_inicio_whatsapp'))
  }
})
test('Meta aceptó pero historial falló: avisa y no permite repetir', async () => {
  const e=endpoint({finishError:true}); const r=await e.post(); assert.equal(r.status,503); assert.match((await r.json()).error,/Meta aceptó/)
  assert.equal((await e.post()).status,409); assert.equal(e.sent.length,1)
})
test('ficha ofrece Iniciar solo sin conversación y bloquea mientras envía o sin número', () => {
  const {default:Modal}=load('../components/crm/LeadDetailModal.jsx',{
    'react/jsx-runtime':jsxRuntime, react:{useState:v=>[v,()=>{}],useRef:v=>({current:v})},
  })
  const props={lead:{id:leadId,nombre:'Ana',whatsapp:'+525512345678'},vendedores:[],lofts:[],STAGES:[],leadTimeline:[],getNombreVendedor:()=>'',getLeadNextStep:()=>''}
  const html=p=>renderToStaticMarkup(jsxRuntime.jsx(Modal,{...props,...p}))
  assert.match(html({}),/>Iniciar WhatsApp</)
  assert.doesNotMatch(html({activeConversation:{id:'conv'}}),/>Iniciar WhatsApp</)
  assert.match(html({iniciandoWhatsApp:true}),/disabled=""[^>]*>Iniciando/)
  assert.match(html({lead:{...props.lead,whatsapp:''}}),/disabled=""[^>]*>Iniciar WhatsApp/)
})
test('respuesta entrante del contacto iniciado respeta modo humano y conserva lead/chat', async () => {
  const s=escenario('esperando_asesor','+525512345678')
  Object.assign(s.db.whatsapp_conversaciones[0],{modo_humano:true,humano_intervino:true})
  await s.enviar('Sí, me interesa')
  assert.equal(s.db.leads.length,1); assert.equal(s.db.whatsapp_conversaciones.length,1)
  assert.equal(s.db.whatsapp_mensajes.at(-1).rol,'usuario'); assert.equal(s.respuestas().length,0)
})

test('al volver a BOT conserva la conversación y el lead con humano_intervino', async () => {
  const s=escenario('esperando_asesor','+525512345678')
  Object.assign(s.db.whatsapp_conversaciones[0],{modo_humano:false,humano_intervino:true})
  await s.enviar('¿Dónde están ubicados?')
  assert.equal(s.db.leads.length,1); assert.equal(s.db.whatsapp_conversaciones.length,1)
  assert.equal(s.db.whatsapp_conversaciones[0].lead_id,'lead')
  assert.equal(s.db.whatsapp_conversaciones[0].humano_intervino,true)
})


test('plantilla configurable y respaldo solo tras rechazo explícito 132001', async () => {
  const custom=endpoint({env:{META_TEMPLATE_PRIMER_CONTACTO:'  contacto_aprobado_v2  '}})
  assert.equal((await custom.post()).status,200); assert.equal(custom.sent[0].templateName,'contacto_aprobado_v2')
  assert.equal(custom.calls[1].args.p_template,'contacto_aprobado_v2')
  const fallback=endpoint({templateError:132001})
  assert.equal((await fallback.post()).status,200)
  assert.deepEqual(fallback.sent.map(s=>s.templateName),['primer_contacto_anax','seguimiento_solicitud_anax'])
  assert.equal(fallback.calls[1].args.p_template,'seguimiento_solicitud_anax')
  assert.match(fallback.calls[1].args.p_contenido,/fechas que nos compartiste/)
  assert.equal((await fallback.post()).status,409); assert.equal(fallback.sent.length,2)
  const backupOnly=endpoint({env:{META_TEMPLATE_PRIMER_CONTACTO:'seguimiento_solicitud_anax'},templateError:132001})
  assert.equal((await backupOnly.post()).status,502); assert.equal(backupOnly.sent.length,1)
  for(const options of [{templateError:132001,templateHTTPStatus:500},{templateError:190},{templateError:131000},{templateError:132012},{sendError:true},{noId:true}]) {
    const e=endpoint(options); assert.equal((await e.post()).status,502); assert.equal(e.sent.length,1)
  }
})
test('proveedor conserva código estructurado del rechazo de Meta', async () => {
  const provider=load('../lib/whatsapp/provider.ts',{}, {META_WHATSAPP_TOKEN:'falso',META_PHONE_NUMBER_ID:'falso'}, {
    fetch:async()=>Response.json({error:{code:132001,message:'Template does not exist'}},{status:400}),
  })
  await assert.rejects(()=>provider.sendMetaWhatsAppTemplate({to:'+525512345678',templateName:'ficticia'}),
    error=>error instanceof provider.MetaTemplateError && error.code===132001)
})
test('botones y texto exacto: interpreta consentimiento/negativa, no un sí genérico', () => {
  for(const [label,decision] of [['Sí, me interesa','si'],['Ahora no','no'],['Sí, envíame la info','si'],['Ya no, gracias','no']]) {
    for(const msg of [{type:'button',button:{text:label}},{type:'interactive',interactive:{button_reply:{title:label}}},{type:'text',text:{body:label}}]) {
      assert.equal(iniciar.respuestaPrimerContacto(msg).decision,decision)
    }
  }
  assert.equal(iniciar.respuestaPrimerContacto({type:'text',text:{body:'sí'}}),null)
})
test('webhook: Sí del primer contacto inicia precios del bot, Ahora no no manda mensajes', async () => {
  for(const [label,decision] of [['Sí, me interesa','si'],['Ahora no','no']]) {
    const calls=[]
    const s=escenario('esperando_asesor','+525512345678',{rpc:async(name,args,db)=>{
      calls.push({name,args})
      assert.equal(name,'resolver_respuesta_inicio_whatsapp'); assert.equal(args.p_decision,decision)
      return {data:{status:'processed',conversacion_id:'conv',nombre:'Ana'},error:null}
    }})
    Object.assign(s.db.whatsapp_conversaciones[0],{modo_humano:true,humano_intervino:true})
    await s.enviar(null,{id:'entrada',type:'button',button:{text:label},context:{id:'wamid.inicio'}})
    assert.equal(calls[0].args.p_contexto,'wamid.inicio'); assert.equal(calls[0].args.p_entrada_id,'entrada')
    assert.equal(s.db.leads.length,1); assert.equal(s.db.whatsapp_conversaciones.length,1)
    if(decision==='si') {assert.match(s.respuestas()[0].body,/Ana/);assert.match(s.respuestas()[0].body,/Tarifas|lofts/);assert.equal(s.db.whatsapp_mensajes.at(-1).rol,'bot')}
    else assert.equal(s.enviados.length,0)
  }
})
test('webhook: duplicado no envía; chat protegido conserva control y solo registra', async () => {
  for(const status of ['duplicate','protected']) {
    const s=escenario('esperando_asesor','+525512345678',{rpc:async()=>({data:{status,conversacion_id:'conv'},error:null})})
    Object.assign(s.db.whatsapp_conversaciones[0],{modo_humano:true,humano_intervino:true,tomado_por:'asesor'})
    await s.enviar(null,{type:'interactive',interactive:{button_reply:{title:'Sí, me interesa'}}})
    assert.equal(s.enviados.length,0); assert.equal(s.db.whatsapp_conversaciones[0].modo_humano,true)
    assert.equal(s.db.whatsapp_conversaciones[0].tomado_por,'asesor')
    assert.equal(s.db.whatsapp_mensajes.length,status==='protected'?1:0)
  }
})

test('después del consentimiento, el flujo normal pide fechas sin duplicar lead ni perder humano_intervino', async () => {
  for (const text of ['sí','si','sí!','Sí, claro']) {
  const s=escenario('confirmar_precios','+525512345678')
  Object.assign(s.db.whatsapp_conversaciones[0],{modo_humano:false,humano_intervino:true,tomado_por:null})
  await s.enviar(text)
  assert.equal(s.db.whatsapp_conversaciones[0].fase,'checkin')
  assert.match(s.respuestas().at(-1).body,/fecha|llegada/)
  assert.equal(s.db.leads.length,1); assert.equal(s.db.whatsapp_conversaciones.length,1)
  assert.equal(s.db.whatsapp_conversaciones[0].humano_intervino,true)
  }
})
