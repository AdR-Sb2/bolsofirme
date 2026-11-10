alter table public.transactions
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_number smallint not null default 1,
  add column if not exists recurrence_count smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_recurrence_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_recurrence_check
      check (
        recurrence_count between 1 and 36
        and recurrence_number between 1 and recurrence_count
        and not (recurrence_count > 1 and installment_count > 1)
        and (
          (
            recurrence_count = 1
            and recurrence_group_id is null
            and recurrence_frequency is null
          )
          or (
            recurrence_count > 1
            and recurrence_group_id is not null
            and recurrence_frequency is not null
            and recurrence_frequency in ('weekly', 'monthly', 'yearly')
          )
        )
      );
  end if;
end
$$;

create index if not exists transactions_recurrence_group_idx
  on public.transactions (recurrence_group_id)
  where recurrence_group_id is not null;
