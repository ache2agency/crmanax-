-- MIGRACIÓN v3 — Actualiza la lista de lofts a la nomenclatura real del edificio
-- Reemplaza los 7 lofts de prueba (Loft 04, Loft 11, etc.) por los 12 reales.
-- El campo `tipo` no afecta nada en la app (solo se mostraba como referencia junto
-- al nombre en el CRM) así que se deja el default de la columna.

delete from public.lofts;

insert into public.lofts (nombre) values
  ('PB-01'),
  ('PB-02'),
  ('PB-03'),
  ('PB-04'),
  ('1ER-11'),
  ('1ER-12'),
  ('1ER-13'),
  ('1ER-14'),
  ('2DO-21'),
  ('2DO-22'),
  ('2DO-23'),
  ('2DO-24')
on conflict do nothing;
