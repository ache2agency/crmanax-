# Respuestas rápidas y datos del bot — Tarea 9

`lib/anaxagoras/textos.js` es la fuente de los textos aprobados el 31-oct-2026: el CRM importa su catálogo `RESPUESTAS_RAPIDAS`, y el webhook y las cotizaciones usan `TEXTOS`, `condicionesEstancia` y el depósito compartido. Los textos de la tarea se conservan literalmente; no provienen de IA ni de una tabla remota.

El selector tiene 39 opciones: se agregan 10 y «Confirmar disponibilidad / visita» pasa a «Horario de visitas». Las 11 respuestas aprobadas están en sus grupos: 5 en Información general y 6 en Proceso de reserva. Se amplían Requisitos arrendamiento mensual manteniendo el enlace del blog, y se corrige el depósito por noche a **$649 por reservación**, una vez por estancia. El depósito mensual conserva sus textos anteriores en panel y bot.

`lib/anaxagoras/faq.js` reconoce persona adicional/visitas que se quedan, mascotas, IVA/factura, ingresos, entrada/salida, visitas, cocina/áreas comunes/jacuzzi, contrato mensual, otras ubicaciones y datos para cotizar. Las respuestas mantienen la fase y los datos del prospecto; luego se conserva el recordatorio del paso que faltaba. En espera del asesor se amplía la lista de preguntas factuales: sigue respetando `BOT_FAQ_EN_ESPERA`, modo humano y una respuesta del asesor en las últimas 12 horas.

Las menciones a «últimos 3 meses» de los estados de cuenta y «mañana a las 8 am» en una pregunta sobre entrada no se procesan como fechas o duración de reserva. La cotización normal y la heredada de `tipo_loft` muestran depósito, horarios e impuestos; en mensual también contrato e ingresos.

El cargo de $280 por persona adicional se informa, pero no amplía la capacidad del catálogo ni se suma automáticamente a una tarifa mensual. Para más de 2 personas el bot pide que un asesor confirme capacidad/opción antes de cotizar o apartar. No se inventa disponibilidad ni una tarifa para un loft con capacidad excedida.

## Validación y activación

`npm test`, TypeScript y build Webpack, con servicios simulados. Sin migraciones, secretos ni envíos reales. Después de revisar el PR, Harold decide merge/deploy y prueba las FAQ desde una conversación de prueba autorizada.

## Tarea 9-bis — fechas y FAQ (2-nov-2026)

PR #58 rebasado sobre `origin/main eb4b71e`, que ya incluye #57. La resolución conserva `datosViejos`, sus dos textos prudentes, `TEXTOS.proceso_noche`, el depósito compartido, condiciones de estancia y el control de capacidad para más de dos huéspedes. Las notas de 8-bis y 9 permanecen en CLAUDE.md.

En el flujo de cotización, fechas/duración tienen prioridad sobre una FAQ. El mensaje captura nombre explícito, fechas y personas; consulta disponibilidad como antes y añade la respuesta aprobada en el mismo envío. Horario e impuestos ya presentes en la cotización no se duplican. Si faltan huéspedes o salida se pide el dato antes de calcular un total; una fecha inválida pide corrección sin consultar disponibilidad.

«Llego mañana … 3 noches» es una estancia. La excepción de horario requiere pregunta de entrada/llegada con hora explícita y sin rango/duración de estancia: «¿a qué hora puedo entrar mañana a las 8 am?» conserva las fechas guardadas. Los últimos tres meses de los estados de cuenta siguen siendo información documental. «Visitar a mi familia/ciudad/trabajo» no activa visitas ni persona adicional; preguntar por conocer el loft o visitas permitidas sí.

Se conserva el comportamiento de espera del asesor y de reservas aceptadas: no recotiza esas conversaciones. Las FAQ sin fechas conservan fase; siguen vigentes modo humano, flag de FAQ y atención humana en las últimas 12 h. No hay cambios de SQL, crons ni despliegue.

Pruebas específicas en `tests/fechas-con-faq-9bis.test.mjs`: las tres frases reales por cinco fases, preguntas de horario, factura con nombre, dato de personas pendiente, fechas inválidas y cotizaciones frescas/viejas por noche/mes con depósito una sola vez y condiciones completas.
