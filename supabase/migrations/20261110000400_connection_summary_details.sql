drop function if exists public.get_connection_summaries();

create function public.get_connection_summaries()
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
        where t.user_id = other_user.id and t.type = 'receita'), 0)
      else null
    end,
    case when coalesce(permission.share_transactions, false)
      then coalesce((select sum(t.amount_cents) from public.transactions t
        where t.user_id = other_user.id and t.type = 'despesa'), 0)
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
            coalesce(sum(t.amount_cents) filter (where t.type = 'receita'), 0) as income_cents,
            coalesce(sum(t.amount_cents) filter (where t.type = 'despesa'), 0) as expense_cents
          from generate_series(
            date_trunc('month', current_date) - interval '5 months',
            date_trunc('month', current_date),
            interval '1 month'
          ) as months(month_start)
          left join public.transactions t
            on t.user_id = other_user.id
            and t.date >= month_start::date
            and t.date < (month_start + interval '1 month')::date
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
