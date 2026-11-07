// Comparación compartida entre ficha, endpoint y la migración v14.
export function normalizarTelefonoInicio(value) {
  if (typeof value !== 'string') return null;
  const raw = value.replace(/^whatsapp:/i, '').trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && !raw.startsWith('+')) digits = '52' + digits;
  if (/^521\d{10}$/.test(digits)) digits = '52' + digits.slice(3);
  return /^[1-9]\d{10,14}$/.test(digits) ? '+' + digits : null;
}

export function conversacionDelLead(conversaciones, lead) {
  const telefono = normalizarTelefonoInicio(lead.whatsapp);
  return conversaciones.find(c => c.lead_id === lead.id ||
    (telefono && normalizarTelefonoInicio(c.whatsapp) === telefono)) || null;
}

export const PLANTILLA_RESPALDO = 'seguimiento_solicitud_anax';

export function textoPlantillaInicio(nombre, plantilla = 'primer_contacto_anax') {
  if (plantilla !== PLANTILLA_RESPALDO) return `Hola ${nombre} 👋, te escribimos de Anaxágoras 41. Recibimos tu solicitud de información sobre hospedaje. ¿Te gustaría que te compartamos disponibilidad y precios por este medio? 🏡`;
  return `Hola ${nombre}, seguimos con tu solicitud de información sobre disponibilidad en Anaxágoras 41 para las fechas que nos compartiste. ¿Sigue vigente tu interés para que un asesor te confirme los detalles?`;
}

// Las plantillas deben tener estos títulos de respuesta rápida. También se
// aceptan los títulos existentes del respaldo, solo si el RPC acredita el inicio.
export function respuestaPrimerContacto(message) {
  const label = message?.type === 'button' ? message.button?.text :
    message?.type === 'interactive' ? message.interactive?.button_reply?.title :
    message?.type === 'text' ? message.text?.body : null;
  if (typeof label !== 'string') return null;
  const key = label.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const decision = ['si, me interesa', 'si, enviame la info'].includes(key) ? 'si' :
    ['ahora no', 'ya no, gracias'].includes(key) ? 'no' : null;
  return decision ? { decision, texto: label.trim() } : null;
}
