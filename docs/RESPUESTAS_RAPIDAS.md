# Respuestas rápidas y datos del bot — Tarea 9

`lib/anaxagoras/textos.js` es la fuente de los textos aprobados el 31-oct-2026: el CRM importa su catálogo `RESPUESTAS_RAPIDAS`, y el webhook y las cotizaciones usan `TEXTOS`, `condicionesEstancia` y el depósito compartido. Los textos de la tarea se conservan literalmente; no provienen de IA ni de una tabla remota.

El selector tiene 39 opciones: se agregan 10 y «Confirmar disponibilidad / visita» pasa a «Horario de visitas». Las 11 respuestas aprobadas están en sus grupos: 5 en Información general y 6 en Proceso de reserva. Se amplían Requisitos arrendamiento mensual manteniendo el enlace del blog, y se corrige el depósito por noche a **$649 por reservación**, una vez por estancia. El depósito mensual conserva sus textos anteriores en panel y bot.

`lib/anaxagoras/faq.js` reconoce persona adicional/visitas que se quedan, mascotas, IVA/factura, ingresos, entrada/salida, visitas, cocina/áreas comunes/jacuzzi, contrato mensual, otras ubicaciones y datos para cotizar. Las respuestas mantienen la fase y los datos del prospecto; luego se conserva el recordatorio del paso que faltaba. En espera del asesor se amplía la lista de preguntas factuales: sigue respetando `BOT_FAQ_EN_ESPERA`, modo humano y una respuesta del asesor en las últimas 12 horas.

Las menciones a «últimos 3 meses» de los estados de cuenta y «mañana a las 8 am» en una pregunta sobre entrada no se procesan como fechas o duración de reserva. La cotización normal y la heredada de `tipo_loft` muestran depósito, horarios e impuestos; en mensual también contrato e ingresos.

El cargo de $280 por persona adicional se informa, pero no amplía la capacidad del catálogo ni se suma automáticamente a una tarifa mensual. Para más de 2 personas el bot pide que un asesor confirme capacidad/opción antes de cotizar o apartar. No se inventa disponibilidad ni una tarifa para un loft con capacidad excedida.

## Validación y activación

`npm test`, TypeScript y build Webpack, con servicios simulados. Sin migraciones, secretos ni envíos reales. Después de revisar el PR, Harold decide merge/deploy y prueba las FAQ desde una conversación de prueba autorizada.

## Relación con PR #57

Este trabajo nace de `origin/main` `3de0b2b`, sin incluir PR #57. Hay solapamiento en el bloque de respuesta de `lib/whatsapp/fase2-disponibilidad.ts`: la Tarea 9 añade las condiciones compartidas de la cotización, mientras #57 cambia esa redacción según `datosViejos`. Al integrar ambos, el revisor debe conservar el tratamiento de frescura de #57 y los textos compartidos de esta tarea. Aquí no se mezcla, rebasea ni modifica #57. `CLAUDE.md` también recibe una nota nueva; su bloque de #57 debe conservarse cuando se integren ambos.
