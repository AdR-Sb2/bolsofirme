alter table public.transactions
  add column if not exists status text not null default 'paga',
  add column if not exists due_date date,
  add column if not exists paid_at date,
  add column if not exists payable_series_id uuid;

update public.transactions
set status = coalesce(status, 'paga'),
    paid_at = coalesce(paid_at, date),
    due_date = coalesce(due_date, date)
where status = 'paga'
  and (paid_at is null or due_date is null);

alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('pendente', 'paga'));

alter table public.transactions
  drop constraint if exists transactions_pending_payable_check;

alter table public.transactions
  add constraint transactions_pending_payable_check
  check (
    status <> 'pendente'
    or (
      type = 'despesa'
      and amount_cents > 0
      and due_date is not null
      and paid_at is null
      and card_id is null
      and invoice_id is null
    )
  );

create table if not exists public.payable_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'encerrada')),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payable_series_user_id_id_unique unique (user_id, id)
);

alter table public.transactions
  drop constraint if exists transactions_payable_series_fkey;

alter table public.transactions
  add constraint transactions_payable_series_fkey
  foreign key (user_id, payable_series_id)
  references public.payable_series(user_id, id)
  on delete restrict;

create index if not exists transactions_user_status_due_date_idx
  on public.transactions (user_id, status, due_date)
  where status = 'pendente';

create index if not exists transactions_user_payable_series_idx
  on public.transactions (user_id, payable_series_id)
  where payable_series_id is not null;

create index if not exists payable_series_user_status_idx
  on public.payable_series (user_id, status);

grant select, insert, update, delete on public.payable_series to authenticated;
grant all on public.payable_series to service_role;
revoke all on public.payable_series from anon;
alter table public.payable_series enable row level security;

