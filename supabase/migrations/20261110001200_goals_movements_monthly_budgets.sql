create unique index if not exists banks_user_id_id_unique
  on public.banks (user_id, id);

create unique index if not exists categories_user_id_id_unique
  on public.categories (user_id, id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  deadline date,
  icon text not null default '🎯',
  color text not null default '#22c55e',
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluida', 'arquivada')),
  legacy_balance_cents bigint not null default 0 check (legacy_balance_cents >= 0),
  created_at timestamptz not null default now(),
  constraint savings_goals_user_id_id_unique unique (user_id, id)
);

create table if not exists public.savings_goal_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null,
  type text not null check (type in ('aporte', 'resgate')),
  amount_cents bigint not null check (amount_cents > 0),
  date date not null default current_date,
  bank_id uuid not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint savings_goal_movements_user_goal_fkey
    foreign key (user_id, goal_id)
    references public.savings_goals(user_id, id)
    on delete restrict,
  constraint savings_goal_movements_user_bank_fkey
    foreign key (user_id, bank_id)
    references public.banks(user_id, id)
    on delete restrict
);

create table if not exists public.spending_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  constraint spending_budgets_user_category_fkey
    foreign key (user_id, category_id)
    references public.categories(user_id, id)
    on delete restrict,
  constraint spending_budgets_user_category_month_unique
    unique (user_id, category_id, month)
);

grant select, insert, update, delete
  on public.savings_goals, public.savings_goal_movements, public.spending_budgets
  to authenticated;
grant all
  on public.savings_goals, public.savings_goal_movements, public.spending_budgets
  to service_role;
revoke all
  on public.savings_goals, public.savings_goal_movements, public.spending_budgets
  from anon;

alter table public.savings_goals enable row level security;
alter table public.savings_goal_movements enable row level security;
alter table public.spending_budgets enable row level security;

create policy "own savings goals"
  on public.savings_goals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own savings goal movements"
  on public.savings_goal_movements for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.savings_goals goal
      where goal.id = goal_id and goal.user_id = auth.uid()
    )
    and exists (
      select 1 from public.banks bank
      where bank.id = bank_id and bank.user_id = auth.uid()
    )
  );

create policy "own spending budgets"
  on public.spending_budgets for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.categories category
      where category.id = category_id
        and category.user_id = auth.uid()
        and category.type = 'despesa'
    )
  );

create index if not exists savings_goal_movements_user_goal_date_idx
  on public.savings_goal_movements (user_id, goal_id, date desc);
create index if not exists savings_goal_movements_user_bank_date_idx
  on public.savings_goal_movements (user_id, bank_id, date desc);
create index if not exists spending_budgets_user_month_idx
  on public.spending_budgets (user_id, month);

insert into public.spending_budgets (user_id, category_id, month, amount_cents)
select
  settings.user_id,
  (item.value ->> 'categoryId')::uuid,
  date_trunc('month', current_date)::date,
  (item.value ->> 'amountCents')::bigint
from public.user_settings settings
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(settings.spending_limits) = 'array' then settings.spending_limits
    else '[]'::jsonb
  end
) as item(value)
join public.categories category
  on category.id = case
    when item.value ->> 'categoryId' ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (item.value ->> 'categoryId')::uuid
    else null
  end
 and category.user_id = settings.user_id
 and category.type = 'despesa'
where item.value ->> 'amountCents' ~ '^[1-9][0-9]*$'
on conflict (user_id, category_id, month) do nothing;

insert into public.savings_goals (
  id, user_id, name, target_cents, legacy_balance_cents, status
)
select
  case
    when item.value ->> 'id' ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (item.value ->> 'id')::uuid
    else gen_random_uuid()
  end,
  settings.user_id,
  btrim(item.value ->> 'name'),
  (item.value ->> 'targetCents')::bigint,
  (item.value ->> 'savedCents')::bigint,
  case
    when (item.value ->> 'savedCents')::bigint >= (item.value ->> 'targetCents')::bigint
      then 'concluida'
    else 'em_andamento'
  end
