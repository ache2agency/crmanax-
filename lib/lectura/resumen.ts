import type { SupabaseClient } from '@supabase/supabase-js'
import { cdmx, textoLectura } from './servicio'

export type ConfigResumen = {
  crm: string; internos: string[]; leadSelect: string; etiquetas: Record<string, string>;
  etapas?: Record<string, string>; legacy?: Record<string, string>;
  calientes: string[]; finales: string[]; logros: string[]; archivados: string[]; calendario?: string;
}
type Lead = { id: string; whatsapp?: string; nombre?: string; curso?: string; loft_id?: string;
  stage?: string; created_at: string; paso_desde?: string; conversaciones?: { fase: string }[] }
type Conversacion = { id: string; whatsapp: string; fase: string; modo_humano: boolean;
  ultimo_mensaje_at: string; lead: Lead | null }
type Mensaje = { id: string; conversacion_id: string; rol: string; contenido: string; created_at: string;
  plantilla?: string; plantilla_motor?: string; envio_estado?: string }
type Actividad = { lead_id: string; event_type: string; created_at: string; destino?: string; lead: Lead }
export type DatosResumen = { conversaciones: Conversacion[]; mensajes: Mensaje[]; nuevos: Lead[]; actividades: Actividad[] }
const HORA = 3600_000
const normal = (s?: string | null) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const numero = (s = '') => s.replace(/\D/g, '')
const fecha = (s?: string | null) => s ? Date.parse(s) : NaN
const dia = (ms: number) => cdmx(new Date(ms).toISOString())!.slice(0, 10)
const limpio = (s?: string | null) => textoLectura(s ?? null)?.replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ').slice(0, 160) ?? null
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers })

// Patrones de evidencia, no clasificación con IA. El texto original nunca se devuelve.
const preguntas = [
  { tema: 'precio', pide: /precio|costo|cuanto|mensualidad/, dato: /\$\s*\d|\b\d[\d,.]*\s*(pesos|mxn|dolares)\b/ },
  { tema: 'promoción', pide: /promocion|promociones|\bpromo\b|descuento|beca/, dato: /\d\s*%|\$\s*\d|\b(sin|no hay|no tenemos|no aplica)\b.{0,35}(promocion|descuento|beca)/ },
  { tema: 'dirección', pide: /direccion|ubicacion|domicilio|donde (estan|queda|se ubica)/, dato: /\b(calle|av\.?|avenida|calzada|boulevard|blvd\.?|colonia|col\.)\s+\S+|\b(?:maps\.app\.goo\.gl|maps\.google\.|google\.[\w.]+\/maps)\b/ },
  { tema: 'horario', pide: /horario|a que hora/, dato: /\b\d{1,2}(:\d{2}|\s*(am|pm|a\.m\.|p\.m\.|hrs|horas))\b|\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b.{0,35}\d/ },
]
const intencion = /\b(quiero|quisiera|deseo|me interesa|voy a|como (puedo|hago para))\s+(?:ya\s+)?(?:inscribirme|inscribir|reservar|apartar)\b|\bme quiero inscribir\b/
const automatico = /gracias por (comunicarte|contactar|contactarnos|escribirnos).{0,30}\b(con|a)\b|mensaje automatico|horario de atencion/

// Calendario textual oficial; no se duplican fechas del negocio en el resumen.
export function proximoInicio(calendario: string | undefined, now: number) {
  if (!calendario) return null
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const fechas = [...normal(calendario).matchAll(/(\d{1,2}) de (\w+) de (\d{4})/g)].map(m =>
    `${m[3]}-${String(meses.indexOf(m[2]) + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`)
  return fechas.filter(f => f >= dia(now) && f <= dia(now + 48 * HORA)).sort()[0] ?? null
}

