/**
 * Reestructuración de la BASE (RAG)
 *
 * 1. Elimina todos los documentos actuales
 * 2. Sube documentos limpios, uno por programa
 *
 * Uso: node scripts/restructure-base.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Lee .env.local desde la raíz del proyecto
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const env = {}
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
  })
} catch {}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error('Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  process.exit(1)
}

// ─── DOCUMENTOS LIMPIOS ──────────────────────────────────────────────────────

const DOCUMENTOS = [

  // ── LICENCIATURAS ──────────────────────────────────────────────────────────

  {
    titulo: 'Licenciatura en Psicología — Instituto Windsor',
    contenido: `LICENCIATURA EN PSICOLOGÍA — Instituto Windsor

Modalidad: Presencial
Duración: 3 años
Horarios: Matutino y Sabatino

Costos:
- Inscripción semestral: $2,300 (incluye credencial)
- Colegiatura mensual: $2,750

Campo laboral: Salud, educación, medio ambiente, producción, consumo, convivencia social.

Plan de estudios: https://drive.google.com/file/d/1mw16jhbwN3K2dBy3ajcb3qREOPVXZ9rb/view?usp=drivesdk`
  },

  {
    titulo: 'Licenciatura en Inglés (presencial) — Instituto Windsor',
    contenido: `LICENCIATURA EN INGLÉS PRESENCIAL — Instituto Windsor

Modalidad: Presencial
Duración: 3 años
Horarios: Matutino, Vespertino y Sabatino

Costos:
- Inscripción semestral: $2,150 (incluye credencial)
- Colegiatura mensual: $2,650

Campo laboral: Docente, traductor, diseñador de programas de enseñanza del inglés, representante editorial, asesor en call centers, centros de investigación y organismos internacionales.

Plan de estudios: https://drive.google.com/file/d/1M_K1sIqh-8LgZdTsiAmIRMOkVIiTw295/view?usp=drivesdk`
  },

  {
    titulo: 'Licenciatura en Inglés (online / en línea) — Instituto Windsor',
    contenido: `LICENCIATURA EN INGLÉS ONLINE — Instituto Windsor

Modalidad: Online (en línea)
Duración: 3 años
Horarios: Online

Costos:
- Inscripción semestral: $2,150 (incluye credencial)
- Colegiatura mensual: $2,650

Reconocimiento de Validez Oficial de Estudios (RVOE): SEG 130.00.01.01.00.02/028

Campo laboral: Docente, traductor, diseñador de programas de enseñanza del inglés, representante editorial, asesor en call centers, centros de investigación y organismos internacionales.

Plan de estudios: https://drive.google.com/file/d/1wy4BiHspFFBZ3d1dBfO0ki-koDhR3MNg/view?usp=drivesdk`
  },

  {
    titulo: 'Licenciatura en Administración Turística (presencial) — Instituto Windsor',
    contenido: `LICENCIATURA EN ADMINISTRACIÓN TURÍSTICA PRESENCIAL — Instituto Windsor

Modalidad: Presencial
Duración: 3 años
Horarios: Matutino, Vespertino y Sabatino

Costos:
- Inscripción semestral: $2,200 (incluye credencial)
- Colegiatura mensual: $2,650

Campo laboral: Agencias de viajes, compañías de transporte turístico, hoteles y resorts, operadores turísticos, organizaciones de eventos y convenciones, empresas de marketing turístico, emprendimiento propio.

Plan de estudios: https://drive.google.com/file/d/1FMFbZ4pupnqkD_X1pBUcxlVo0HmRxUPb/view?usp=drivesdk`
  },

  {
    titulo: 'Licenciatura en Administración Turística (online / en línea) — Instituto Windsor',
    contenido: `LICENCIATURA EN ADMINISTRACIÓN TURÍSTICA ONLINE — Instituto Windsor

Modalidad: Online (en línea)
Duración: 3 años
Horarios: Online

Costos:
- Inscripción semestral: $2,200 (incluye credencial)
- Colegiatura mensual: $2,650

Reconocimiento de Validez Oficial de Estudios (RVOE): SEG/0001/2007

Campo laboral: Agencias de viajes, compañías de transporte turístico, hoteles y resorts, operadores turísticos, organizaciones de eventos y convenciones, empresas de marketing turístico, emprendimiento propio.

Plan de estudios: https://drive.google.com/file/d/1JEhS0iVIkATLicd6wqGqUXcHyB_lzT4C/view`
  },

  {
    titulo: 'Licenciatura en Relaciones Públicas y Mercadotecnia (presencial) — Instituto Windsor',
    contenido: `LICENCIATURA EN RELACIONES PÚBLICAS Y MERCADOTECNIA PRESENCIAL — Instituto Windsor

Modalidad: Presencial
Duración: 3 años
Horarios: Matutino, Vespertino y Sabatino

Costos:
- Inscripción semestral: $2,300 (incluye credencial)
- Colegiatura mensual: $2,750

Incluye tres certificaciones adicionales: Marketing digital y social media, creación de páginas web, diseño gráfico.

Reconocimiento de Validez Oficial de Estudios (RVOE): SEG/00052/2002

Campo laboral: Agencias de publicidad, departamentos de marketing, consultorías de relaciones públicas, medios de comunicación, organizaciones sin fines de lucro, empresas gubernamentales, tecnología y entretenimiento, emprendimiento propio.

Plan de estudios: https://drive.google.com/file/d/1tv2023m30ZVHJRryfwhNm6tT9wICHvnZ/view?usp=drivesdk`
  },

  {
    titulo: 'Licenciatura en Relaciones Públicas y Mercadotecnia (online / en línea) — Instituto Windsor',
    contenido: `LICENCIATURA EN RELACIONES PÚBLICAS Y MERCADOTECNIA ONLINE — Instituto Windsor

Modalidad: Online (en línea)
Duración: 3 años
Horarios: Online

Costos:
- Inscripción semestral: $2,300 (incluye credencial)
- Colegiatura mensual: $2,750

Incluye tres certificaciones adicionales: Marketing digital y social media, creación de páginas web, diseño gráfico.

Reconocimiento de Validez Oficial de Estudios (RVOE): SEG/00052/2002

Campo laboral: Agencias de publicidad, departamentos de marketing, consultorías de relaciones públicas, medios de comunicación, organizaciones sin fines de lucro, empresas gubernamentales, tecnología y entretenimiento, emprendimiento propio.

Plan de estudios: https://drive.google.com/file/d/18VDNvOjsG39KdHr31VxfYHlJJC83TKgt/view?usp=share_link`
  },

  // ── MAESTRÍAS ──────────────────────────────────────────────────────────────

  {
    titulo: 'Maestrías — Instituto Windsor',
    contenido: `MAESTRÍAS — Instituto Windsor

Instituto Windsor ofrece las siguientes maestrías:

1. Maestría en Innovación Empresarial
2. Maestría en Multiculturalidad y Plurilingüismo

Para información de costos, horarios y plan de estudios, comuníquese directamente con un asesor.`
  },

  // ── BACHILLERATO ───────────────────────────────────────────────────────────

  {
    titulo: 'Bachillerato (Prepa Windsor) — Instituto Windsor',
    contenido: `BACHILLERATO — Prepa Windsor

Modalidad: Presencial
Duración: 2 años
Horarios: Matutino y Vespertino

Costos:
- Inscripción cuatrimestral: $1,100 (incluye credencial)
- Colegiatura mensual: $1,800

Plan de estudios: https://drive.google.com/file/d/1txVAaLEpi-WPTybWtSKKMu3mn6fC5TkK/view?usp=drivesdk`
  },

  // ── CURSOS DE IDIOMAS ──────────────────────────────────────────────────────

  {
    titulo: 'Cursos de Inglés para adultos — Instituto Windsor',
    contenido: `CURSOS DE INGLÉS PARA ADULTOS — Instituto Windsor

Dirigido a: Personas de 13 años en adelante interesadas en aprender inglés.
Modalidad: Presencial y Online
Documento que se obtiene: Diploma con validez oficial

HORARIOS PRESENCIALES:
- Matutino: 10:00 - 12:00 hrs
- Vespertino: 17:00 - 19:00 hrs
- Sabatino: 09:00 - 13:00 hrs

HORARIOS ONLINE:
- Vespertino: 17:00 - 19:00 hrs
- Sabatino: 09:00 - 13:00 hrs

Duración por horario:
- Matutino, vespertino, online: 5 meses
- Sabatino: 10 meses

Costos:
- Inscripción: $750
- Mensualidad (horario matutino/vespertino presencial u online):
  - Niveles Básico, Elemental y Pre-Intermedio: $1,070
  - Intermedio Avanzado en adelante: $1,190
- Mensualidad (horario sabatino):
  - Niveles Básico, Elemental y Pre-Intermedio: $990
  - Intermedio Avanzado en adelante: $1,010

Material: Libro de gramática y libro del nivel correspondiente. Costo aproximado del material: $900 (varía según la editorial).`
  },

  {
    titulo: 'Cursos de Inglés para niños — Instituto Windsor',
    contenido: `CURSOS DE INGLÉS PARA NIÑOS — Instituto Windsor

Dirigido a: Niños de 4 a 12 años interesados en aprender inglés.
Modalidad: Presencial y Online
Documento que se obtiene: Diploma con validez oficial

HORARIOS PRESENCIALES:
- Martes a jueves: 13:00 - 14:00 hrs o 17:00 - 18:00 hrs
- Sabatino: 09:00 - 13:00 hrs

HORARIOS ONLINE:
- Lunes a jueves: 17:00 - 18:00 hrs
- Sabatino: 09:00 - 13:00 hrs

Duración: 5 meses

Costos:
- Inscripción: $800
- Mensualidad: $780

Material: Libro del nivel correspondiente. Costo aproximado: $700 (varía según la editorial).`
  },

  {
    titulo: 'Cursos de Francés e Italiano — Instituto Windsor',
    contenido: `CURSOS DE FRANCÉS E ITALIANO — Instituto Windsor

Instituto Windsor ofrece cursos de Francés e Italiano.

Para información de horarios, costos y disponibilidad, comuníquese directamente con un asesor.`
  },

  // ── DIPLOMADOS ─────────────────────────────────────────────────────────────

  {
    titulo: 'Diplomados — Instituto Windsor',
    contenido: `DIPLOMADOS — Instituto Windsor

Instituto Windsor ofrece los siguientes diplomados:

- Administración de Instituciones de la Salud
- Administración de Recursos Humanos
- Administración de Restaurantes
- Análisis y Evaluación de Políticas Públicas
- Comunicación y Liderazgo en el Sector Público
- Comunicación y Liderazgo Empresarial
- Competencias Educativas
- Comunicación y Gobierno Digital
- Contabilidad
- Creación y Dirección de Franquicias
- Ciencias del Deporte
- Enfermería
- Epidemiología
- Equidad de Género y Diversidad Sexual
- Farmacología
- Gamificación Educativa
- Gerontología
- Innovación y Gobierno Digital
- Mindfulness
- Nutrición Deportiva
- Nutrición y Dietética
- Políticas y Procesos de Participación Ciudadana
- Psicología Criminológica
- Psicología Educativa
- Realidad Virtual
- Salud Pública
- Tecnología Educativa
- Terapia Ocupacional
- Tanatología
- Enseñanza del Idioma Inglés
- Enseñanza del Idioma Español

Para información de costos, fechas de inicio y horarios, comuníquese directamente con un asesor.`
  },

  // ── PROMOCIONES ────────────────────────────────────────────────────────────

  {
    titulo: 'Promociones vigentes — Instituto Windsor',
    contenido: `PROMOCIONES VIGENTES — Instituto Windsor

LICENCIATURAS (Inglés, Psicología, Turismo, Relaciones Públicas y Mercadotecnia):
- Inscripción: 50% de descuento
- Mensualidad: 30% de descuento

CURSOS LIBRES DE IDIOMAS (Inglés adultos, Inglés niños):
- Inscripción: 50% de descuento
- Primer mes: GRATIS

BACHILLERATO (Prepa Windsor):
- Inscripción: 50% de descuento
- Mensualidad: 20% de descuento

Nota: Las promociones están sujetas a cambios. Consultar vigencia con un asesor.`
  },

  // ── PROCESO DE INSCRIPCIÓN ─────────────────────────────────────────────────

  {
    titulo: 'Proceso de inscripción Licenciaturas — Instituto Windsor',
    contenido: `PROCESO DE INSCRIPCIÓN LICENCIATURAS — Instituto Windsor

Documentos necesarios:
1. Acta de nacimiento
2. Certificado de bachillerato
3. Comprobante de pago de inscripción

Información bancaria para realizar el pago:
https://drive.google.com/file/d/1Hj9rRk1zHMWGnG_CjF287W-hxY2AoTe9/view?usp=drivesdk

Pasos para inscribirse:
1. Realiza el pago de inscripción con los datos bancarios del enlace anterior.
2. Ingresa a https://www.windsor.edu.mx/solicitud-de-inscripcion y llena la Solicitud de Inscripción para Licenciaturas.
3. Envía los documentos y el comprobante de pago por WhatsApp.
4. Un asesor confirmará tu inscripción y coordinará los siguientes pasos.`
  },

]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function deleteAll() {
  console.log('\n⟳ Eliminando todos los documentos actuales...')
  const res = await fetch(SUPABASE_URL + '/rest/v1/documentos?id=neq.00000000-0000-0000-0000-000000000000', {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error('Error eliminando documentos: ' + txt)
  }
  console.log('✓ Todos los documentos eliminados')
}

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_KEY
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text
    })
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error('Error OpenAI embeddings: ' + txt)
  }
  const data = await res.json()
  return data.data[0].embedding
}

async function insertDoc(titulo, contenido) {
  const embedding = await getEmbedding(contenido)
  const res = await fetch(SUPABASE_URL + '/rest/v1/documentos', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ titulo, contenido, embedding })
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error('Error insertando "' + titulo + '": ' + txt)
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Reestructuración de BASE (RAG) ===')
  console.log(`Total documentos a subir: ${DOCUMENTOS.length}`)

  await deleteAll()

  console.log('\n⟳ Subiendo documentos limpios...\n')
  for (const doc of DOCUMENTOS) {
    process.stdout.write(`  → ${doc.titulo}... `)
    await insertDoc(doc.titulo, doc.contenido)
    console.log('✓')
    // Pequeña pausa para no saturar la API de OpenAI
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n✅ Listo. ${DOCUMENTOS.length} documentos subidos a la BASE.`)
}

main().catch(e => {
  console.error('\n❌ Error:', e.message)
  process.exit(1)
})
