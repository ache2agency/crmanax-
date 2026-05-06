-- Extensión necesaria para vectores
create extension if not exists vector;

-- Recrear tabla limpia
drop table if exists public.documentos cascade;

-- Tabla de documentos para RAG
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  contenido text not null,
  embedding vector(1536) not null,
  created_at timestamptz default now()
);

-- Función de búsqueda vectorial
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int default 3,
  similarity_threshold float default 0.5
)
returns table(id uuid, contenido text, similarity float)
language plpgsql
security definer
as $$
begin
  return query
  select
    documentos.id,
    documentos.contenido,
    1 - (documentos.embedding <=> query_embedding) as similarity
  from documentos
  where 1 - (documentos.embedding <=> query_embedding) >= similarity_threshold
  order by documentos.embedding <=> query_embedding
  limit match_count;
end;
$$;
