'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { BusquedaEstancia, OpcionLoft } from '@/lib/motor-reservas'

const dinero = (v: number) => `$${v.toLocaleString('es-MX')}`
const fecha = (v: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}T12:00:00Z`))
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const siguiente = (v: string) => { const d = new Date(`${v}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const titulo = (tipo: string) => `Loft ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
type Resultado = { opciones: OpcionLoft[]; datosViejos: boolean; actualizado: string | null }

function Icon({ name, size = 20 }: { name: 'arrow' | 'people' | 'calendar' | 'pin' | 'check' | 'home'; size?: number }) {
  const paths = { arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>, people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0112 0v3M16 4a3 3 0 010 6M18 14a5 5 0 013 4v3" /></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M7 15h3" /></>, pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z" /><circle cx="12" cy="10" r="2.5" /></>, check: <path d="m5 12 4 4L19 6" />, home: <><path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8" /></> }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function MotorReservas() {
  const [paso, setPaso] = useState(1)
  const [entrada, setEntrada] = useState('')
  const [salida, setSalida] = useState('')
  const [personas, setPersonas] = useState(1)
  const [busqueda, setBusqueda] = useState<BusquedaEstancia | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [seleccion, setSeleccion] = useState<OpcionLoft | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [contacto, setContacto] = useState({ nombre: '', whatsapp: '', correo: '' })
  const contenido = useRef<HTMLElement>(null)
  const mover = (n: number) => { setPaso(n); setError(''); requestAnimationFrame(() => { contenido.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); contenido.current?.focus({ preventScroll: true }) }) }
  const noches = busqueda ? Math.round((Date.parse(busqueda.salida) - Date.parse(busqueda.entrada)) / 86400000) : 0

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (cargando) return
    setError(''); setCargando(true); setResultado(null); setSeleccion(null)
    const consulta = { entrada, salida, personas }
    try {
      const response = await fetch(`/api/motor-reservas?${new URLSearchParams({ entrada, salida, personas: String(personas) })}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos consultar la disponibilidad.')
      setBusqueda(consulta); setResultado(data); mover(2)
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar. Intenta de nuevo.') }
    finally { setCargando(false) }
  }

  function simular(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (contacto.nombre.trim().split(/\s+/).length < 2) { setError('Escribe tu nombre y apellido.'); return }
    if (contacto.whatsapp.replace(/\D/g, '').length < 10 || contacto.whatsapp.replace(/\D/g, '').length > 15) { setError('Revisa tu WhatsApp; incluye la clave de país y entre 10 y 15 dígitos.'); return }
    // Simulación local: sin fetch, almacenamiento, analítica ni envío de datos personales.
    setContacto({ nombre: '', whatsapp: '', correo: '' }); mover(4)
  }

  const resumen = seleccion && busqueda && <aside className="booking-summary">
    <img src={`/estancias/${seleccion.tipo}.jpg`} alt={`Interior de referencia del ${titulo(seleccion.tipo)}`} />
    <div className="summary-body"><span className="eyebrow">TU ESTANCIA</span><h3>{titulo(seleccion.tipo)} <small>{seleccion.nombre}</small></h3>
      <p className="subtle">Foto de referencia del tipo de loft.</p>
      <dl><div><dt>Entrada · 3:00 pm</dt><dd>{fecha(busqueda.entrada)}</dd></div><div><dt>Salida · 11:00 am</dt><dd>{fecha(busqueda.salida)}</dd></div><div><dt>Huéspedes</dt><dd>{busqueda.personas} {busqueda.personas === 1 ? 'persona' : 'personas'}</dd></div><div><dt>Duración</dt><dd>{noches} {noches === 1 ? 'noche' : 'noches'}</dd></div></dl>
      <div className="summary-total"><span>{seleccion.tipoRenta === 'mes' ? 'Tarifa mensual de referencia' : 'Hospedaje estimado'}<strong>{dinero(seleccion.estimado)} <small>MXN{seleccion.tipoRenta === 'mes' ? '/mes' : ''}</small></strong></span></div>
      <p className="subtle">{seleccion.tipoRenta === 'mes' ? 'Estancia de 28 noches o más. Alexis confirma el total para tus fechas; no se prorratea automáticamente.' : `${noches} ${noches === 1 ? 'noche' : 'noches'} × ${dinero(seleccion.noche)} MXN.`} No incluye impuestos. Depósito en garantía: {dinero(seleccion.tipoRenta === 'mes' ? 5000 : 649)} MXN {seleccion.tipoRenta === 'mes' ? '' : 'por reservación'}, adicional al hospedaje.</p>
    </div>
  </aside>

  return <div className="anax-booking">
    <div className="prototype-bar"><span className="prototype-dot" /> Prototipo para revisión <span className="prototype-detail">· Solicitudes simuladas, sin cobros</span></div>
    <header className="booking-header"><a href="/reservar" className="wordmark" aria-label="Anaxágoras 41, inicio">anaxágoras<span>41</span><small>CON ALMA DE HOGAR</small></a><span className="header-place"><Icon name="pin" size={16} /> Piedad Narvarte, CDMX</span><span className="header-note">Tu espacio en la ciudad</span></header>
    {paso === 1 && <section className="booking-hero"><div className="hero-copy"><span className="eyebrow">ANAXÁGORAS 41 · CIUDAD DE MÉXICO</span><h1>Un loft para ti.<br /><em>El tiempo que necesites.</em></h1><p>Por unos días o por un mes. Encuentra tu espacio amueblado en el corazón de la Narvarte.</p><div className="hero-tags"><span><Icon name="check" size={15} /> Servicios incluidos</span><span><Icon name="check" size={15} /> Cocina equipada</span></div></div><div className="hero-photo"><img src="/estancias/grande.jpg" alt="Loft amueblado de Anaxágoras 41, con cama, sala y cocina" /><span className="photo-caption">Espacios que se sienten como hogar.</span></div></section>}
    <main className={`booking-content ${paso === 1 ? 'first-step' : ''}`} ref={contenido} tabIndex={-1}>
      <nav className="booking-steps" aria-label="Progreso de la solicitud"><ol>{['Tu estancia', 'Elige tu loft', 'Tus datos'].map((label, i) => <li key={label} className={paso === i + 1 ? 'current' : paso > i + 1 ? 'complete' : ''} aria-current={paso === i + 1 ? 'step' : undefined}><span>{paso > i + 1 ? <Icon name="check" size={13} /> : `0${i + 1}`}</span>{label}</li>)}</ol></nav>
      {paso === 1 && <><div className="section-heading"><div><span className="eyebrow">EMPIEZA AQUÍ</span><h2>¿Cuándo te recibimos?</h2></div><p>Elige tus fechas y consulta los lofts disponibles.</p></div>
        <form className="search-form" onSubmit={buscar}><label><span><Icon name="calendar" size={16} /> Entrada</span><input aria-label="Fecha de entrada" type="date" required min={hoy()} value={entrada} onChange={e => { const v = e.target.value; setEntrada(v); if (salida && salida <= v) setSalida(siguiente(v)) }} /></label><label><span><Icon name="calendar" size={16} /> Salida</span><input aria-label="Fecha de salida" type="date" required min={entrada ? siguiente(entrada) : siguiente(hoy())} value={salida} onChange={e => setSalida(e.target.value)} /></label><label><span><Icon name="people" size={16} /> Huéspedes</span><select value={personas} onChange={e => setPersonas(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map(n => <option value={n} key={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}</select></label><button className="primary" disabled={cargando}>{cargando ? 'Consultando…' : 'Buscar lofts'}{!cargando && <Icon name="arrow" />}</button></form>
        <p className="search-caption">Entrada desde las 3:00 pm · Salida a las 11:00 am · Tarifas en MXN</p>
        <div className="stay-benefits"><div><Icon name="home" size={24} /><h3>Llega y siéntete en casa</h3><p>Lofts amueblados de 16, 24 y 32 m², con cocina y espacio para trabajar.</p></div><div><Icon name="check" size={24} /><h3>Lo esencial, incluido</h3><p>Agua, luz, gas, internet, limpieza semanal y cambio de blancos.</p></div><div><Icon name="pin" size={24} /><h3>Una ubicación para moverte</h3><p>Anaxágoras 41, Piedad Narvarte. Cerca de Parque Delta y Centro Médico.</p></div></div>
      </>}
      {paso === 2 && busqueda && resultado && <><button className="back-link" onClick={() => mover(1)}>← Cambiar fechas</button><div className="section-heading"><div><span className="eyebrow">ENCUENTRA TU ESPACIO</span><h1>{resultado.opciones.length ? 'Estos lofts te esperan.' : personas > 2 ? 'Busquemos una opción para tu grupo.' : 'Probemos con otras fechas.'}</h1></div><p>{fecha(busqueda.entrada)} → {fecha(busqueda.salida)}<br />{noches} noches · {busqueda.personas} {busqueda.personas === 1 ? 'persona' : 'personas'}</p></div>
        <div className={`availability-note ${resultado.datosViejos ? 'stale' : ''}`} role="status"><span className="status-dot" /><div><strong>{resultado.datosViejos ? 'Disponibilidad por confirmar' : `${resultado.opciones.length} ${resultado.opciones.length === 1 ? 'loft disponible' : 'lofts disponibles'} según el calendario`}</strong><p>{resultado.datosViejos ? 'La última sincronización tiene más de 2 horas o no se pudo verificar. Estas opciones requieren revisión de Alexis.' : 'Consulta del calendario de reservas. Un asesor confirma antes de apartar.'}{resultado.actualizado && <> Actualizado: {new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(resultado.actualizado))} (CDMX).</>}</p></div></div>
        {resultado.opciones.length === 0 ? <div className="empty-state"><Icon name="calendar" size={40} /><h3>{busqueda.personas > 2 ? 'Los lofts del catálogo alojan hasta 2 personas.' : 'No encontramos lofts libres para toda tu estancia.'}</h3><p>{busqueda.personas > 2 ? 'La capacidad y cualquier huésped adicional deben confirmarse con un asesor. Puedes explorar para 1 o 2 personas en este prototipo.' : 'Cambia las fechas para consultar otras opciones. No se ha creado ninguna solicitud.'}</p><button className="primary" onClick={() => mover(1)}>Ajustar búsqueda <Icon name="arrow" /></button></div> : <div className="loft-grid">{resultado.opciones.map(loft => <article className="loft-card" key={loft.id}><div className="loft-image"><img src={`/estancias/${loft.tipo}.jpg`} alt={`Interior de referencia del ${titulo(loft.tipo)}`} /><span>{loft.nombre}</span><small>Foto del tipo de loft</small></div><div className="loft-body"><div className="loft-title"><h2>{titulo(loft.tipo)}</h2><span>~{loft.metros} m²</span></div><p className="loft-capacity"><Icon name="people" size={17} /> Hasta {loft.capacidad} {loft.capacidad === 1 ? 'persona' : 'personas'} <span>· Cocina equipada</span></p><div className="loft-prices"><p><strong>{dinero(loft.noche)}</strong><span> MXN / noche</span></p><p>{dinero(loft.mes)} <span>MXN / mes · {busqueda.personas} {busqueda.personas === 1 ? 'persona' : 'personas'}</span></p></div><p className="loft-estimate">{loft.tipoRenta === 'mes' ? 'Tarifa mensual' : `Por ${noches} ${noches === 1 ? 'noche' : 'noches'}`}: <strong>{dinero(loft.estimado)} MXN{loft.tipoRenta === 'mes' ? '/mes' : ''}</strong><small>{loft.tipoRenta === 'mes' ? 'Total para tus fechas por confirmar.' : 'Hospedaje estimado; impuestos y depósito aparte.'}</small></p><button className="primary" onClick={() => { setSeleccion(loft); mover(3) }}>Elegir este loft <Icon name="arrow" /></button></div></article>)}</div>}
        <p className="conditions-note">Sin estacionamiento propio ni elevador. No se admiten mascotas. Las fotos corresponden a cada tipo de loft y pueden variar por unidad.</p>
      </>}
      {paso === 3 && seleccion && busqueda && <><button className="back-link" onClick={() => mover(2)}>← Ver otros lofts</button><div className="section-heading"><div><span className="eyebrow">UN PASO MÁS</span><h1>Hablemos de tu estancia.</h1><p>Déjanos tus datos para que un asesor confirme contigo.</p></div></div><div className="contact-layout"><form className="contact-form" onSubmit={simular}><h2>¿Cómo te contactamos?</h2><label>Nombre completo<input autoComplete="name" name="nombre" required minLength={3} maxLength={100} placeholder="Nombre y apellidos" value={contacto.nombre} onChange={e => setContacto({ ...contacto, nombre: e.target.value })} /></label><label>WhatsApp <span className="subtle">con clave de país</span><input autoComplete="tel" name="whatsapp" type="tel" required maxLength={22} placeholder="+52 55 1234 5678" value={contacto.whatsapp} onChange={e => setContacto({ ...contacto, whatsapp: e.target.value })} /></label><label>Correo electrónico<input autoComplete="email" name="correo" type="email" required maxLength={150} placeholder="tu@correo.com" value={contacto.correo} onChange={e => setContacto({ ...contacto, correo: e.target.value })} /></label><div className="simulation-note"><strong>Estás probando una demostración.</strong><p>Usa datos ficticios. Al continuar verás la confirmación de ejemplo; tus datos no se guardan ni se envían a un asesor.</p></div><button className="primary">Enviar solicitud <Icon name="arrow" /></button><p className="subtle">La selección no aparta el loft ni bloquea las fechas.</p></form>{resumen}</div></>}
      {paso === 4 && <div className="success-layout"><section className="success-panel"><span className="success-mark"><Icon name="check" size={34} /></span><span className="eyebrow">ASÍ SE VERÁ LA CONFIRMACIÓN</span><h1>Solicitud enviada,<br /><em>un asesor te confirma.</em></h1><p>En la versión final, el equipo revisará tu estancia y se pondrá en contacto contigo para confirmar disponibilidad y los siguientes pasos.</p><div className="simulation-note"><strong>Esta solicitud fue simulada.</strong><p>No se envió ningún mensaje, no se guardaron tus datos y las fechas siguen sin apartarse.</p></div><button className="primary" onClick={() => { setSeleccion(null); setResultado(null); setBusqueda(null); mover(1) }}>Explorar otra estancia <Icon name="arrow" /></button></section>{resumen}</div>}
      {error && <p className="booking-error" role="alert">{error}</p>}
    </main>
    <footer className="booking-footer"><div><strong>anaxágoras 41</strong><span>Con alma de hogar.</span></div><p>Anaxágoras 41, Piedad Narvarte<br />Benito Juárez, Ciudad de México</p><span className="footer-prototype">Vista previa · Motor de reservas</span></footer>
  </div>
}
