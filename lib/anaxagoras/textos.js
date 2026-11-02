// Textos aprobados por Harold (31-oct-2026). Se comparten sin reformular entre CRM y bot.
const COMPROBANTE_INGRESOS = 'Estados de cuenta de los últimos 3 meses (solo la parte donde viene tu nombre y los saldos promedio de la cuenta); se toma como comprobante de ingresos.'

export const TEXTOS = {
  persona_adicional: "El costo por persona adicional que se aloje contigo es de $280.00 pesos por noche.",
  mascotas: "Por ahora no contamos con instalaciones para alojar mascotas.",
  impuestos: "Los costos no incluyen impuestos; si necesitas factura es más I.V.A.",
  areas_comunes: "Las áreas que se comparten son la terraza y la lavandería. Cada loft tiene parrilla eléctrica de 2 quemadores. No contamos con jacuzzi.",
  ubicacion_unica: "Solo estamos en la Ciudad de México (Anaxágoras 41, Piedad Narvarte).",
  visitas: "Puedes visitar las instalaciones de lunes a viernes de 9:00 am a 2:00 pm o de 3:00 a 4:00 pm, con cita agendada un día antes.",
  pedir_fechas: "Para darte una cotización exacta necesito tus fechas de llegada y salida, y cuántas personas 😊",
  proceso_noche: "1. Tener definidas tus fechas exactas de alojamiento 2. Realizar tu depósito en garantía y con eso se apartan las fechas 3. Enviar foto de identificación oficial por ambos lados si es INE 4. A tu llegada se realiza el pago de tu reserva (no se toma a cuenta el depósito en garantía)",
  entrada_salida: "Check in a partir de las 3:00 pm y check out a las 11:00 am (puntual). Si necesitas entrar desde las 8:00 am, tiene un costo extra de $300.00 pesos.",
  contrato_mensual: "Los contratos de arrendamiento son mensuales; no manejamos rentas tradicionales por año.",
  comprobante_ingresos: COMPROBANTE_INGRESOS,
  deposito_noche: "Más depósito en garantía de $649.00 pesos por reservación vía transferencia bancaria (se regresa por transferencia a la cuenta de origen al concluir tu estancia, una vez revisado que todo se encuentre en buen estado, como lo recibió el huésped)",
  requisitos_mensuales: `1. Enviar los documentos al correo anaxagoras41suite@gmail.com
2. ${COMPROBANTE_INGRESOS}
3. Depósito en garantía de $5,000.
https://anaxagoras41suite.arqarri.com/#blog`,
}

export function condicionesEstancia(tipo) {
  return [TEXTOS.entrada_salida, TEXTOS.impuestos,
    ...(tipo === 'mes' ? [TEXTOS.contrato_mensual, TEXTOS.comprobante_ingresos] : []),
  ].join('\n\n')
}

export function textoAprobado(clave) {
  return TEXTOS[clave] || null
}