export function calcularResumen(datos: DatosResumen, config: ConfigResumen, now: number, horas: number, parcial: string[] = []) {
  const hoy = dia(now), ayer = dia(now - 24 * HORA), desde = now - horas * HORA
  const interno = (whatsapp: string) => config.internos.includes(numero(whatsapp))
  const elegibles = datos.conversaciones.filter(c => c.fase !== 'nota' && !interno(c.whatsapp))
  const ids = new Set(elegibles.map(c => c.id))
  const leadValido = (l: Lead) => !interno(l.whatsapp || '') && (!l.conversaciones?.length || l.conversaciones.some(c => c.fase !== 'nota'))
  const mensajes = datos.mensajes.filter(m => ids.has(m.conversacion_id) && fecha(m.created_at) <= now)
  const porChat = new Map<string, Mensaje[]>()
  for (const m of mensajes) {
    const rows = porChat.get(m.conversacion_id) || []; rows.push(m); porChat.set(m.conversacion_id, rows)
  }
  for (const rows of porChat.values()) rows.sort((a,b) => fecha(a.created_at)-fecha(b.created_at) || a.id.localeCompare(b.id))
  const actividades = datos.actividades.filter(a => a.lead && leadValido(a.lead) && fecha(a.created_at) <= now)
  const atenciones = []
  const porFase: Record<string, number> = {}, porEtapa: Record<string, number> = {}
  let abiertas = 0, humanos = 0, enPeriodo = 0
  const inicio = proximoInicio(config.calendario, now)
  for (const c of elegibles) {
    const rows = porChat.get(c.id) || []
    const usuarios = rows.filter(m => m.rol === 'usuario')
    const ultimo = usuarios.at(-1)
    const ultimaFecha = fecha(ultimo?.created_at)
    const ventana = ultimo && now - ultimaFecha < 24 * HORA
    if (ventana) {
      abiertas++
      const etiqueta = config.etiquetas[c.fase] || 'Otra fase'
      porFase[etiqueta] = (porFase[etiqueta] || 0) + 1
      if (config.etapas) {
        const stage = c.lead?.stage || 'nuevo_contacto'
        const etiquetaEtapa = config.etapas[config.legacy?.[stage] || stage] || 'Otra etapa'
        porEtapa[etiquetaEtapa] = (porEtapa[etiquetaEtapa] || 0) + 1
      }
    }
    if (c.modo_humano) humanos++
    if (fecha(c.ultimo_mensaje_at) >= desde) enPeriodo++
    const razones: { regla: string; motivo: string; accion_sugerida: string }[] = []
    const agregar = (regla: string, motivo: string, accion_sugerida: string) => razones.push({ regla, motivo, accion_sugerida })
    const esAutomatico = usuarios.some(m => fecha(m.created_at) >= desde && !/[¿?]/.test(m.contenido) && !/^(cual|que|como|me (puedes|podrias))\b/.test(normal(m.contenido)) && automatico.test(normal(m.contenido)))
    const terminal = config.finales.includes(c.fase) || config.finales.includes(c.lead?.stage || '')
    const intenciones = usuarios.filter(m => intencion.test(normal(m.contenido)) && !/\bno\s+(quiero|deseo|me interesa|voy a)\b/.test(normal(m.contenido)))
    const caliente = !terminal && (intenciones.length > 0 || config.calientes.includes(c.fase) || config.calientes.includes(c.lead?.stage || ''))
    if (esAutomatico) agregar('g', 'Posible mensaje automático de negocio; no es lead, sacar de seguimiento', 'Verificar que sea un negocio y retirar del seguimiento manualmente')
    else {
      const respuestas = rows.filter(m => ['bot','agente'].includes(m.rol) && fecha(m.created_at) >= ultimaFecha)
      // Una respuesta con el mismo timestamp se ordena por id; no se inventa su secuencia.
      const sinRespuesta = ultimo && !respuestas.length
      if (sinRespuesta && now - ultimaFecha > 15 * 60_000 && ultimaFecha >= desde) agregar('a', 'Último mensaje del lead sin respuesta por más de 15 minutos', 'Responder la pregunta pendiente desde el CRM')
      if (c.modo_humano && ultimo && ultimaFecha >= desde && !respuestas.some(m => m.rol === 'agente')) agregar('b', 'Modo humano sin respuesta de agente al último mensaje del lead', 'El asesor debe responder desde el CRM')
      const progreso = actividades.filter(a => a.lead_id === c.lead?.id && (a.event_type === 'stage_changed' || /inscripcion|reserva|documentos|ruta_paso/.test(a.event_type)))
      const ultimoAvance = Math.max(fecha(c.lead?.paso_desde) || 0, ...progreso.map(a => fecha(a.created_at)))
      const interesDesde = intenciones.length ? fecha(intenciones.at(-1)?.created_at) : fecha(c.lead?.created_at)
      if (caliente && Number.isFinite(interesDesde) && now - Math.max(interesDesde, ultimoAvance) >= 24 * HORA) agregar('c', 'Quiere inscribirse/reservar y no hay avance registrado en 24 horas', 'Confirmar el siguiente paso con el lead y registrar el avance')
      const faltantes = new Set<string>()
      const datosRespondidos = new Set<string>()
      let siguienteRol: string | null = null
      for (let i = rows.length - 1; i >= 0; i--) {
        const m = rows[i], contenido = normal(m.contenido)
        if (['bot','agente'].includes(m.rol)) {
          siguienteRol = m.rol
          for (const p of preguntas) if (p.dato.test(contenido)) datosRespondidos.add(p.tema)
        } else if (m.rol === 'usuario' && fecha(m.created_at) >= desde && siguienteRol === 'bot') {
          for (const p of preguntas) if (p.pide.test(contenido) && !datosRespondidos.has(p.tema)) faltantes.add(p.tema)
        }
      }
      if (faltantes.size) agregar('d', `Posible dato no respondido por el bot: ${[...faltantes].join(', ')}`, 'Revisar el historial y contestar con el dato confirmado')
      if (inicio && !terminal && /diplom/.test(normal(c.lead?.curso)) && !/individual/.test(normal(c.lead?.curso))) agregar('e', `Su diplomado grupal inicia el ${inicio} (en 2 días o menos)`, 'Confirmar grupo y ayudar a completar la inscripción')
      if (caliente && ventana && now - ultimaFecha > 21 * HORA) agregar('f', 'La ventana de 24 horas de un lead caliente cierra en menos de 3 horas', 'Atender antes del cierre de la ventana')
    }
    const ordenReglas = ['f','e','b','a','c','d','g']
    razones.sort((a,b) => ordenReglas.indexOf(a.regla)-ordenReglas.indexOf(b.regla))
    if (razones.length) atenciones.push({ whatsapp: /^\+?[1-9]\d{7,14}$/.test(c.whatsapp) ? '+' + numero(c.whatsapp) : '[número inválido]',
      nombre: limpio(c.lead?.nombre), programa_loft: limpio(c.lead?.curso || c.lead?.loft_id),
      fase: config.etiquetas[c.fase] || 'Otra fase', razones,
      prioridad: esAutomatico ? 3 : razones.some(r => r.regla === 'f' || r.regla === 'e') ? 0 : razones.some(r => r.regla === 'b' || r.regla === 'a') ? 1 : 2 })
  }
  atenciones.sort((a,b) => a.prioridad-b.prioridad || a.whatsapp.localeCompare(b.whatsapp))
  const eventosAyer = actividades.filter(a => dia(fecha(a.created_at)) === ayer)
  const logros = new Set(eventosAyer.filter(a => a.event_type === 'stage_changed' && config.logros.includes(a.destino || '')).map(a => a.lead_id))
  // Windsor guarda la fecha exacta del paso 17 aunque no exista actividad de cambio de etapa.
  for (const c of elegibles) if (c.lead?.stage === 'inscrito' && c.lead.paso_desde && dia(fecha(c.lead.paso_desde)) === ayer) logros.add(c.lead.id)
  const archivados = new Set(eventosAyer.filter(a => (a.event_type === 'stage_changed' && config.archivados.includes(a.destino || '')) || ['seguimiento_motor_archivado','sin_respuesta_48h'].includes(a.event_type)).map(a => a.lead_id))
  const plantillas = mensajes.filter(m => dia(fecha(m.created_at)) === ayer && ['agente','bot'].includes(m.rol)
    && ((m.plantilla && m.envio_estado === 'aceptado') || m.plantilla_motor || /\[Template:\s*[^\]]+\]/i.test(m.contenido))).length
  return { crm: config.crm, generado_at: cdmx(new Date(now).toISOString()), zona_horaria: 'America/Mexico_City', horas,
    totales: { ventana_24h: abiertas, conversaciones_en_periodo: enPeriodo, modo_humano: humanos,
      leads_nuevos_hoy: datos.nuevos.filter(l => leadValido(l) && dia(fecha(l.created_at)) === hoy).length,
      leads_nuevos_ayer: datos.nuevos.filter(l => leadValido(l) && dia(fecha(l.created_at)) === ayer).length },
    por_fase: porFase, ...(config.etapas ? { por_etapa: porEtapa } : {}), requieren_atencion: atenciones,
    ayer: { fecha: ayer, [config.crm === 'Windsor' ? 'inscritos' : 'reservas']: logros.size, archivados: archivados.size, plantillas_enviadas_detectadas: plantillas },
    parcial: parcial.length > 0, limites_alcanzados: parcial,
    advertencias: ['Fases: solo conversaciones con ventana de 24 h abierta. Modo humano: todas las conversaciones consultadas.',
      'Atención: indicios por reglas fijas; confirmar en el CRM. Sin avance: historial de hasta 7 días y fecha del paso cuando existe.',
      'Ayer: logros y archivos con evidencia de transición; no deducidos de la etapa actual. Reservas son cambios a Reservado, no cobros ni ocupación.',
      'Plantillas: mínimo detectado por marca o metadato de envío; algunos envíos guardan solo texto y no se pueden distinguir sin modificar el registro.'],
  }
}

