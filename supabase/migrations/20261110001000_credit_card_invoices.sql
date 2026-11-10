create unique index if not exists cards_user_id_id_unique
  on public.cards (user_id, id);

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
  constraint credit_card_invoices_user_card_fkey
    foreign key (user_id, card_id)
    references public.cards(user_id, id)
    on delete restrict,
  constraint credit_card_invoices_date_order check (closing_date <= due_date)
);

grant select, insert, update, delete on public.credit_card_invoices to authenticated;
grant all on public.credit_card_invoices to service_role;
revoke all on public.credit_card_invoices from anon;
alter table public.credit_card_invoices enable row level security;
create policy "own credit card invoices"
  on public.credit_card_invoices
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists credit_card_invoices_card_month_idx
  on public.credit_card_invoices (user_id, card_id, due_month);

alter table public.transactions
  add column if not exists invoice_id uuid;

alter table public.transactions
  drop constraint if exists transactions_invoice_id_fkey;

alter table public.transactions
  add constraint transactions_invoice_id_fkey
  foreign key (user_id, invoice_id)
  references public.credit_card_invoices(user_id, id)
  on delete restrict;

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('receita', 'despesa', 'pagamento_fatura'));

create index if not exists transactions_invoice_idx
  on public.transactions (invoice_id, date)
  where invoice_id is not null;

with purchase_cycles as (
  select
    transaction.id as transaction_id,
    transaction.user_id,
    transaction.card_id,
    card.closing_day,
    card.due_day,
    (
      date_trunc('month', transaction.date)::date
      + case
          when extract(day from transaction.date) > card.closing_day then interval '1 month'
          else interval '0 month'
        end
    )::date as closing_month
  from public.transactions as transaction
  join public.cards as card
    on card.id = transaction.card_id
   and card.user_id = transaction.user_id
  where transaction.card_id is not null
    and transaction.type = 'despesa'
),
invoice_dates as (
  select
    transaction_id,
    user_id,
    card_id,
    (closing_month + least(
      closing_day,
      extract(day from (closing_month + interval '1 month - 1 day'))::integer
    ) - 1)::date as closing_date,
    date_trunc(
      'month',
      closing_month + case
        when due_day <= closing_day then interval '1 month'
        else interval '0 month'
      end
    )::date as due_month,
    due_day
  from purchase_cycles
)
insert into public.credit_card_invoices (
  user_id,
  card_id,
  due_month,
  closing_date,
  due_date
)
select distinct
  user_id,
  card_id,
  due_month,
  closing_date,
  (due_month + least(
    due_day,
    extract(day from (due_month + interval '1 month - 1 day'))::integer
  ) - 1)::date
from invoice_dates
on conflict (user_id, card_id, due_month) do nothing;

with purchase_cycles as (
  select
    transaction.id as transaction_id,
    transaction.user_id,
    transaction.card_id,
    card.closing_day,
    card.due_day,
    (
      date_trunc('month', transaction.date)::date
      + case
          when extract(day from transaction.date) > card.closing_day then interval '1 month'
          else interval '0 month'
        end
    )::date as closing_month
  from public.transactions as transaction
  join public.cards as card
    on card.id = transaction.card_id
   and card.user_id = transaction.user_id
  where transaction.card_id is not null
    and transaction.type = 'despesa'
    and transaction.invoice_id is null
),
due_months as (
  select
    transaction_id,
    user_id,
    card_id,
    date_trunc(
      'month',
      closing_month + case
        when due_day <= closing_day then interval '1 month'
        else interval '0 month'
      end
    )::date as due_month
  from purchase_cycles
)
update public.transactions as transaction
set invoice_id = invoice.id
from due_months
join public.credit_card_invoices as invoice
  on invoice.user_id = due_months.user_id
 and invoice.card_id = due_months.card_id
 and invoice.due_month = due_months.due_month
where transaction.id = due_months.transaction_id;

update public.transactions as transaction
set type = 'pagamento_fatura',
    category_id = null
where transaction.type = 'despesa'
  and transaction.category_id in (
    select category.id
    from public.categories as category
    where lower(category.name) in ('salário', 'salario')
  )
  and lower(regexp_replace(btrim(transaction.description), '[[:space:][:punct:]]+', ' ', 'g'))
    in ('fatura paga', 'pagamento fatura', 'pagamento da fatura', 'pagamento de fatura');
