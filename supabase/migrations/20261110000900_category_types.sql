alter table public.categories
  add column if not exists type text not null default 'despesa';

update public.categories
set type = 'receita'
where lower(name) in ('salário', 'salario');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_type_check'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_type_check
      check (type in ('despesa', 'receita'));
  end if;
end;
$$;
