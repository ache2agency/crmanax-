import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import * as runtime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
import {conversacionesConPendientes,conversacionDelLead} from '../lib/whatsapp/iniciar.js'

const lead={id:'lead-1',nombre:'Ana',whatsapp:'55 1234 5678',asignado_a:'asesor',valor:0}
function evaluate(source,mocks={},globals={}) {
 const exports={}
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 runInNewContext(js,{exports,...globals,require:k=>{assert.ok(k in mocks,`Importación sin mock: ${k}`);return mocks[k]}})
 return exports
}
function crmFunction(name,globals) {
 const text=readFileSync(new URL('../app/crm.jsx',import.meta.url),'utf8')
 const ast=ts.createSourceFile('crm.jsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX)
 let initializer
 function visit(node){if(ts.isVariableDeclaration(node) && node.name.getText(ast)===name)initializer=node.initializer.getText(ast);ts.forEachChild(node,visit)}
 visit(ast);assert.ok(initializer,`Función real ${name}`)
 return evaluate(`exports.call = ${initializer}`,{},globals).call
}
function component(path,react={}) {
 return evaluate(readFileSync(new URL(path,import.meta.url),'utf8'),{
  'react/jsx-runtime':runtime,
  react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{},memo:f=>f,forwardRef:f=>f,useImperativeHandle:()=>{},...react},
  '@/lib/anaxagoras/textos':{RESPUESTAS_RAPIDAS:[]},
 }).default
}
function nodes(tree) {
 if(Array.isArray(tree))return tree.flatMap(nodes)
 if(!tree || typeof tree!=='object')return []
 return [tree,...nodes(tree.props?.children)]
}
const html=tree=>renderToStaticMarkup(tree)

test('alta manual real inserta solo lead/actividad y aparece Sin iniciar sin llamar ningún envío',async()=>{
 const tables=[],activities=[];let saved=[]
 const addLead=crmFunction('addLead',{
  newLead:{...lead},currentUser:{id:'asesor'},normalizarWhatsapp:()=>'+525512345678',todayCST:()=> '2026-11-07',
  supabase:{from(table){tables.push(table);assert.equal(table,'leads');return {insert(values){return {async select(){return {data:[{...values[0],id:lead.id}]}}}}}}},
  setLeads:fn=>{saved=fn(saved)},logLeadActivity:async e=>activities.push(e),setShowForm:()=>{},setNewLead:()=>{},showToast:()=>{},
  fetch(){assert.fail('Registrar un lead nunca debe enviar WhatsApp ni llamar bienvenida/iniciar')},
 })
 await addLead();assert.deepEqual(tables,['leads']);assert.equal(activities.length,1);assert.equal(saved.length,1)
 const pending=conversacionesConPendientes([],saved);assert.equal(pending[0].fase,'sin_iniciar');assert.equal(pending[0].ultimo_mensaje_at,null)
 assert.equal(conversacionesConPendientes([],JSON.parse(JSON.stringify(saved)))[0].id,pending[0].id)
})

test('chat real por teléfono equivalente sustituye pendiente y no cambia registros originales',()=>{
 const real={id:'conv-real',whatsapp:'+5215512345678',lead_id:'otro',fase:'nombre'}
 const leads=[lead,{id:'sin-telefono',whatsapp:''}],convs=[real]
 const rows=conversacionesConPendientes(convs,leads)
 assert.equal(rows.length,2);assert.equal(rows[0].lead_id,'sin-telefono');assert.equal(rows[1],real)
 assert.equal(conversacionDelLead(convs,lead),real);assert.equal(convs.length,1);assert.equal(leads.length,2)
 assert.equal(rows.filter(r=>r.lead_id===lead.id).length,0)
})

test('Kanban muestra estado y botón; solo clic envía, detiene burbuja y respeta bloqueo/carga/teléfono',()=>{
 const Board=component('../components/crm/KanbanBoard.jsx');const calls=[]
 const props={STAGES:[{id:'nuevo_contacto',label:'Nuevo',color:'#123456',bg:'#fff'}],byStage:()=>[lead],formatPeso:()=>'',getNombreVendedor:()=>'',hasConversation:()=>false,iniciarWhatsApp:l=>calls.push(l)}
 const tree=Board(props);assert.match(html(tree),/Sin iniciar/);assert.match(html(tree),/Iniciar WhatsApp/);assert.equal(calls.length,0)
 const button=nodes(tree).find(n=>n.type==='button');let stopped=false;button.props.onClick({stopPropagation(){stopped=true}})
 assert.equal(calls[0],lead);assert.equal(stopped,true)
 assert.match(html(Board({...props,iniciandoWhatsApp:true})),/disabled=""/)
 assert.match(html(Board({...props,byStage:()=>[{...lead,whatsapp:''}]})),/disabled=""/)
 assert.doesNotMatch(html(Board({...props,conversacionesCargadas:false})),/Sin iniciar|Iniciar WhatsApp/)
 const existing=html(Board({...props,hasConversation:()=>true}));assert.match(existing,/Ver conversación/);assert.doesNotMatch(existing,/Sin iniciar|Iniciar WhatsApp/)
})

