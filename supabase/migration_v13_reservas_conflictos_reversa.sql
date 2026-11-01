-- Volver primero al código anterior. Renombrar conserva historial y dedupe.
begin;
drop function public.actualizar_monitor_reservas(jsonb,jsonb,uuid[],timestamptz);
drop function public.reclamar_avisos_reservas();
alter table public.reservas_fuentes rename to reservas_fuentes_respaldo_v13;
alter table public.reservas_conflictos rename to reservas_conflictos_respaldo_v13;
alter table public.reservas_avisos_push rename to reservas_avisos_push_respaldo_v13;
-- Se conserva feeds_ok para auditoría de syncs.
commit;
