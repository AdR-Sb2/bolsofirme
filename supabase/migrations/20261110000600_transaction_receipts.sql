alter table public.transactions
  add column if not exists attachment_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-receipts',
  'transaction-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "Users can view their transaction receipts" on storage.objects;
create policy "Users can view their transaction receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their transaction receipts" on storage.objects;
create policy "Users can upload their transaction receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transaction-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their transaction receipts" on storage.objects;
create policy "Users can update their transaction receipts"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'transaction-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their transaction receipts" on storage.objects;
create policy "Users can delete their transaction receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
