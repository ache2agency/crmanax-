-- Políticas RLS para la tabla leads
-- Ejecutar en Supabase Dashboard → SQL Editor

-- Vendedores pueden ver y editar sus leads asignados
create policy "vendedor ve sus leads"
  on public.leads
  for select
  using (
    asignado_a = auth.uid()
    or public.es_admin()
  );

create policy "vendedor actualiza sus leads"
  on public.leads
  for update
  using (
    asignado_a = auth.uid()
    or public.es_admin()
  )
  with check (
    asignado_a = auth.uid()
    or public.es_admin()
  );

-- Si las policies ya existen, borrar primero y recrear:
-- drop policy if exists "vendedor ve sus leads" on public.leads;
-- drop policy if exists "vendedor actualiza sus leads" on public.leads;