function panelProps(pending) {
 return {filteredWhatsConvs:[pending],conversationPhaseOptions:['todas','sin_iniciar'],getPhaseLabel:p=>p==='sin_iniciar'?'Sin iniciar':p,
  leads:[lead],leadsById:new Map([[lead.id,lead]]),vendedores:[],convMessages:[],STAGES:[],normalizeStage:x=>x,
  selectedConv:pending,selectedConvLead:lead,convModeFilter:'todos',convPhaseFilter:'todas',convSearch:''}
}
test('Conversaciones permite iniciar en fila/detalle sin envío al render, sin polling ni compositor/reactivación',async()=>{
 const effects=[],calls=[],pending=conversacionesConPendientes([],[lead])[0]
 const Panel=component('../components/crm/ConversationsPanel.jsx',{useEffect:fn=>effects.push(fn)})
 const props={...panelProps(pending),iniciarWhatsApp:l=>calls.push(l)}
 const tree=Panel(props),markup=html(tree)
 assert.match(markup,/Sin iniciar/);assert.equal((markup.match(/Iniciar WhatsApp/g)||[]).length,2)
 assert.doesNotMatch(markup,/Reactivar|>Tomar<|Escribe un mensaje|Sin mensajes registrados/);assert.equal(calls.length,0)
 // El efecto de polling de la conversación pendiente debe terminar sin timer.
 for(const effect of effects)effect()
 const buttons=nodes(tree).filter(n=>n.type==='button' && n.props.children==='Iniciar WhatsApp')
 buttons[0].props.onClick({stopPropagation(){}});buttons[1].props.onClick();assert.deepEqual(calls,[lead,lead])
 assert.match(html(Panel({...props,iniciandoWhatsApp:true})),/disabled=""/)
 assert.match(html(Panel({...props,selectedConvLead:{...lead,whatsapp:''},filteredWhatsConvs:[{...pending,whatsapp:''}]})),/Agrega el WhatsApp/)
})

test('seleccionar pendiente no consulta mensajes ni marca visto ni envía',async()=>{
 const pending=conversacionesConPendientes([],[lead])[0],selected=[]
 const Panel=component('../components/crm/ConversationsPanel.jsx')
 const tree=Panel({...panelProps(pending),selectedConv:null,setSelectedConv:c=>selected.push(c),confirmReturnToBotIfNeeded:async cb=>cb(),fetchConvMessages(){assert.fail('No consultar un id visual')},setConvVisto(){assert.fail('No marcar visto un pendiente')},iniciarWhatsApp(){assert.fail('Seleccionar no envía')}})
 const item=nodes(tree).find(n=>n.type==='div' && n.props.className?.startsWith('wa-item'))
 await item.props.onClick();assert.equal(selected[0],pending)
})

test('pendientes respetan búsqueda, fase, asignación y no se clasifican como BOT/Humano',()=>{
 const rows=conversacionesConPendientes([],[lead]),leadsById=new Map([[lead.id,lead]])
 const filter=extra=>crmFunction('filteredWhatsConvs',{useMemo:fn=>fn(),convsConPendientes:rows,leadsById,isAdmin:false,currentProfile:{id:'asesor'},convSearch:'',convModeFilter:'todos',convPhaseFilter:'todas',...extra})
 assert.equal(filter({}).length,1);assert.equal(filter({convSearch:'ana'}).length,1)
 assert.equal(filter({convSearch:'otro'}).length,0);assert.equal(filter({convPhaseFilter:'sin_iniciar'}).length,1)
 assert.equal(filter({convModeFilter:'bot'}).length,0);assert.equal(filter({convModeFilter:'humano'}).length,0)
 assert.equal(filter({currentProfile:{id:'otro'}}).length,0);assert.equal(filter({isAdmin:true,currentProfile:{id:'otro'}}).length,1)
})

test('handler compartido real envía solo tras confirmación de clic y bloquea doble clic',async()=>{
 let confirmed=false,requests=0,release
 const ref={current:false},busy=[]
 const start=crmFunction('iniciarWhatsApp',{
  iniciandoWhatsAppRef:ref,setIniciandoWhatsApp:v=>busy.push(v),window:{confirm:text=>{assert.equal(text,'Se enviará la plantilla de primer contacto a Ana (55 1234 5678). ¿Continuar?');return confirmed}},
  fetch:async(url,init)=>{requests++;assert.equal(url,'/api/whatsapp/iniciar');assert.equal(JSON.parse(init.body).lead_id,lead.id);await new Promise(r=>{release=r});return {ok:true,json:async()=>({conversacion_id:'real'})}},
  fetchWhatsConvs:async()=>[],showToast:()=>{},
 })
 assert.equal(requests,0);await start(lead);assert.equal(requests,0)
 confirmed=true;const first=start(lead);await start(lead);assert.equal(requests,1)
 release();await first;assert.deepEqual(busy,[true,false]);assert.equal(ref.current,false)
})
