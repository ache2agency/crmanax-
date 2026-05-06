# Checklist de QA - CRM SalesCRM

Usa esta lista antes de cerrar cambios importantes en CRM, WhatsApp, conversaciones o agenda.

## 1. Validacion tecnica rapida

Corre:

```bash
npm run crm:check
```

Esto revisa lint en:

- `app/api/whatsapp/webhook/route.ts`
- `app/crm.jsx`
- `components/crm/ConversationsPanel.jsx`
- `components/crm/AgendaPanel.jsx`

## 2. Flujo basico de WhatsApp

Probar con el numero de sandbox ya unido a Twilio:

1. Enviar: `Hola, soy Carlos`
   Esperado: pide o confirma programa.
2. Enviar: `Me interesa maestrias`
   Esperado: guarda programa y pide correo.
3. Enviar: `carlos@mail.com`
   Esperado: guarda correo y envia informacion.
4. Enviar: `Tengo una duda`
   Esperado: cambia a fase `dudas`.
5. Enviar una pregunta real.
   Esperado: responde sin romper el flujo.
6. Enviar: `Quiero avanzar`
   Esperado: pasa a CTA.

## 3. Casos de sincronia CRM ↔ WhatsApp

1. En un lead con conversacion ligada, mover stage desde el CRM.
   Esperado: cambia tambien `fase` en la conversacion relacionada.
2. Marcar un lead como `perdido`.
   Esperado: la conversacion queda en fase/estado de cierre.
3. Crear una cita desde el lead.
   Esperado: el lead pasa a `propuesta`.

## 4. Vista de conversaciones

1. Filtrar por modo `BOT`.
   Esperado: solo aparecen conversaciones automaticas.
2. Filtrar por modo `Humano`.
   Esperado: solo aparecen conversaciones tomadas por vendedor.
3. Buscar por nombre, email o WhatsApp.
   Esperado: la lista responde correctamente.
4. Abrir una conversacion.
   Esperado: se ve lead ligado, responsable, fase, estado y mensajes.
5. Tomar control.
   Esperado: cambia a modo humano.
6. Volver a BOT.
   Esperado: regresa a modo bot.

## 5. Modal del lead

1. Abrir un lead con actividad de WhatsApp.
   Esperado: muestra ultima actividad y timeline.
2. Abrir un lead sin actividad.
   Esperado: muestra estado vacio sin error.
3. Editar notas.
   Esperado: se guardan.
4. Cambiar etapa.
   Esperado: cambia lead y sincroniza conversacion si existe.

## 6. Agenda

1. Crear una cita futura valida.
   Esperado: se guarda y aparece en agenda.
2. Intentar crear una cita en el pasado.
   Esperado: lo bloquea.
3. Cambiar status de cita a `confirmada`.
   Esperado: se actualiza visualmente.
4. Cambiar status a `completada` o `cancelada`.
   Esperado: persiste y se refleja en timeline del lead.

## 7. Revision final recomendada

Confirmar en Supabase:

- `leads`
- `whatsapp_conversaciones`
- `whatsapp_mensajes`
- `citas`

Revisar especialmente:

- `stage`
- `fase`
- `estado`
- `lead_id`
- `email`
- `curso`
- `status` de citas

## 8. Criterio para dar por bueno el cambio

El cambio esta listo cuando:

- no rompe lint en archivos criticos;
- WhatsApp sigue respondiendo;
- las conversaciones muestran informacion coherente;
- el lead refleja el estado comercial correcto;
- las citas se guardan y cambian de estado bien.