export function resumenTexto(r: ReturnType<typeof calcularResumen>) {
  const t = r.totales
  const lines = [`${r.crm} · ${r.generado_at}`, `Ventana 24 h: ${t.ventana_24h} · Humano: ${t.modo_humano}`,
    `Nuevos hoy: ${t.leads_nuevos_hoy} · ayer: ${t.leads_nuevos_ayer}`,
    'Fases: ' + Object.entries(r.por_fase).map(([k,v]) => `${k} ${v}`).join(' · '),
    `Ayer: ${'inscritos' in r.ayer ? r.ayer.inscritos : r.ayer.reservas} ${r.crm === 'Windsor' ? 'inscritos' : 'reservas'} · ${r.ayer.archivados} archivados · ≥${r.ayer.plantillas_enviadas_detectadas} plantillas detectadas`,
    `Requieren atención (${r.requieren_atencion.length}; indicios, revisar CRM):`]
  if (r.por_etapa) lines.splice(4,0,'Etapas: ' + Object.entries(r.por_etapa).map(([k,v]) => `${k} ${v}`).join(' · '))
  const top = r.requieren_atencion.slice(0,20)
  for (const c of top) lines.push(`${c.whatsapp} · ${c.nombre || 'Sin nombre'} · ${c.programa_loft || 'Sin programa/loft'} · ${c.razones[0].motivo}${c.razones.length > 1 ? ` (+${c.razones.length-1} motivos en JSON)` : ''} → ${c.razones[0].accion_sugerida}`)
  if (top.length < r.requieren_atencion.length) lines.push(`+${r.requieren_atencion.length-top.length} casos más en formato JSON.`)
  if (r.parcial) lines.push(`PARCIAL: límite en ${r.limites_alcanzados.join(', ')}; los conteos pueden ser menores a los reales.`)
  lines.push('Ayer cuenta solo transiciones registradas; plantillas es un mínimo detectable.', 'Solo lectura · sin IA · fechas CDMX')
  return lines.join('\n') + '\n'
}

