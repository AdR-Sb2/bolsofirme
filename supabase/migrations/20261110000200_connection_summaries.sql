-- Resumos de conexões sem expor consultas diretas às tabelas financeiras de terceiros.
-- Execute esta migration no SQL Editor do mesmo projeto Supabase usado pelo app.

create or replace function public.get_connection_summaries()
returns table (
  connection_user_id uuid,
  banks_count bigint,
  transactions_count bigint,
  investments_count bigint,
  income_cents bigint,
  expense_cents bigint
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
