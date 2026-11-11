import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleHelp,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker, PageTitle, useTxDialog } from "@/components/AppShell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { budgetStatus, getMonthlySpendingByCategory, type SpendingBudget } from "@/lib/planning";
import {
  bankBalance,
  brl,
  categoryName,
  fmtDate,
  isCashOutflow,
  isPendingPayable,
  monthKey,
  monthTotals,
  netWorthCents,
  transactionCashDate,
  transactionReferenceMonth,
  useStore,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — BolsoFirme" },
      {
        name: "description",
        content: "Resumo do seu mês: saldos, contas a pagar, orçamento e últimas transações.",
      },
      { property: "og:title", content: "Início — BolsoFirme" },
      {
        property: "og:description",
        content: "Resumo do seu mês: saldos, contas a pagar, orçamento e últimas transações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const s = useStore();
  const open = useTxDialog();
  const [date, setDate] = useState(() => new Date());
  const [investmentAssetsCents, setInvestmentAssetsCents] = useState(0);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [monthlyBudgets, setMonthlyBudgets] = useState<SpendingBudget[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("No authenticated user.");
        const { data, error } = await supabase
          .from("investments")
          .select("user_id,quantity,current_price_cents")
          .eq("user_id", user.id);
        if (error) throw error;
        if (active) {
          setInvestmentAssetsCents(
            (data ?? []).reduce(
              (sum, asset) => sum + asset.quantity * asset.current_price_cents,
              0,
            ),
          );
        }
      } catch (error) {
        console.error("[Home] Failed to load investment assets for net worth.", error);
        if (active) toast.error("Não foi possível calcular o patrimônio total dos investimentos.");
      } finally {
        if (active) setAssetsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("No authenticated user.");
        const month = monthKey(date);
        const { data, error } = await supabase
          .from("spending_budgets")
          .select("*")
          .eq("user_id", user.id)
          .eq("month", `${month}-01`);
        if (error) throw error;
        if (active) {
          setMonthlyBudgets(
            (data ?? []).map((budget) => ({
              id: budget.id,
              categoryId: budget.category_id,
              month: budget.month.slice(0, 7),
              amountCents: Number(budget.amount_cents),
            })),
          );
        }
      } catch (error) {
        console.error("[Home] Failed to load spending limits.", error);
        if (active) toast.error("Não foi possível carregar os limites de gastos.");
      }
    })();
    return () => {
      active = false;
    };
  }, [date]);
  const month = monthKey(date);
  const monthlyTotals = monthTotals(s.txs, month);
  const monthList = monthlyTotals.list;
  const income = monthList
    .filter((transaction) => transaction.type === "receita")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = monthList
    .filter(isCashOutflow)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const goalOutgoals = (s.goalMovements ?? [])
    .filter((movement) => movement.type === "aporte" && movement.date.startsWith(month))
    .reduce((sum, movement) => sum + movement.amountCents, 0);
  const balance = income - expense - goalOutgoals;
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const today = new Date(`${todayIso}T12:00:00`);
  const isCurrentMonth = month === monthKey(today);
  const elapsedDays = Math.max(1, today.getDate());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expenseToDate = isCurrentMonth
    ? s.txs
        .filter(
          (transaction) =>
            isCashOutflow(transaction) &&
            transactionCashDate(transaction).startsWith(month) &&
            transactionCashDate(transaction) <= todayIso,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    : 0;
  const incomeToDate = isCurrentMonth
    ? s.txs
        .filter(
          (transaction) =>
            transaction.type === "receita" &&
            transactionReferenceMonth(transaction) === month &&
            transactionCashDate(transaction) <= todayIso,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    : 0;
  const projectedExpense = isCurrentMonth ? (expenseToDate / elapsedDays) * daysInMonth : null;
  const projectedIncome = isCurrentMonth ? (incomeToDate / elapsedDays) * daysInMonth : null;
  const banksBalance = s.banks.reduce((total, bank) => total + bankBalance(s, bank.id), 0);
  const netWorth = netWorthCents(s, investmentAssetsCents);
  const payables = s.txs.filter(isPendingPayable);
  const overduePayables = payables.filter((transaction) =>
    transaction.dueDate ? transaction.dueDate < todayIso : false,
  );
  const nextWeekEnd = new Date(`${todayIso}T12:00:00`);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekIso = `${nextWeekEnd.getFullYear()}-${String(nextWeekEnd.getMonth() + 1).padStart(2, "0")}-${String(nextWeekEnd.getDate()).padStart(2, "0")}`;
  const nextWeekPayables = payables.filter(
    (transaction) =>
      transaction.dueDate !== undefined &&
      transaction.dueDate >= todayIso &&
      transaction.dueDate <= nextWeekIso,
  );
  const spendingByCategory = getMonthlySpendingByCategory(s.txs, month, s.cards, s.invoices);
  const limitAlerts = monthlyBudgets.flatMap((budget) => {
    const spentCents = spendingByCategory[budget.categoryId] ?? 0;
    const progress = (spentCents / budget.amountCents) * 100;
    const status = budgetStatus(progress);
    return status === "normal" ? [] : [{ ...budget, spentCents, progress, status }];
  });
  const recent = [...monthList]
    .sort((a, b) => transactionCashDate(b).localeCompare(transactionCashDate(a)))
    .slice(0, 6);

  const cards = [
    {
      label: "Saldo das contas",
      value: banksBalance,
      cls: "text-balance",
      Icon: Wallet,
      help: "Dinheiro que você tem hoje nas contas cadastradas, somando todos os meses. Aportes em metas e pagamentos de fatura já estão descontados aqui. É o número que responde “quanto eu tenho”.",
    },
    {
      label: "Total Entradas",
      value: income,
      cls: "text-income",
      Icon: TrendingUp,
      help: "Receitas agrupadas pelo mês de referência. O mês pode ser diferente da data em que o dinheiro entrou na conta.",
    },
    {
      label: "Total Saídas (caixa)",
      value: expense + goalOutgoals,
      cls: "text-expense",
      Icon: TrendingDown,
      help: "Valores que saíram das contas no mês selecionado, incluindo pagamentos de fatura e aportes em metas. Compras no cartão só entram quando a fatura é paga.",
    },
    {
      label: "Quanto sobrou no mês",
      value: balance,
      cls: "text-balance",
      Icon: CalendarClock,
      help: "Resultado do mês selecionado: Total Entradas menos Total Saídas (caixa). Aportes em metas contam como saída de caixa, mas o dinheiro continua seu, guardado na meta. Não inclui o saldo inicial nem o resultado de meses anteriores.",
    },
    {
      label: "Patrimônio total",
      value: netWorth,
      cls: "text-balance",
      Icon: Landmark,
      help: "Saldo das contas + saldo das metas + investimentos. Como o aporte só move dinheiro da conta para a meta, ele não altera o patrimônio.",
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle
        title="Início"
        sub="Um resumo do seu mês, sem enrolação"
        action={<MonthPicker date={date} onChange={setDate} />}
      />
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map(({ label, value, cls, Icon, help }) => (
            <div
              key={label}
              className={cn(
                "rounded-xl border bg-card p-5",
                label === "Saldo das contas"
                  ? "border-2 border-primary bg-primary/5"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{label}</span>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Entenda o cálculo de ${label}`}
                        className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">{help}</TooltipContent>
                  </Tooltip>
                  <Icon className={cn("h-4 w-4", cls)} />
                </div>
              </div>
              <div className={cn("mt-6 text-[28px] font-bold", cls)}>
                {label === "Patrimônio total" && assetsLoading ? (
                  <Skeleton className="h-8 w-36" />
                ) : (
                  brl(value)
                )}
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
      {(overduePayables.length > 0 || nextWeekPayables.length > 0) && (
        <Link
          to="/a-pagar"
          className="grid gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:grid-cols-2"
        >
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium">Contas vencidas</p>
              <p className="text-sm text-muted-foreground">
                {overduePayables.length} conta{overduePayables.length === 1 ? "" : "s"} ·{" "}
                {brl(overduePayables.reduce((sum, transaction) => sum + transaction.amount, 0))}
              </p>
            </div>
          </div>
          <div>
            <p className="font-medium">A pagar nos próximos 7 dias</p>
            <p className="text-sm text-muted-foreground">
              {nextWeekPayables.length} conta{nextWeekPayables.length === 1 ? "" : "s"} ·{" "}
              {brl(nextWeekPayables.reduce((sum, transaction) => sum + transaction.amount, 0))}
            </p>
          </div>
        </Link>
      )}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />
          Previsão de fechamento
        </div>
        {isCurrentMonth ? (
          <p className="text-sm text-muted-foreground">
            Projeção linear: receitas {brl(projectedIncome ?? 0)} · despesas{" "}
            {brl(projectedExpense ?? 0)} até o fim do mês, com base nos lançamentos até hoje.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            A previsão aparece para o mês atual. Volte para {monthKey(today)} para acompanhar o
            fechamento.
          </p>
        )}
      </section>
      {limitAlerts.length > 0 && (
        <section
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
          role="alert"
          aria-labelledby="budget-alerts-title"
        >
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <h2 id="budget-alerts-title">
              Atenção ao orçamento de {date.toLocaleDateString("pt-BR", { month: "long" })}
            </h2>
          </div>
          <ul className="space-y-1 text-sm">
            {limitAlerts.map((limit) => {
              const category = s.categories.find((item) => item.id === limit.categoryId);
              return (
                <li key={limit.id}>
                  <span className="font-medium">{category?.name ?? "Categoria"}</span>
                  {": "}
                  {brl(limit.spentCents)} de {brl(limit.amountCents)} ({Math.round(limit.progress)}
                  %)
                  {limit.status === "estourado"
                    ? ` — ${brl(limit.spentCents - limit.amountCents)} acima do limite.`
                    : " — perto do limite."}
                </li>
              );
            })}
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/planejamento">Revisar orçamento</Link>
          </Button>
        </section>
      )}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-medium">Últimas transações</h3>
          <Button asChild size="sm" variant="outline">
            <Link to="/transacoes">Ver todas as transações</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma transação neste mês.</p>
            <Button size="sm" className="mt-3" onClick={() => open(null)}>
              Adicionar transação
            </Button>
          </div>
        ) : (
          <div>
            {recent.map((t) => {
              const c = s.categories.find((x) => x.id === t.categoryId);
              const src = t.bankId
                ? s.banks.find((b) => b.id === t.bankId)?.name
                : s.cards.find((k) => k.id === t.cardId)?.name;
              const inc = t.type === "receita";
              const payment = t.type === "pagamento_fatura";
              const pendingPayable = isPendingPayable(t);
              const description = payment
                ? `Pagamento de fatura · ${src ?? "Cartão"}`
                : t.description;
              const displayedDate = pendingPayable
                ? (t.dueDate ?? t.date)
                : isCashOutflow(t)
                  ? transactionCashDate(t)
                  : t.date;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={payment}
                  aria-label={`Editar ${description}, ${fmtDate(displayedDate)}`}
                  title={
                    payment
                      ? "Abra a fatura do cartão para editar ou excluir este pagamento."
                      : undefined
                  }
                  onClick={() => open(t)}
                  className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-0 hover:bg-accent/40 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      inc ? "bg-income" : pendingPayable ? "bg-amber-500" : "bg-expense",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{description}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {!payment ? `${categoryName(c)} • ` : ""}
                      {src ? `${src} • ` : ""}
                      {pendingPayable ? "A pagar" : fmtDate(displayedDate)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-semibold",
                      inc
                        ? "text-income"
                        : pendingPayable
                          ? "text-amber-700 dark:text-amber-300"
                          : payment
                            ? "text-muted-foreground"
                            : "text-expense",
                    )}
                  >
                    {inc ? "+" : payment || t.amount < 0 ? "−" : ""}
                    {brl(Math.abs(t.amount))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
