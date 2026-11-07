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

export function textoPlantillaInicio(nombre) {
  return `Hola ${nombre}, seguimos con tu solicitud de información sobre disponibilidad en Anaxágoras 41 para las fechas que nos compartiste. ¿Sigue vigente tu interés para que un asesor te confirme los detalles?`;
}
