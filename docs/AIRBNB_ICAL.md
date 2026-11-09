# Disponibilidad con calendarios Airbnb

## 9-nov: el bot ya no usa Airbnb

El bot (webhook y motor de fase 2) y `/api/disponibilidad` usan `loftsDisponibles`: solo el Excel de Dropbox y las reservas propias (`crm`/`motor`) bloquean opciones. Las filas `airbnb_ical` se ignoran. Una reserva del Excel con canal Airbnb sí sigue bloqueando. La frescura del bot depende únicamente del último éxito del Excel en `reservas_fuentes` (máximo 2 horas). Un feed iCal viejo, ausente o fallido no provoca la frase «Un asesor te confirma disponibilidad…»; Excel viejo, ausente o no verificable sí.

El panel de Disponibilidad conserva la unión Excel + Airbnb, los bloqueos grises, la frescura de ambas fuentes y los avisos de posible doble reserva. El sync iCal y su monitor siguen iguales. Se mantiene la salida exclusiva: del 5 al 8 bloquea las noches 5, 6 y 7. No se escribe al Excel ni a Airbnb.

## Activación por Harold

1. Aplicar **primero** `supabase/migration_v12_airbnb_ical.sql` en Supabase, después desplegar el código del PR. Codex no aplicó SQL remoto ni desplegó.
2. En Vercel → proyecto crmanax → Settings → Environment Variables → **Production**, crear `AIRBNB_ICAL_URLS` (solo servidor; nunca `NEXT_PUBLIC_`). Valor: objeto JSON `{"PB-01":"https://www.airbnb.com/calendar/ical/000000.ics?s=FALSO", ...}`, uno por cada loft. El JSON real está fuera del repo en `_credenciales/airbnb_ical_urls.json` de la carpeta madre; copiar su contenido sin publicarlo en chats, logs ni commits. No agregar comillas envolventes al JSON. `.env.example` contiene únicamente datos falsos.
3. Conservar `DROPBOX_RESERVAS_URL` y `CRON_SECRET` actuales. Desplegar después de cargar la variable (las variables nuevas requieren redeploy).
4. En Disponibilidad pulsar **Actualizar ahora**. Confirmar fechas de actualización de Excel y Airbnb; si hay fallo se muestra el error y se conserva la ocupación previa. Los días extras de iCal aparecen grises con leyenda **Bloqueado en Airbnb** y detalle **Bloqueado en Airbnb (sin detalle)**. En fechas compartidas se muestra la reserva del Excel, sin duplicación ni falso traslape.
5. El mismo `/api/reservas/sync` actualiza ambas fuentes: POST acepta sesión CRM o `Authorization: Bearer <CRON_SECRET>` / `x-cron-secret`. GET es para cron y solo acepta secreto. Reutilizar el programador externo que llama a este endpoint; si no existe, Harold debe configurarlo (sugerencia: cada 15 min, sujeto al plan). Esta tarea no instala crons ni cambia `vercel.json`. `maxDuration=300` debe ser compatible con el plan de hosting. El cron de reactivación WhatsApp existente sigue aparte.

Respuesta: `{ok, excel, excelError, airbnb, airbnbError}`; `airbnb` contiene `{syncId, configurado, rows, errores, avisos}`. Fallos parciales usan HTTP 207 y `ok:false`: comprobar también ese campo en el monitor del cron. Si Dropbox falla, Airbnb se intenta de todas formas y sus avisos se comparan con el último Excel guardado. Cada fuente tiene su fila en `reservas_sync`; la de Airbnb guarda avisos (loft y fechas, sin huéspedes). Sin variable o con JSON vacío se avisa que Airbnb no está configurado; no se eliminan bloqueos.

## Fallos y privacidad

- Hasta 3 descargas concurrentes, timeout de 10 s por intento y un reintento; HTTP erróneo, calendario incompleto, fechas inválidas o recurrencias no soportadas conservan el snapshot del loft. Otro feed exitoso sí se actualiza. No se siguen redirecciones; se admiten URLs HTTPS de airbnb.com/www.airbnb.com con ruta `/calendar/ical/`.
- Un calendario válido sin eventos sí elimina bloqueos anteriores del loft. El reemplazo por RPC es una sola transacción con bloqueo por loft y permiso exclusivo de `service_role`. Un error SQL revierte el reemplazo completo. Quitar un loft del JSON NO borra sus bloqueos; revisar manualmente antes de desactivar una fuente.
- Se ignoran DESCRIPTION, SUMMARY, UID y demás datos del huésped: solo fechas y loft. `Reserved` y `Airbnb (Not available)` bloquean igual, sin intentar distinguir reserva y preparación. Errores de descarga se sustituyen por mensajes fijos; nunca se registran URLs o respuestas crudas.
- Horizonte móvil: hoy en Ciudad de México hasta la misma fecha dentro de 12 meses, extremo exclusivo. Eventos totalmente fuera se ignoran y los que cruzan el límite se recortan. Por ejemplo, al 31-oct-2026 un bloqueo 27-jul→31-oct-2027 solo ocupa hasta 30-oct-2027. No se descartan días dentro del horizonte por suponer que son la ventana automática de Airbnb: el feed no permite distinguirlos con certeza. La API del panel vuelve a aplicar ese límite al leer snapshots conservados; el bot ignora todos los bloqueos iCal.
- Avisos de posible doble reserva: restar a las reservas del Excel los intervalos ocupados del feed actualizado, unir tramos y mostrar loft/fechas en el panel. **No demuestran una doble reserva**: señalan fechas que Alexis debe revisar y bloquear en Airbnb, como PB-01 5→8-dic. No se generan avisos de un feed fallido.
- iCal puede retrasarse respecto a Airbnb; la disponibilidad sigue siendo estimada y el asesor confirma.

## Reversa y pruebas

Volver al código anterior antes de aplicar `supabase/migration_v12_airbnb_ical_reversa.sql`. La reversa archiva las filas iCal en una tabla con RLS, retira esas filas de `reservas` y restaura la restricción anterior; conserva la bitácora. Ambos SQL se entregan solo como archivos, sujetos a revisión de Harold.

`npm test` cubre feeds ficticios, privacidad, reintentos, fallo por loft, reemplazo vacío, horizonte, diferencias, celdas del panel, consulta real del bot y endpoints con autenticación y fuentes independientes. No se descargaron calendarios reales ni se sincronizó producción. La migración SQL requiere validación en un entorno de base de datos de prueba antes de aplicarla en producción.

## Actualización 8-bis

La regla sobre cola de ventana, frescura, avisos persistentes y activación v13 se actualiza en `docs/RESERVAS_CONFLICTOS.md`. Esta regla reemplaza la nota anterior de conservar toda ocupación dentro del horizonte: ahora se excluye la cola automática que cumple el patrón de la tarea 8-bis.
