alter table public.user_settings
  add column if not exists spending_limits jsonb not null default '[]'::jsonb,
  add column if not exists savings_goals jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_spending_limits_array'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_spending_limits_array
      check (jsonb_typeof(spending_limits) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_savings_goals_array'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_savings_goals_array
      check (jsonb_typeof(savings_goals) = 'array');
  end if;
end;
$$;
