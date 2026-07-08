-- MIGRACIÓN v4 — Orden fijo de lofts (PB → 1ER → 2DO) y limpia el campo `tipo`
-- (el orden alfabético por `nombre` no respeta pisos: "1ER-11" queda antes que "PB-01")

alter table public.lofts add column if not exists orden int;

update public.lofts l set orden = v.orden, tipo = ''
from (values
  ('PB-01', 1),
  ('PB-02', 2),
  ('PB-03', 3),
  ('PB-04', 4),
  ('1ER-11', 5),
  ('1ER-12', 6),
  ('1ER-13', 7),
  ('1ER-14', 8),
  ('2DO-21', 9),
  ('2DO-22', 10),
  ('2DO-23', 11),
  ('2DO-24', 12)
) as v(nombre, orden)
where l.nombre = v.nombre;
