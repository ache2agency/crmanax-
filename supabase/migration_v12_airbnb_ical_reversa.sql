-- Primero volver al código anterior. Archivar los bloqueos para poder revertir sin perderlos.
begin;
create table public.reservas_ical_respaldo_v12 as select * from public.reservas where origen = 'airbnb_ical';
alter table public.reservas_ical_respaldo_v12 enable row level security;
revoke all on public.reservas_ical_respaldo_v12 from anon, authenticated;
delete from public.reservas where origen = 'airbnb_ical';
drop function public.replace_airbnb_ical_reservas(uuid, jsonb);
alter table public.reservas drop constraint reservas_origen_check;
alter table public.reservas add constraint reservas_origen_check check (origen in ('excel', 'crm', 'motor'));
-- Se conservan origen/avisos en la bitácora para auditoría.
commit;
