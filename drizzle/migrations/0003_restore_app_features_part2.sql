create table if not exists public.investment_dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists investment_dividends_user_paid_at_idx on public.investment_dividends (user_id, paid_at desc);
grant select, insert, update, delete on public.investment_dividends to authenticated;
grant all on public.investment_dividends to service_role;
alter table public.investment_dividends enable row level security;
create policy "users manage own investment dividends" on public.investment_dividends for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.investments i where i.id = investment_id and i.user_id = auth.uid()));

create table if not exists public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_on date not null default current_date,
  total_value_cents numeric not null check (total_value_cents >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, captured_on)
);
grant select on public.investment_snapshots to authenticated;
grant all on public.investment_snapshots to service_role;
alter table public.investment_snapshots enable row level security;
create policy "users read own investment snapshots" on public.investment_snapshots for select to authenticated using (user_id = auth.uid());

create or replace function public.record_investment_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare affected_user_id uuid; portfolio_value numeric;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  affected_user_id := coalesce(new.user_id, old.user_id);
  select coalesce(sum(quantity * current_price_cents), 0) into portfolio_value from public.investments where user_id = affected_user_id;
  insert into public.investment_snapshots (user_id, captured_on, total_value_cents)
  values (affected_user_id, current_date, portfolio_value)
  on conflict (user_id, captured_on) do update set total_value_cents = excluded.total_value_cents;
  return null;
end; $$;
drop trigger if exists investments_record_snapshot on public.investments;
create trigger investments_record_snapshot after insert or update or delete on public.investments
  for each row execute function public.record_investment_snapshot();
insert into public.investment_snapshots (user_id, captured_on, total_value_cents)
select user_id, current_date, coalesce(sum(quantity * current_price_cents), 0) from public.investments group by user_id
on conflict (user_id, captured_on) do update set total_value_cents = excluded.total_value_cents;

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_user_created_idx on public.activity_log (user_id, created_at desc);
grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "users read own activity" on public.activity_log for select to authenticated using (user_id = auth.uid());

alter table public.categories add column if not exists type text not null default 'despesa';
update public.categories set type = 'receita' where lower(name) in ('salário', 'salario');
alter table public.categories add constraint categories_type_check check (type in ('despesa', 'receita'));

create unique index if not exists cards_user_id_id_unique on public.cards (user_id, id);
create table if not exists public.credit_card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null,
  due_month date not null check (extract(day from due_month) = 1),
  closing_date date not null,
  due_date date not null,
  created_at timestamptz not null default now(),
  constraint credit_card_invoices_user_card_month_unique unique (user_id, card_id, due_month),
  constraint credit_card_invoices_user_id_id_unique unique (user_id, id),
  constraint credit_card_invoices_user_card_fkey foreign key (user_id, card_id) references public.cards(user_id, id) on delete restrict,
  constraint credit_card_invoices_date_order check (closing_date <= due_date)
);
grant select, insert, update, delete on public.credit_card_invoices to authenticated;
grant all on public.credit_card_invoices to service_role;
alter table public.credit_card_invoices enable row level security;
create policy "own credit card invoices" on public.credit_card_invoices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists credit_card_invoices_card_month_idx on public.credit_card_invoices (user_id, card_id, due_month);

alter table public.transactions add column if not exists invoice_id uuid;
alter table public.transactions add constraint transactions_invoice_id_fkey foreign key (user_id, invoice_id) references public.credit_card_invoices(user_id, id) on delete restrict;
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in ('receita', 'despesa', 'pagamento_fatura'));
create index if not exists transactions_invoice_idx on public.transactions (invoice_id, date) where invoice_id is not null;

with purchase_cycles as (
  select t.id as transaction_id, t.user_id, t.card_id, c.closing_day, c.due_day,
    (date_trunc('month', t.date)::date + case when extract(day from t.date) > c.closing_day then interval '1 month' else interval '0 month' end)::date as closing_month
  from public.transactions t join public.cards c on c.id = t.card_id and c.user_id = t.user_id
  where t.card_id is not null and t.type = 'despesa'
), invoice_dates as (
  select transaction_id, user_id, card_id,
    (closing_month + least(closing_day, extract(day from (closing_month + interval '1 month - 1 day'))::integer) - 1)::date as closing_date,
    date_trunc('month', closing_month + case when due_day <= closing_day then interval '1 month' else interval '0 month' end)::date as due_month,
    due_day
  from purchase_cycles
)
insert into public.credit_card_invoices (user_id, card_id, due_month, closing_date, due_date)
select distinct user_id, card_id, due_month, closing_date,
  (due_month + least(due_day, extract(day from (due_month + interval '1 month - 1 day'))::integer) - 1)::date
from invoice_dates
on conflict (user_id, card_id, due_month) do nothing;

with purchase_cycles as (
  select t.id as transaction_id, t.user_id, t.card_id, c.closing_day, c.due_day,
    (date_trunc('month', t.date)::date + case when extract(day from t.date) > c.closing_day then interval '1 month' else interval '0 month' end)::date as closing_month
  from public.transactions t join public.cards c on c.id = t.card_id and c.user_id = t.user_id
  where t.card_id is not null and t.type = 'despesa' and t.invoice_id is null
), due_months as (
  select transaction_id, user_id, card_id,
    date_trunc('month', closing_month + case when due_day <= closing_day then interval '1 month' else interval '0 month' end)::date as due_month
  from purchase_cycles
)
update public.transactions as t set invoice_id = i.id
from due_months d join public.credit_card_invoices i on i.user_id = d.user_id and i.card_id = d.card_id and i.due_month = d.due_month
where t.id = d.transaction_id;

alter table public.transactions add column if not exists reference_month date;
alter table public.transactions add constraint transactions_reference_month_first_day_check check (reference_month is null or extract(day from reference_month) = 1);