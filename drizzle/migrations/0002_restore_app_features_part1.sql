drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.transactions
  add column if not exists installment_group_id uuid,
  add column if not exists installment_number smallint not null default 1,
  add column if not exists installment_count smallint not null default 1;
alter table public.transactions add constraint transactions_installment_number_check check (
  installment_count between 1 and 36 and installment_number between 1 and installment_count
  and ((installment_count = 1 and installment_group_id is null) or (installment_count > 1 and installment_group_id is not null)));
create index if not exists transactions_installment_group_idx on public.transactions (installment_group_id) where installment_group_id is not null;
create index if not exists transactions_card_invoice_idx on public.transactions (card_id, date, paid) where card_id is not null;

alter table public.transactions
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_number smallint not null default 1,
  add column if not exists recurrence_count smallint not null default 1;
alter table public.transactions add constraint transactions_recurrence_check check (
  recurrence_count between 1 and 36 and recurrence_number between 1 and recurrence_count
  and not (recurrence_count > 1 and installment_count > 1)
  and ((recurrence_count = 1 and recurrence_group_id is null and recurrence_frequency is null)
    or (recurrence_count > 1 and recurrence_group_id is not null and recurrence_frequency is not null and recurrence_frequency in ('weekly','monthly','yearly'))));
create index if not exists transactions_recurrence_group_idx on public.transactions (recurrence_group_id) where recurrence_group_id is not null;

alter table public.transactions add column if not exists attachment_path text;
drop policy if exists "Users can view their transaction receipts" on storage.objects;
create policy "Users can view their transaction receipts" on storage.objects for select to authenticated
  using (bucket_id = 'transaction-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can upload their transaction receipts" on storage.objects;
create policy "Users can upload their transaction receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'transaction-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update their transaction receipts" on storage.objects;
create policy "Users can update their transaction receipts" on storage.objects for update to authenticated
  using (bucket_id = 'transaction-receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'transaction-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their transaction receipts" on storage.objects;
create policy "Users can delete their transaction receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'transaction-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.user_settings
  add column if not exists spending_limits jsonb not null default '[]'::jsonb,
  add column if not exists savings_goals jsonb not null default '[]'::jsonb;
alter table public.user_settings add constraint user_settings_spending_limits_array check (jsonb_typeof(spending_limits) = 'array');
alter table public.user_settings add constraint user_settings_savings_goals_array check (jsonb_typeof(savings_goals) = 'array');