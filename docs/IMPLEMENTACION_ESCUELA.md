# Implementacion En La Escuela

Ruta resumida para llevar `salescrm` a uso real dentro de la escuela.

## Fase 1. Preparacion Operativa

Objetivo: definir como se va a usar el CRM antes del piloto.

- Definir que equipo entra primero: admisiones, ventas o coordinacion.
- Confirmar responsables por lead.
- Acordar significado operativo de cada etapa:
  - `nuevo`
  - `contactado`
  - `interesado`
  - `propuesta`
  - `cerrado`
  - `perdido`
- Definir cuando una conversacion pasa de bot a asesor humano.

Entregable:
- pipeline aprobado y responsables claros.

## Fase 2. Adaptacion A Windsor

Objetivo: quitar elementos genericos y dejar el CRM alineado a la escuela.

- Cargar programas reales.
- Ajustar tipos de cita reales.
- Ajustar mensajes sugeridos por etapa.
- Revisar catalogo de usuarios internos.
- Confirmar como se asignaran leads entre asesores.

Entregable:
- CRM con estructura real de Windsor.

## Fase 3. Configuracion Tecnica

Objetivo: dejar la infraestructura lista para operar.

- Confirmar URL oficial: `https://crm.windsor.edu.mx`
- Mantener webhook estable:
  - `https://crm.windsor.edu.mx/api/whatsapp/webhook`
- Completar alta del numero oficial de WhatsApp en Meta.
- Cargar variables finales en Vercel.
- Validar que el CRM, agenda y timeline funcionen con datos reales.

Entregable:
- entorno listo para pruebas internas.

## Fase 4. Piloto Interno

Objetivo: probar con un grupo pequeno antes de abrirlo a toda la escuela.

- Seleccionar 1 o 2 usuarios reales.
- Registrar leads reales o controlados.
- Probar:
  - alta manual de lead
  - cambio de etapa
  - agenda
  - timeline
  - takeover humano
  - seguimiento del prospecto
- Registrar fricciones y errores.

Entregable:
- lista de ajustes antes de operacion formal.

## Fase 5. Salida A Operacion

Objetivo: empezar uso formal.

- Abrir acceso al equipo definido.
- Activar canal oficial de WhatsApp.
- Usar el CRM como fuente principal de seguimiento.
- Medir actividad diaria:
  - leads nuevos
  - tiempo de respuesta
  - citas agendadas
  - cierres

Entregable:
- CRM operando en entorno real.

## Fase 6. Ajuste Continuo

Objetivo: mejorar despues del arranque.

- Revisar errores semanales.
- Ajustar mensajes del bot.
- Afinar etapas y criterios de cierre.
- Mejorar reportes y seguimiento interno.

Entregable:
- version estable y mejorada para operacion continua.

## Prioridad Inmediata

Mientras el numero de WhatsApp termina de registrarse, avanzar en:

1. Fase 1
2. Fase 2
3. Fase 4 parcial con pruebas internas sin canal oficial

## Proximo Paso Recomendado

Trabajar la adaptacion a Windsor:

- programas reales
- tipos de cita reales
- mensajes reales
- usuarios reales
