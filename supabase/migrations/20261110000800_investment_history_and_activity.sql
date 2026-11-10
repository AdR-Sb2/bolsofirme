create table if not exists public.investment_dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists investment_dividends_user_paid_at_idx
  on public.investment_dividends (user_id, paid_at desc);

alter table public.investment_dividends enable row level security;
grant select, insert, update, delete on public.investment_dividends to authenticated;

drop policy if exists "users manage own investment dividends" on public.investment_dividends;
create policy "users manage own investment dividends"
  on public.investment_dividends
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.investments i
      where i.id = investment_id and i.user_id = auth.uid()
    )
  );

create table if not exists public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_on date not null default current_date,
  total_value_cents numeric not null check (total_value_cents >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, captured_on)
);

alter table public.investment_snapshots enable row level security;
grant select on public.investment_snapshots to authenticated;
drop policy if exists "users read own investment snapshots" on public.investment_snapshots;
create policy "users read own investment snapshots"
  on public.investment_snapshots
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.record_investment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user_id uuid;
  portfolio_value numeric;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  affected_user_id := coalesce(new.user_id, old.user_id);
  select coalesce(sum(quantity * current_price_cents), 0)
    into portfolio_value
    from public.investments
    where user_id = affected_user_id;

  insert into public.investment_snapshots (user_id, captured_on, total_value_cents)
  values (affected_user_id, current_date, portfolio_value)
  on conflict (user_id, captured_on)
  do update set total_value_cents = excluded.total_value_cents;
  return null;
end;
$$;

drop trigger if exists investments_record_snapshot on public.investments;
create trigger investments_record_snapshot
  after insert or update or delete on public.investments
  for each row execute function public.record_investment_snapshot();

insert into public.investment_snapshots (user_id, captured_on, total_value_cents)
select user_id, current_date, coalesce(sum(quantity * current_price_cents), 0)
from public.investments
group by user_id
on conflict (user_id, captured_on)
do update set total_value_cents = excluded.total_value_cents;

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);

alter table public.activity_log enable row level security;
grant select on public.activity_log to authenticated;
drop policy if exists "users read own activity" on public.activity_log;
create policy "users read own activity"
  on public.activity_log
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.log_financial_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  affected_user_id uuid;
  entity_name text;
  entity_label text;
  action_name text;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  affected_user_id := (row_data ->> 'user_id')::uuid;
  action_name := lower(tg_op);
  entity_name := case tg_table_name
    when 'transactions' then 'transação'
    when 'banks' then 'banco'
    when 'cards' then 'cartão'
    when 'categories' then 'categoria'
    when 'investments' then 'investimento'
    when 'investment_dividends' then 'provento'
    when 'user_settings' then 'planejamento financeiro'
    else tg_table_name
  end;
  entity_label := case
    when tg_table_name = 'user_settings' then 'limites e metas'
    else coalesce(
      nullif(row_data ->> 'description', ''),
      nullif(row_data ->> 'name', ''),
      nullif(row_data ->> 'ticker', ''),
      nullif(row_data ->> 'note', ''),
      'registro'
    )
  end;

  if action_name = 'update' and exists (
    select 1
    from public.activity_log log_entry
    where log_entry.user_id = affected_user_id
      and log_entry.entity_type = tg_table_name
      and log_entry.action = 'updated'
      and log_entry.summary = 'Atualizou ' || entity_name || ': ' || entity_label
      and log_entry.created_at >= now() - interval '30 seconds'
  ) then
    return null;
  end if;

  insert into public.activity_log (user_id, entity_type, action, summary)
  values (
    affected_user_id,
    tg_table_name,
    case action_name when 'insert' then 'created' when 'update' then 'updated' else 'deleted' end,
    case action_name
      when 'insert' then 'Criou ' || entity_name || ': ' || entity_label
      when 'update' then 'Atualizou ' || entity_name || ': ' || entity_label
      else 'Excluiu ' || entity_name || ': ' || entity_label
    end
  );
  return null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'transactions',
    'banks',
    'cards',
    'categories',
    'investments',
    'investment_dividends',
    'user_settings'
  ]
  loop
    execute format('drop trigger if exists log_financial_activity on public.%I', table_name);
    execute format(
      'create trigger log_financial_activity after insert or update or delete on public.%I for each row execute function public.log_financial_activity()',
      table_name
    );
  end loop;
end;
$$;
