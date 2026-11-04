# Motor de reservas · prototipo de aprobación

Entrada: `/reservar`. Solo habilitado con `MOTOR_RESERVAS_PREVIEW=1` en Vercel Preview o desarrollo local. En producción devuelve 404, incluso si el flag queda activo.

El único endpoint nuevo es `GET /api/motor-reservas?entrada=YYYY-MM-DD&salida=YYYY-MM-DD&personas=N`. Lee por HTTP GET `lofts`, `reservas` y `reservas_fuentes`, con credencial privada de servidor. No consulta datos personales. Excluye ocupación de Excel e iCal, salida exclusiva, paginación de 1,000 filas, horizonte móvil y cola de ventana de Airbnb según las reglas vigentes. La respuesta contiene solo opciones libres, catálogo y frescura; si falla la conexión no sustituye con datos ficticios.

Precios y capacidades: funciones del bot en `lib/whatsapp/fase2-disponibilidad.ts`. Desde 28 noches se presenta tarifa mensual de referencia, sin inventar un prorrateo para estancias parciales o de varios meses. Más de dos huéspedes requiere asesor, sin oferta automática de un loft sobre capacidad.

Fotos: sitio oficial `anaxagoras41suite.arqarri.com`, páginas `loftChico.php`, `loftMediano.php` y `loftGrande.php`, copiadas a `public/estancias/`. Son referencias por tipo, no fotos verificadas por unidad.

El formulario utiliza exclusivamente estado React y lo vacía al completar la simulación. No tiene POST, almacenamiento ni envío. No crea leads, reservas, pagos ni notificaciones. El proxy limita este preview a `/reservar`, su GET y sus assets; los endpoints existentes del CRM devuelven 404 dentro de este deployment de aprobación. No modifica el funcionamiento del CRM productivo.

Validación: 111 pruebas, TypeScript, build y flujo Chrome 390/1440; capturas en `docs/motor-reservas/`. El despliegue se valida además en sesión limpia con enlace compartible de siete días. Secretos de despliegue y enlace de acceso se mantienen en `.vercel/`, ignorado por Git; no agregar esa carpeta al repositorio.

Para hacerlo real: persistir solicitudes con idempotencia y aviso de privacidad; notificar a Alexis y administrar aprobación/rechazo; revalidar disponibilidad y bloquear intervalos atómicamente para evitar doble reserva; definir integración/exportación con Airbnb/Excel; acordar cotización de estancias mensuales, impuestos y depósitos; integrar pagos y conciliación de webhooks. Nada de ello está activo en este prototipo.
