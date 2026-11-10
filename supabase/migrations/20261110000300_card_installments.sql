alter table public.transactions
  add column if not exists installment_group_id uuid,
  add column if not exists installment_number smallint not null default 1,
  add column if not exists installment_count smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_installment_number_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_installment_number_check
      check (
        installment_count between 1 and 36
        and installment_number between 1 and installment_count
        and (
          (installment_count = 1 and installment_group_id is null)
          or (installment_count > 1 and installment_group_id is not null)
        )
      );
  end if;
end
$$;

create index if not exists transactions_installment_group_idx
  on public.transactions (installment_group_id)
  where installment_group_id is not null;

create index if not exists transactions_card_invoice_idx
  on public.transactions (card_id, date, paid)
  where card_id is not null;