from public.user_settings settings
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(settings.savings_goals) = 'array' then settings.savings_goals
    else '[]'::jsonb
  end
) as item(value)
where jsonb_typeof(item.value) = 'object'
  and nullif(btrim(item.value ->> 'name'), '') is not null
  and item.value ->> 'targetCents' ~ '^[1-9][0-9]*$'
  and item.value ->> 'savedCents' ~ '^[0-9]+$'
on conflict (user_id, id) do nothing;

create or replace function public.create_savings_goal_movement(
  p_goal_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_bank_id uuid,
  p_date date,
  p_note text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  goal_row public.savings_goals%rowtype;
  account_balance bigint;
  goal_balance bigint;
  movement_id uuid;
begin
  if owner_id is null then
    raise exception 'authentication required';
  end if;
  if p_type not in ('aporte', 'resgate') or p_amount_cents <= 0 then
    raise exception 'invalid movement';
  end if;

  select * into goal_row
  from public.savings_goals
  where id = p_goal_id and user_id = owner_id
  for update;
  if not found or goal_row.status = 'arquivada' then
    raise exception 'goal unavailable';
  end if;

  perform 1 from public.banks
  where id = p_bank_id and user_id = owner_id
  for update;
  if not found then
    raise exception 'account unavailable';
  end if;

  select bank.initial_cents
    + coalesce((
        select sum(case when tx.type = 'receita'
          then tx.amount_cents else -tx.amount_cents end)
        from public.transactions tx
        where tx.user_id = owner_id
          and tx.bank_id = p_bank_id
          and (tx.recurrence_group_id is null or tx.date <= current_date)
      ), 0)
    + coalesce((
        select sum(case when movement.type = 'aporte'
          then -movement.amount_cents else movement.amount_cents end)
        from public.savings_goal_movements movement
        where movement.user_id = owner_id and movement.bank_id = p_bank_id
      ), 0)
  into account_balance
  from public.banks bank
  where bank.id = p_bank_id and bank.user_id = owner_id;

  if p_type = 'aporte' then
    if p_amount_cents > account_balance then
      raise exception 'insufficient account balance';
    end if;
  else
    select coalesce(sum(case when type = 'aporte' then amount_cents else -amount_cents end), 0)
      into goal_balance
    from public.savings_goal_movements
    where user_id = owner_id and goal_id = p_goal_id;
    if p_amount_cents > goal_balance then
      raise exception 'insufficient goal balance';
    end if;
  end if;

  insert into public.savings_goal_movements
    (user_id, goal_id, type, amount_cents, bank_id, date, note)
  values
    (owner_id, p_goal_id, p_type, p_amount_cents, p_bank_id, coalesce(p_date, current_date), coalesce(p_note, ''))
  returning id into movement_id;

  select coalesce(sum(case when type = 'aporte' then amount_cents else -amount_cents end), 0)
    into goal_balance
  from public.savings_goal_movements
  where user_id = owner_id and goal_id = p_goal_id;
  if goal_balance + goal_row.legacy_balance_cents >= goal_row.target_cents then
    update public.savings_goals set status = 'concluida'
    where id = p_goal_id and user_id = owner_id and status <> 'arquivada';
  end if;

  return movement_id;
end;
$$;

create or replace function public.reconcile_legacy_savings_goal(
  p_goal_id uuid,
  p_bank_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  goal_row public.savings_goals%rowtype;
  account_balance bigint;
  goal_balance bigint;
  movement_id uuid;
begin
  if owner_id is null then
    raise exception 'authentication required';
  end if;

  select * into goal_row
  from public.savings_goals
  where id = p_goal_id and user_id = owner_id
  for update;
  if not found or goal_row.legacy_balance_cents <= 0 then
    raise exception 'legacy balance unavailable';
  end if;

  perform 1 from public.banks
  where id = p_bank_id and user_id = owner_id
  for update;
  if not found then
    raise exception 'account unavailable';
  end if;

  select bank.initial_cents
    + coalesce((
        select sum(case when tx.type = 'receita'
          then tx.amount_cents else -tx.amount_cents end)
        from public.transactions tx
        where tx.user_id = owner_id
          and tx.bank_id = p_bank_id
          and (tx.recurrence_group_id is null or tx.date <= current_date)
      ), 0)
    + coalesce((
        select sum(case when movement.type = 'aporte'
          then -movement.amount_cents else movement.amount_cents end)
        from public.savings_goal_movements movement
        where movement.user_id = owner_id and movement.bank_id = p_bank_id
      ), 0)
  into account_balance
  from public.banks bank
  where bank.id = p_bank_id and bank.user_id = owner_id;

  if goal_row.legacy_balance_cents > account_balance then
    raise exception 'insufficient account balance';
  end if;

  insert into public.savings_goal_movements
    (user_id, goal_id, type, amount_cents, bank_id, date, note)
  values
    (owner_id, p_goal_id, 'aporte', goal_row.legacy_balance_cents, p_bank_id, current_date, 'Saldo anterior conciliado')
  returning id into movement_id;

  update public.savings_goals
  set legacy_balance_cents = 0
  where id = p_goal_id and user_id = owner_id;

  select coalesce(sum(case when type = 'aporte' then amount_cents else -amount_cents end), 0)
    into goal_balance
  from public.savings_goal_movements
  where user_id = owner_id and goal_id = p_goal_id;
  if goal_balance >= goal_row.target_cents then
    update public.savings_goals set status = 'concluida'
    where id = p_goal_id and user_id = owner_id and status <> 'arquivada';
  end if;

  return movement_id;
end;
$$;

create or replace function public.update_savings_goal_movement(
  p_movement_id uuid,
  p_amount_cents bigint,
  p_date date,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  movement_row public.savings_goal_movements%rowtype;
  goal_row public.savings_goals%rowtype;
  account_balance bigint;
  goal_balance bigint;
  adjusted_account_balance bigint;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if p_amount_cents <= 0 then raise exception 'invalid movement'; end if;

  select * into movement_row
  from public.savings_goal_movements
  where id = p_movement_id and user_id = owner_id
  for update;
  if not found then raise exception 'movement unavailable'; end if;

  select * into goal_row
  from public.savings_goals
  where id = movement_row.goal_id and user_id = owner_id
  for update;
  perform 1 from public.banks
  where id = movement_row.bank_id and user_id = owner_id
  for update;

  select bank.initial_cents
    + coalesce((
        select sum(case when tx.type = 'receita'
          then tx.amount_cents else -tx.amount_cents end)
        from public.transactions tx
        where tx.user_id = owner_id
          and tx.bank_id = movement_row.bank_id
          and (tx.recurrence_group_id is null or tx.date <= current_date)
      ), 0)
    + coalesce((
        select sum(case when movement.type = 'aporte'
          then -movement.amount_cents else movement.amount_cents end)
        from public.savings_goal_movements movement
        where movement.user_id = owner_id and movement.bank_id = movement_row.bank_id
      ), 0)
  into account_balance
  from public.banks bank
  where bank.id = movement_row.bank_id and bank.user_id = owner_id;

  adjusted_account_balance := account_balance + case
    when movement_row.type = 'aporte' then movement_row.amount_cents - p_amount_cents
    else p_amount_cents - movement_row.amount_cents
  end;
  if adjusted_account_balance < 0 then raise exception 'insufficient account balance'; end if;

  select coalesce(sum(case when type = 'aporte' then amount_cents else -amount_cents end), 0)
    - case when movement_row.type = 'aporte' then movement_row.amount_cents else -movement_row.amount_cents end
    into goal_balance
  from public.savings_goal_movements
  where user_id = owner_id and goal_id = movement_row.goal_id;
  if movement_row.type = 'resgate' and p_amount_cents > goal_balance then
    raise exception 'insufficient goal balance';
  end if;

  update public.savings_goal_movements
  set amount_cents = p_amount_cents,
      date = coalesce(p_date, movement_row.date),
      note = coalesce(p_note, '')
  where id = p_movement_id and user_id = owner_id;

  goal_balance := goal_balance + case
    when movement_row.type = 'aporte' then p_amount_cents else -p_amount_cents
  end;
  if goal_balance + goal_row.legacy_balance_cents >= goal_row.target_cents then
    update public.savings_goals set status = 'concluida'
    where id = movement_row.goal_id and user_id = owner_id and status <> 'arquivada';
  elsif goal_row.status = 'concluida' then
    update public.savings_goals set status = 'em_andamento'
    where id = movement_row.goal_id and user_id = owner_id;
  end if;
end;
$$;

create or replace function public.delete_savings_goal_movement(p_movement_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  movement_row public.savings_goal_movements%rowtype;
  goal_row public.savings_goals%rowtype;
  account_balance bigint;
  goal_balance bigint;
begin
  if owner_id is null then raise exception 'authentication required'; end if;

  select * into movement_row
  from public.savings_goal_movements
  where id = p_movement_id and user_id = owner_id
  for update;
  if not found then raise exception 'movement unavailable'; end if;

  select * into goal_row
  from public.savings_goals
  where id = movement_row.goal_id and user_id = owner_id
  for update;
  perform 1 from public.banks
  where id = movement_row.bank_id and user_id = owner_id
  for update;

  select bank.initial_cents
    + coalesce((
        select sum(case when tx.type = 'receita'
          then tx.amount_cents else -tx.amount_cents end)
        from public.transactions tx
        where tx.user_id = owner_id
          and tx.bank_id = movement_row.bank_id
          and (tx.recurrence_group_id is null or tx.date <= current_date)
      ), 0)
    + coalesce((
        select sum(case when movement.type = 'aporte'
          then -movement.amount_cents else movement.amount_cents end)
        from public.savings_goal_movements movement
        where movement.user_id = owner_id and movement.bank_id = movement_row.bank_id
      ), 0)
  into account_balance
  from public.banks bank
  where bank.id = movement_row.bank_id and bank.user_id = owner_id;

  if movement_row.type = 'resgate' and account_balance < movement_row.amount_cents then
    raise exception 'insufficient account balance';
  end if;

  select coalesce(sum(case when type = 'aporte' then amount_cents else -amount_cents end), 0)
    - case when movement_row.type = 'aporte' then movement_row.amount_cents else -movement_row.amount_cents end
    into goal_balance
  from public.savings_goal_movements
  where user_id = owner_id and goal_id = movement_row.goal_id;
  if goal_balance + goal_row.legacy_balance_cents < 0 then
    raise exception 'movement required by later rescues';
  end if;

  delete from public.savings_goal_movements
  where id = p_movement_id and user_id = owner_id;

  if goal_balance + goal_row.legacy_balance_cents >= goal_row.target_cents then
    update public.savings_goals set status = 'concluida'
    where id = movement_row.goal_id and user_id = owner_id and status <> 'arquivada';
  elsif goal_row.status = 'concluida' then
    update public.savings_goals set status = 'em_andamento'
    where id = movement_row.goal_id and user_id = owner_id;
  end if;
end;
$$;

revoke all on function public.create_savings_goal_movement(uuid, text, bigint, uuid, date, text) from public, anon;
revoke all on function public.reconcile_legacy_savings_goal(uuid, uuid) from public, anon;
revoke all on function public.update_savings_goal_movement(uuid, bigint, date, text) from public, anon;
revoke all on function public.delete_savings_goal_movement(uuid) from public, anon;
grant execute on function public.create_savings_goal_movement(uuid, text, bigint, uuid, date, text) to authenticated;
grant execute on function public.reconcile_legacy_savings_goal(uuid, uuid) to authenticated;
grant execute on function public.update_savings_goal_movement(uuid, bigint, date, text) to authenticated;
grant execute on function public.delete_savings_goal_movement(uuid) to authenticated;
