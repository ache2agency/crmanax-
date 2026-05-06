-- Tabla para secuencia de emails automáticos
create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  email text not null,
  nombre text,
  dia_envio integer not null,
  asunto text not null,
  contenido text not null,
  enviado boolean default false,
  fecha_envio timestamptz,
  created_at timestamptz default now()
);

alter table public.email_sequences enable row level security;

create policy "Admin acceso total"
  on public.email_sequences for all
  using (true)
  with check (true);