export function crearResumen(config: ConfigResumen) {
  return async (req: Request, client: () => SupabaseClient, now: number) => {
    const p = new URL(req.url).searchParams
    if ([...p.keys()].some(k => !['horas','formato'].includes(k)) || p.getAll('horas').length > 1 || p.getAll('formato').length > 1
      || (p.has('horas') && (!/^[1-9]\d{0,2}$/.test(p.get('horas')!) || Number(p.get('horas')) > 168))
      || (p.has('formato') && !['json','texto'].includes(p.get('formato')!))) return json({ error: 'Parámetros inválidos: horas 1–168, formato json|texto' },400)
    const horas = Number(p.get('horas') || 24)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    try {
      const db = client(), parcial: string[] = []
      const desdeAyer = dia(now - 24 * HORA) + 'T00:00:00-06:00'
      const desde = new Date(now - 168 * HORA).toISOString()
      // Páginas <=1000 para respetar max_rows de PostgREST. Un único presupuesto global.
      async function leer<T>(tabla: string, columnas: string, limite: number, filtro: (q: ReturnType<ReturnType<SupabaseClient['from']>['select']>) => ReturnType<ReturnType<SupabaseClient['from']>['select']>, ordenar = 'created_at') {
        const rows: T[] = []
        while (rows.length < limite) {
          const size = Math.min(1000, limite - rows.length)
          const q = filtro(db.from(tabla).select(columnas)).order(ordenar, { ascending: false }).order('id', { ascending: false })
          const result = await q.range(rows.length, rows.length+size-1).abortSignal(controller.signal)
          if (result.error) throw new Error('consulta')
          rows.push(...(result.data as unknown as T[]))
          if (result.data.length < size) return rows
        }
        parcial.push(tabla); return rows
      }
      const [conversaciones, mensajes, nuevos, actividades] = await Promise.all([
        leer<Conversacion>('whatsapp_conversaciones', `id,whatsapp,fase,modo_humano,ultimo_mensaje_at,lead:leads(${config.leadSelect})`, 500,
          q => {
            const base = q.or('fase.is.null,fase.neq.nota')
            const internos = config.internos.flatMap(n => [n, '+'+n])
            return internos.length ? base.not('whatsapp','in','('+internos.join(',')+')') : base
          }, 'ultimo_mensaje_at'),
        leer<Mensaje>('whatsapp_mensajes', 'id,conversacion_id,rol,contenido,created_at,plantilla:raw_payload->>template,plantilla_motor:raw_payload->seguimiento_motor->>templateName,envio_estado:raw_payload->>status', 5000,
          q => q.gte('created_at',desde).lte('created_at',new Date(now).toISOString())),
        leer<Lead>('leads','id,whatsapp,created_at,conversaciones:whatsapp_conversaciones(fase)',1000,
          q => q.gte('created_at',desdeAyer).lte('created_at',new Date(now).toISOString())),
        leer<Actividad>('lead_activities','lead_id,event_type,created_at,destino:meta->>to,lead:leads!inner(whatsapp,conversaciones:whatsapp_conversaciones(fase))',2000,
          q => q.gte('created_at',desde).lte('created_at',new Date(now).toISOString())),
      ])
      const resumen = calcularResumen({ conversaciones, mensajes, nuevos, actividades },config,now,horas,parcial)
      return p.get('formato') === 'texto' ? new Response(resumenTexto(resumen), { headers: { ...headers, 'Content-Type':'text/plain; charset=utf-8' } }) : json(resumen)
    } catch {
      // No registrar errores del proveedor, texto, números ni credenciales.
      return json({ error: controller.signal.aborted ? 'Tiempo de consulta agotado' : 'No se pudo consultar el resumen' },controller.signal.aborted ? 504 : 500)
    } finally { clearTimeout(timeout); controller.abort() }
  }
}
