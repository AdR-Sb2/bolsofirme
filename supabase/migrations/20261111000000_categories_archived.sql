-- Categorias arquivadas: arquivar preserva o histórico de transações
-- em vez de deixar lançamentos sem categoria ao excluir.
alter table public.categories
  add column if not exists archived boolean not null default false;

-- Índice para listar rapidamente as categorias ativas de cada dono.
create index if not exists categories_user_archived_idx
  on public.categories (user_id, archived);
