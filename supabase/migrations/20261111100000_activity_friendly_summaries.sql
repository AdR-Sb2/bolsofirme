-- Reescreve o resumo das atividades em linguagem simples e amigável.
-- Ex.: "Você adicionou R$ 18,50 em Alimentação", "Você editou o banco Inter".
-- Mantém a proteção contra duplicação de edições em massa (30 segundos).

create or replace function public.cents_to_brl_text(p_cents bigint)
returns text
language sql
immutable
as $$
  select to_char(floor(abs(p_cents) / 100), 'FM999999999999')
    || ','
    || lpad((abs(p_cents) % 100)::text, 2, '0')
$$;

create or replace function public.log_financial_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  affected_user_id uuid;
  action_name text;
  entity_label text;
  summary_text text;
  category_name text;
  amount_cents bigint;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  affected_user_id := (row_data ->> 'user_id')::uuid;
  action_name := lower(tg_op);

  entity_label := coalesce(
    nullif(row_data ->> 'description', ''),
    nullif(row_data ->> 'name', ''),
    nullif(row_data ->> 'ticker', ''),
    nullif(row_data ->> 'note', ''),
    'registro'
  );

  if tg_table_name = 'transactions' then
    amount_cents := coalesce(nullif(row_data ->> 'amount_cents', '')::bigint, 0);
    select c.name
      into category_name
      from public.categories c
      where c.id = nullif(row_data ->> 'category_id', '')::uuid;
    category_name := coalesce(category_name, 'Sem categoria');

    summary_text := case action_name
      when 'insert' then case row_data ->> 'type'
        when 'despesa' then 'Você adicionou R$ ' || public.cents_to_brl_text(amount_cents) || ' em ' || category_name
        when 'receita' then 'Você recebeu R$ ' || public.cents_to_brl_text(amount_cents) || ' em ' || category_name
        else 'Você registrou a transação “' || entity_label || '”'
      end
      when 'update' then 'Você editou a transação “' || entity_label || '”'
      else 'Você excluiu a transação “' || entity_label || '”'
    end;
  elsif tg_table_name = 'banks' then
    summary_text := case action_name
      when 'insert' then 'Você cadastrou o banco ' || entity_label
      when 'update' then 'Você editou o banco ' || entity_label
      else 'Você excluiu o banco ' || entity_label
    end;
  elsif tg_table_name = 'cards' then
    summary_text := case action_name
      when 'insert' then 'Você cadastrou o cartão ' || entity_label
      when 'update' then 'Você editou o cartão ' || entity_label
      else 'Você excluiu o cartão ' || entity_label
    end;
  elsif tg_table_name = 'categories' then
    summary_text := case action_name
      when 'insert' then 'Você criou a categoria ' || entity_label
      when 'update' then 'Você editou a categoria ' || entity_label
      else 'Você excluiu a categoria ' || entity_label
    end;
  elsif tg_table_name = 'investments' then
    summary_text := case action_name
      when 'insert' then 'Você cadastrou o investimento ' || entity_label
      when 'update' then 'Você editou o investimento ' || entity_label
      else 'Você excluiu o investimento ' || entity_label
    end;
  elsif tg_table_name = 'investment_dividends' then
    summary_text := case action_name
      when 'insert' then 'Você registrou um provento de ' || entity_label
      when 'update' then 'Você editou o provento de ' || entity_label
      else 'Você excluiu o provento de ' || entity_label
    end;
  elsif tg_table_name = 'user_settings' then
    summary_text := case action_name
      when 'insert' then 'Você configurou seus limites e metas'
      when 'update' then 'Você atualizou seus limites e metas'
      else 'Você removeu seus limites e metas'
    end;
  else
    summary_text := case action_name
      when 'insert' then 'Você criou ' || tg_table_name || ' ' || entity_label
      when 'update' then 'Você editou ' || tg_table_name || ' ' || entity_label
      else 'Você excluiu ' || tg_table_name || ' ' || entity_label
    end;
  end if;

  if action_name = 'update' and exists (
    select 1
    from public.activity_log log_entry
    where log_entry.user_id = affected_user_id
      and log_entry.entity_type = tg_table_name
      and log_entry.action = 'updated'
      and log_entry.summary = summary_text
      and log_entry.created_at >= now() - interval '30 seconds'
  ) then
    return null;
  end if;

  insert into public.activity_log (user_id, entity_type, action, summary)
  values (
    affected_user_id,
    tg_table_name,
    case action_name when 'insert' then 'created' when 'update' then 'updated' else 'deleted' end,
    summary_text
  );
  return null;
end;
$$;