export const RESPUESTAS_RAPIDAS = [
  { grupo: "Información general", items: [
    { label: "Persona adicional", texto: TEXTOS.persona_adicional },
    { label: "Mascotas", texto: TEXTOS.mascotas },
    { label: "Impuestos / factura", texto: TEXTOS.impuestos },
    { label: "Áreas comunes y cocina", texto: TEXTOS.areas_comunes },
    { label: "Ubicación única", texto: TEXTOS.ubicacion_unica },
    { label: "Tarifas", texto: `*Tarifas Anaxágoras 41:*

🛏 *Loft Chico* (~16 m², 1 persona)
• Por noche: $700 MXN
• Mensual: $12,000 MXN

🛏 *Loft Mediano* (~24 m², 1-2 personas)
• Por noche: $800 MXN
• Mensual 1 persona: $14,000 MXN
• Mensual 2 personas: $16,000 MXN

🛏 *Loft Grande* (~32 m², hasta 2 personas)
• Por noche: $900 MXN
• Mensual 1 persona: $16,000 MXN
• Mensual 2 personas: $18,000 MXN

_Todos incluyen agua, luz, gas, internet, limpieza semanal y cambio de blancos._` },
    { label: "Ubicación", texto: `📍 *Anaxágoras 41*
Colonia Piedad Narvarte, Benito Juárez, CDMX

Cerca de:
• Parque Delta
• Hospital Siglo XXI / Centro Médico
• Roma Norte
• WTC
• Autódromo Hermanos Rodríguez

🗺 https://maps.google.com/?q=19.402599,-99.156502

Transporte:
• EcoBici: 1 min
• Metrobús Obrero Mundial: 5 min
• Metro Centro Médico: 10 min` },
    { label: "Servicios incluidos", texto: `*Servicios incluidos en todos los lofts:*

✅ Agua, luz, gas e internet (150 Mbps)
✅ Smart TV y Alexa
✅ Área de cocina equipada
✅ Zona de trabajo
✅ Cerradura inteligente
✅ Limpieza semanal
✅ Cambio de blancos
✅ Lavandería (1 uso/semana)
✅ Roof garden de uso común

❌ No contamos con estacionamiento propio
❌ No contamos con elevador` },
    { label: "Seguridad", texto: `*Seguridad en Anaxágoras 41:*

🔐 Cerraduras inteligentes con códigos personalizados
📹 Videovigilancia en entrada, pasillos, terraza y lavandería
🚪 Control de acceso individual

Política: *un acceso = una persona.* Cada huésped registra su ingreso individualmente.` },
    { label: "Estacionamiento", texto: `No contamos con estacionamiento propio, pero hay opciones cerca:

🅿️ Estacionamientos públicos en la zona
🅿️ Parque Delta (a pasos del edificio)

¿Hay algo más en que te pueda ayudar?` },
    { label: "Horario de atención", texto: `🛎️ *Horario de Oficina*
⛅️ 8:00 am - 8:00 pm 🌙

Es un gusto atenderle.` },
    { label: "Sitio web", texto: `https://anaxagoras41suite.arqarri.com/` },
  ]},
  { grupo: "Tipos de renta", items: [
    { label: "Renta por noche", texto: `*Renta por noche — Anaxágoras 41:*

🛏 Loft Chico (~16 m², 1 persona): $700 MXN/noche
🛏 Loft Mediano (~24 m², 1-2 personas): $800 MXN/noche
🛏 Loft Grande (~32 m², hasta 2 personas): $900 MXN/noche

📸 Fotos: https://anaxagoras41suite.arqarri.com/

¿Para qué fechas y cuántas personas sería?` },
    { label: "Renta por mes", texto: `*Renta por mes — Anaxágoras 41:*

🛏 Loft Chico (1 persona): $12,000 MXN/mes
🛏 Loft Mediano (1 persona): $14,000 MXN/mes | (2 personas): $16,000 MXN/mes
🛏 Loft Grande (1 persona): $16,000 MXN/mes | (2 personas): $18,000 MXN/mes

📸 Fotos: https://anaxagoras41suite.arqarri.com/

¿Para qué fecha de entrada sería?` },
    { label: "Roof Top / Eventos", texto: `*Roof Top Anaxágoras* — Eventos

Espacio semitechado ideal para eventos pequeños, brunchs y reuniones.

👥 Capacidad: hasta 20 personas
⏰ Horario: 9:00 a.m. – 12:00 a.m.
💰 Tarifa: $6,000 MXN (7 horas)
🔒 Depósito: $2,000 MXN (se devuelve al día siguiente)

Incluye: mobiliario, barra con tarja, bocina, proyector y sanitario.

_No se permite equipo de audio externo ni grupos musicales._

Para reservar el Roof Top escríbenos al *+52 55 3481 5126*.` },
    { label: "Precio Loft Chico", texto: `Costo y detalles en el link:
https://anaxagoras41suite.arqarri.com/loftChico.php` },
    { label: "Precio Loft Mediano", texto: `Costos y detalles en el link:
https://anaxagoras41suite.arqarri.com/loftMediano.php` },
    { label: "Precio Loft Grande", texto: `Costos y detalles en el link:
https://anaxagoras41suite.arqarri.com/loftGrande.php` },
  ]},
  { grupo: "Proceso de reserva", items: [
    { label: "Pedir fechas", texto: TEXTOS.pedir_fechas },
    { label: "Proceso para apartar (por noche)", texto: TEXTOS.proceso_noche },
    { label: "Horario de entrada y salida", texto: TEXTOS.entrada_salida },
    { label: "Contrato mensual", texto: TEXTOS.contrato_mensual },
    { label: "Comprobante de ingresos", texto: TEXTOS.comprobante_ingresos },
    { label: "Documentos para rentar", texto: `Le explico;

1. Enviar los documentos al siguiente correo electrónico: anaxagoras41suite@gmail.com
2. Una vez teniendo el visto bueno de los documentos se hace la transferencia por el monto del depósito en garantía (con esto se aparta el loft y fechas)
3. A tu llegada se paga en efectivo o en transferencia bancaria al momento la renta que va corriendo` },
    { label: "Depósito en garantía (por noche)", texto: TEXTOS.deposito_noche },
    { label: "Depósito en garantía (por mes)", texto: `Más depósito en garantía de $5,000.00 pesos vía transferencia bancaria (se regresa de 5 a 3 días antes de finalizar el mes, una vez que haya concluido la reserva y todo se encuentre en buen estado, como lo recibió el huésped)` },
    { label: "Datos bancarios (depósito/pago)", texto: `Banco: Bajío
Clabe interbancaria: 030180900022606582
Beneficiario: TALHUMCOM S.A de C.V.` },
    { label: "Concepto transferencia — depósito", texto: `Monto: $649.00 pesos
Concepto: "depósito en garantía" *ningún otro dato* por favor` },
    { label: "Concepto transferencia — pago renta", texto: `Concepto: "tu nombre completo" *ningún otro dato* por favor` },
    { label: "Devolución de depósito en garantía", texto: `Por favor me ayuda con los siguientes datos de la cuenta donde se originó el movimiento bancario, para proceder con la devolución del depósito en garantía:

*Nombre de beneficiario
*Banco
*Clave interbancaria

Gracias` },
    { label: "Requisitos arrendamiento mensual", texto: TEXTOS.requisitos_mensuales },
    { label: "Formato de cotización", texto: `Loft
Check in: /26 a partir de las 03pm
Check out: /26 a las 11am. (puntual)
Costo por noche: $.00 pesos
No. de noches: noches
No. de personas: máximo
*Total a pagar: $.00 pesos*` },
    { label: "Horario de visitas", texto: TEXTOS.visitas },
  ]},
  { grupo: "Seguimiento", items: [
    { label: "Información, primer contacto", texto: `Gracias por ponerte en contacto con Anaxagoras 41, para brindarte un mejor servicio por favor indica lo siguiente:

*Nombre
*Fechas aprox. de llegada y duración de tu estadía
*No. de personas a alojarse
*Medio en que nos viste publicado.

Responderemos lo antes posible😊😊` },
    { label: "Recordatorio amable", texto: `Hola de nuevo 😊 Solo quería saber si sigues interesad@ en alguno de nuestros lofts, o si tienes alguna duda que te pueda resolver.` },
    { label: "Cierre / agradecimiento", texto: `¡Con gusto! Quedamos al pendiente. Si más adelante tienes dudas o quieres retomar, aquí estamos. 😊` },
  ]},
  { grupo: "Durante y después de la estancia", items: [
    { label: "Limpieza programada", texto: `Limpieza General "semanal"
☺️ Deseo tu estancia sea placentera ✅ en el Loft 🏠, para mañana se está programando la Limpieza 🧹 🧽 General 🫧 y cambio de Blancos a las` },
    { label: "Aviso sobre manchas en blancos", texto: `***POR FAVOR EVITAR MANCHAR LAS TOALLAS DE MAQUILLAJE, TINTE DE PELO, SANGRE, FILTRO SOLAR O LIMPIADOR DE CALZADO, SE HARA CARGO EXTRA***
Gracias 😊` },
    { label: "Reseña post-estancia (reserva directa)", texto: `Hola 👋🏼
Espero hayas disfrutado de tu estancia en AnAxAgorAs 41, por favor te pedimos nos ayudes a compartir tu reseña para otros usuarios
https://search.google.com/local/writereview?placeid=ChIJ131HARr_0YUR6F016oENjM0&source=g.page.m.ia._&laa=nmx-review-solicitation-ia2

Para el equipo de AnAxAgorAs 41 es muy importante tu retroalimentación, nos ayuda para seguir brindando un servicio de excelente calidad.

Atte. AnAxAgorAs 41
"con AlmA de HogAr"` },
  ]},
];
