-- Schema inicial completo do BolsoFirme para projetos Supabase novos.
-- Deve criar as tabelas financeiras antes das extensões abaixo.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🏷️',
  color text not null default '#64748b',
  created_at timestamptz not null default now()
);
create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  kind text not null default 'Conta Corrente',
  initial_cents bigint not null default 0,
  logo text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  bank text not null default '',
  brand text not null default '',
  color text not null default '#3b82f6',
  limit_cents bigint not null default 0,
  closing_day integer not null default 1,
  due_day integer not null default 10,
  created_at timestamptz not null default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  amount_cents bigint not null,
  type text not null check (type in ('receita','despesa')),
  date date not null,
  category_id uuid references public.categories(id) on delete set null,
  bank_id uuid references public.banks(id) on delete restrict,
  card_id uuid references public.cards(id) on delete restrict,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories, public.banks, public.cards, public.transactions to authenticated;
grant all on public.categories, public.banks, public.cards, public.transactions to service_role;
alter table public.categories enable row level security;
alter table public.banks enable row level security;
alter table public.cards enable row level security;
alter table public.transactions enable row level security;
create policy "own categories" on public.categories for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own banks" on public.banks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cards" on public.cards for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own transactions" on public.transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- Recursos de bancos, cartões, investimentos e conexões do BolsoFirme
alter table public.banks add column if not exists logo text not null default '';
alter table public.cards add column if not exists brand text not null default '';

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pessoa usuária',
  avatar_url text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_complete boolean not null default false,
  selected_banks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  ticker text not null default '',
  asset_type text not null default 'Ação',
  quantity numeric(20,8) not null default 0,
  average_price_cents bigint not null default 0,
  current_price_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_connection check (sender_id <> recipient_id),
  constraint unique_connection_request unique(sender_id, recipient_id)
);
create table if not exists public.connection_permissions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  share_balances boolean not null default false,
  share_transactions boolean not null default false,
  share_investments boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(owner_id, viewer_id),
  constraint no_self_permission check (owner_id <> viewer_id)
);

alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.investments enable row level security;
alter table public.connection_requests enable row level security;
alter table public.connection_permissions enable row level security;

create policy "profiles visible to signed users" on public.user_profiles for select to authenticated using (true);
create policy "users manage own profile" on public.user_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own settings" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own investments" on public.investments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shared investments readable" on public.investments for select to authenticated using (
  exists (select 1 from public.connection_requests r join public.connection_permissions p on p.owner_id = investments.user_id and p.viewer_id = auth.uid()
    where r.status = 'accepted' and ((r.sender_id = investments.user_id and r.recipient_id = auth.uid()) or (r.recipient_id = investments.user_id and r.sender_id = auth.uid())) and p.share_investments)
);
create policy "participants read requests" on public.connection_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send connection request" on public.connection_requests for insert to authenticated with check (sender_id = auth.uid());
create policy "recipient updates request" on public.connection_requests for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "users read own sharing permissions" on public.connection_permissions for select to authenticated using (owner_id = auth.uid() or viewer_id = auth.uid());
create policy "owners manage sharing permissions" on public.connection_permissions for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "shared bank balances readable" on public.banks for select to authenticated using (
  exists (select 1 from public.connection_requests r join public.connection_permissions p on p.owner_id = banks.user_id and p.viewer_id = auth.uid()
    where r.status = 'accepted' and ((r.sender_id = banks.user_id and r.recipient_id = auth.uid()) or (r.recipient_id = banks.user_id and r.sender_id = auth.uid())) and p.share_balances)
);
create policy "shared card balances readable" on public.cards for select to authenticated using (
  exists (select 1 from public.connection_requests r join public.connection_permissions p on p.owner_id = cards.user_id and p.viewer_id = auth.uid()
    where r.status = 'accepted' and ((r.sender_id = cards.user_id and r.recipient_id = auth.uid()) or (r.recipient_id = cards.user_id and r.sender_id = auth.uid())) and p.share_balances)
);
create policy "shared transactions readable" on public.transactions for select to authenticated using (
  exists (select 1 from public.connection_requests r join public.connection_permissions p on p.owner_id = transactions.user_id and p.viewer_id = auth.uid()
    where r.status = 'accepted' and ((r.sender_id = transactions.user_id and r.recipient_id = auth.uid()) or (r.recipient_id = transactions.user_id and r.sender_id = auth.uid())) and p.share_transactions)
);

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles(user_id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1), 'Pessoa usuária'), coalesce(new.raw_user_meta_data->>'avatar_url',''))
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute procedure public.create_user_profile();

-- Permissões explícitas para as tabelas complementares.
grant select, insert, update, delete on public.user_profiles, public.user_settings,
  public.investments, public.connection_requests, public.connection_permissions to authenticated;
grant all on public.user_profiles, public.user_settings, public.investments,
  public.connection_requests, public.connection_permissions to service_role;
create index if not exists investments_user_id_idx on public.investments(user_id);