drop policy if exists "own payable series" on public.payable_series;
create policy "own payable series"
  on public.payable_series
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_payable_transaction(
  p_description text,
  p_amount_cents bigint,
  p_due_date date,
  p_category_id uuid default null,
  p_recurring boolean default false,
  p_attachment_path text default null,
  p_transaction_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid := coalesce(p_transaction_id, gen_random_uuid());
  v_series_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if nullif(btrim(p_description), '') is null
    or p_amount_cents is null
    or p_amount_cents <= 0
    or p_due_date is null then
    raise exception 'invalid payable transaction';
  end if;
  if p_category_id is not null and not exists (
    select 1
    from public.categories category
    where category.id = p_category_id
      and category.user_id = v_user_id
      and category.type = 'despesa'
  ) then
    raise exception 'invalid expense category';
  end if;
  if p_recurring then
    insert into public.payable_series (user_id, day_of_month)
    values (v_user_id, extract(day from p_due_date)::smallint)
    returning id into v_series_id;
  end if;

  insert into public.transactions (
    id, user_id, description, amount_cents, type, date, category_id,
    bank_id, card_id, invoice_id, status, due_date, paid_at,
    payable_series_id, attachment_path, paid
  ) values (
    v_transaction_id, v_user_id, btrim(p_description), p_amount_cents, 'despesa',
    p_due_date, p_category_id, null, null, null, 'pendente', p_due_date, null,
    v_series_id, p_attachment_path, false
  );
  return v_transaction_id;
end;
$$;

create or replace function public.pay_payable_transaction(
  p_transaction_id uuid,
  p_amount_cents bigint,
  p_bank_id uuid,
  p_paid_at date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_series public.payable_series%rowtype;
  v_next_due date;
  v_next_month date;
  v_balance bigint;
  v_next_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_bank_id is null or p_paid_at is null then
    raise exception 'invalid payable payment';
  end if;
  if p_paid_at > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'payment date cannot be in the future';
  end if;

  select *
    into v_transaction
    from public.transactions
   where id = p_transaction_id
     and user_id = v_user_id
   for update;
  if not found or v_transaction.status <> 'pendente' or v_transaction.type <> 'despesa' then
    raise exception 'payable transaction is unavailable';
  end if;

  perform 1
    from public.banks
   where id = p_bank_id and user_id = v_user_id
   for update;
  if not found then
    raise exception 'bank account is unavailable';
  end if;

  select bank.initial_cents
    + coalesce(sum(
        case when transaction.type = 'receita'
          then transaction.amount_cents
          else -transaction.amount_cents
        end
      ), 0)::bigint
    + coalesce((
        select sum(case when movement.type = 'aporte'
          then -movement.amount_cents
          else movement.amount_cents
        end)
        from public.savings_goal_movements movement
        where movement.user_id = v_user_id
          and movement.bank_id = bank.id
      ), 0)::bigint
    into v_balance
    from public.banks bank
    left join public.transactions transaction
      on transaction.bank_id = bank.id
     and transaction.user_id = bank.user_id
     and transaction.status = 'paga'
     and (transaction.recurrence_group_id is null or transaction.date <= (now() at time zone 'America/Sao_Paulo')::date)
   where bank.id = p_bank_id
     and bank.user_id = v_user_id
   group by bank.initial_cents;
  if v_balance < p_amount_cents then
    raise exception 'insufficient bank balance';
  end if;

  if v_transaction.payable_series_id is not null then
    select *
      into v_series
      from public.payable_series
     where id = v_transaction.payable_series_id
       and user_id = v_user_id
     for update;
  end if;

  update public.transactions
     set amount_cents = p_amount_cents,
         bank_id = p_bank_id,
         status = 'paga',
         paid_at = p_paid_at
   where id = p_transaction_id
     and user_id = v_user_id;

  if v_transaction.payable_series_id is not null and v_series.status = 'ativa' then
    v_next_month := (date_trunc('month', v_transaction.due_date)::date + interval '1 month')::date;
    v_next_due := (
      v_next_month
      + least(
          v_series.day_of_month,
          extract(day from (v_next_month + interval '1 month - 1 day'))::integer
        ) - 1
    )::date;
    insert into public.transactions (
      user_id, description, amount_cents, type, date, category_id, bank_id,
      card_id, invoice_id, paid, status, due_date, paid_at, payable_series_id
    ) values (
      v_user_id, v_transaction.description, p_amount_cents, 'despesa', v_next_due,
      v_transaction.category_id, null, null, null, false, 'pendente', v_next_due, null,
      v_transaction.payable_series_id
    )
    returning id into v_next_transaction_id;
  end if;

  return v_next_transaction_id;
end;
$$;

create or replace function public.set_payable_series_status(
  p_series_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_status is null or p_status not in ('ativa', 'pausada', 'encerrada') then
    raise exception 'invalid payable series status';
  end if;
  update public.payable_series
     set status = p_status,
         updated_at = now()
   where id = p_series_id
     and user_id = auth.uid();
  if not found then
    raise exception 'payable series is unavailable';
  end if;
end;
$$;

revoke all on function public.create_payable_transaction(text, bigint, date, uuid, boolean, text, uuid) from public;
revoke all on function public.pay_payable_transaction(uuid, bigint, uuid, date) from public;
revoke all on function public.set_payable_series_status(uuid, text) from public;
grant execute on function public.create_payable_transaction(text, bigint, date, uuid, boolean, text, uuid) to authenticated;
grant execute on function public.pay_payable_transaction(uuid, bigint, uuid, date) to authenticated;
grant execute on function public.set_payable_series_status(uuid, text) to authenticated;

create or replace function public.get_connection_summaries()
returns table (
  connection_user_id uuid,
  banks_count bigint,
  transactions_count bigint,
  investments_count bigint,
  income_cents bigint,
  expense_cents bigint,
  bank_starting_balance_cents bigint,
  investment_value_cents numeric,
  monthly_totals jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    other_user.id,
    case when coalesce(permission.share_balances, false)
      then (select count(*) from public.banks b where b.user_id = other_user.id)
      else null
    end,
    case when coalesce(permission.share_transactions, false)
      then (select count(*) from public.transactions t where t.user_id = other_user.id)
      else null
    end,
    case when coalesce(permission.share_investments, false)
      then (select count(*) from public.investments i where i.user_id = other_user.id)
      else null
    end,
    case when coalesce(permission.share_transactions, false)
      then coalesce((select sum(t.amount_cents) from public.transactions t
        where t.user_id = other_user.id and t.type = 'receita' and t.status = 'paga'), 0)
      else null
    end,
    case when coalesce(permission.share_transactions, false)
      then coalesce((select sum(t.amount_cents) from public.transactions t
        where t.user_id = other_user.id
          and t.status = 'paga'
          and (t.type = 'pagamento_fatura' or (t.type = 'despesa' and t.card_id is null))), 0)
      else null
    end,
    case when coalesce(permission.share_balances, false)
      then coalesce((select sum(b.initial_cents) from public.banks b
        where b.user_id = other_user.id), 0)
      else null
    end,
    case when coalesce(permission.share_investments, false)
      then coalesce((select sum(i.quantity * i.current_price_cents) from public.investments i
        where i.user_id = other_user.id), 0)
      else null
    end,
    case when coalesce(permission.share_transactions, false)
      then (
        select jsonb_agg(
          jsonb_build_object(
            'key', to_char(monthly.month_start, 'YYYY-MM'),
            'income', monthly.income_cents,
            'expense', monthly.expense_cents
          )
          order by monthly.month_start
        )
        from (
          select
            month_start,
            coalesce(sum(t.amount_cents) filter (
              where t.type = 'receita' and t.status = 'paga'
            ), 0) as income_cents,
            coalesce(sum(t.amount_cents) filter (
              where t.status = 'paga'
                and (
                  (t.type = 'despesa' and t.card_id is null
                    and coalesce(t.paid_at, t.date) >= month_start::date
                    and coalesce(t.paid_at, t.date) < (month_start + interval '1 month')::date)
                  or (t.type = 'pagamento_fatura'
                    and t.date >= month_start::date
                    and t.date < (month_start + interval '1 month')::date)
                )
            ), 0) as expense_cents
          from generate_series(
            date_trunc('month', current_date) - interval '5 months',
            date_trunc('month', current_date),
            interval '1 month'
          ) as months(month_start)
          left join public.transactions t
            on t.user_id = other_user.id
            and (
              (
                t.type = 'receita'
                and t.status = 'paga'
                and coalesce(t.reference_month, date_trunc('month', t.date)::date) = month_start::date
              )
              or (
                t.status = 'paga'
                and (
                  (t.type = 'despesa' and t.card_id is null
                    and coalesce(t.paid_at, t.date) >= month_start::date
                    and coalesce(t.paid_at, t.date) < (month_start + interval '1 month')::date)
                  or (t.type = 'pagamento_fatura'
                    and t.date >= month_start::date
                    and t.date < (month_start + interval '1 month')::date)
                )
              )
            )
          group by month_start
        ) monthly
      )
      else null
    end
  from public.connection_requests request
  cross join lateral (
    select case
      when request.sender_id = auth.uid() then request.recipient_id
      else request.sender_id
    end as id
  ) other_user
  left join public.connection_permissions permission
    on permission.owner_id = other_user.id
   and permission.viewer_id = auth.uid()
  where request.status = 'accepted'
    and (request.sender_id = auth.uid() or request.recipient_id = auth.uid());
$$;

revoke all on function public.get_connection_summaries() from public;
grant execute on function public.get_connection_summaries() to authenticated;
