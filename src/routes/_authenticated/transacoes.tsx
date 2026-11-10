import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Filter,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  Landmark,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker, useTxDialog } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { budgetStatus, getMonthlySpendingByCategory, type SpendingBudget } from "@/lib/planning";
import {
  brl,
  fmtDate,
  invoiceSummary,
  isCashOutflow,
  isPendingPayable,
  monthKey,
  monthLabel,
  monthTotals,
  savingsAssetsCents,
  transactionCashDate,
  transactionReferenceMonth,
  useStore,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações — BolsoFirme" },
      { name: "description", content: "Acompanhe entradas, saídas e saldo do mês no BolsoFirme." },
      { property: "og:title", content: "Transações — BolsoFirme" },
      {
        property: "og:description",
        content: "Acompanhe entradas, saídas e saldo do mês no BolsoFirme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Transacoes,
});

const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";

function Transacoes() {
  const s = useStore();
  const open = useTxDialog();
  const [date, setDate] = useState(() => new Date());
  const [institution, setInstitution] = useState("");
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(true);
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
        console.error("[Transactions] Failed to load investment assets for net worth.", error);
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
        console.error("[Transactions] Failed to load spending limits.", error);
        if (active) toast.error("Não foi possível carregar os limites de gastos.");
      }
    })();
    return () => {
      active = false;
    };
  }, [date]);
  const monthlyTotals = monthTotals(s.txs, monthKey(date));
  const monthList = monthlyTotals.list;
  const list = monthList.filter((transaction) => {
    if (!institution) return true;
    const [type, id] = institution.split(":", 2);
    return type === "bank" ? transaction.bankId === id : transaction.cardId === id;
  });
  const income = list
    .filter((transaction) => transaction.type === "receita")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = list
    .filter(isCashOutflow)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const today = new Date(`${todayIso}T12:00:00`);
  const balance = income - expense;
  const isCurrentMonth = monthKey(date) === monthKey(today);
  const elapsedDays = Math.max(1, today.getDate());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const sourceMatches = (transaction: (typeof s.txs)[number]) => {
    if (!institution) return true;
    const [sourceType, id] = institution.split(":", 2);
    return sourceType === "bank" ? transaction.bankId === id : transaction.cardId === id;
  };
  const expenseToDate = s.txs
    .filter(
      (transaction) =>
        isCurrentMonth &&
        isCashOutflow(transaction) &&
        transactionCashDate(transaction).startsWith(monthKey(date)) &&
        transactionCashDate(transaction) <= todayIso &&
        sourceMatches(transaction),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const incomeToDate = s.txs
    .filter(
      (transaction) =>
        isCurrentMonth &&
        transaction.type === "receita" &&
        transactionReferenceMonth(transaction) === monthKey(date) &&
        transactionCashDate(transaction) <= todayIso &&
        sourceMatches(transaction),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const projectedExpense = isCurrentMonth ? (expenseToDate / elapsedDays) * daysInMonth : null;
  const projectedIncome = isCurrentMonth ? (incomeToDate / elapsedDays) * daysInMonth : null;
  const netWorth =
    monthlyTotals.balance + investmentAssetsCents + savingsAssetsCents(s.goalMovements ?? []);
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
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const minCents = minAmount === "" ? undefined : Math.round(Number(minAmount) * 100);
  const maxCents = maxAmount === "" ? undefined : Math.round(Number(maxAmount) * 100);
  const rows = list
    .filter((t) => {
      if (cat && t.categoryId !== cat) return false;
      if (minCents !== undefined && t.amount < minCents) return false;
      if (maxCents !== undefined && t.amount > maxCents) return false;
      if (!query) return true;
      const categoryName =
        s.categories.find((category) => category.id === t.categoryId)?.name ?? "";
      const sourceName = t.bankId
        ? (s.banks.find((item) => item.id === t.bankId)?.name ?? "")
        : (s.cards.find((item) => item.id === t.cardId)?.name ?? "");
      return `${t.description} ${categoryName} ${sourceName}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    })
    .sort((a, b) => transactionCashDate(b).localeCompare(transactionCashDate(a)));
  const goalMovementRows = (s.goalMovements ?? [])
    .filter((movement) => {
      if (!movement.date.startsWith(monthKey(date)) || cat) return false;
      if (institution && institution !== `bank:${movement.bankId}`) return false;
      if (minCents !== undefined && movement.amountCents < minCents) return false;
      if (maxCents !== undefined && movement.amountCents > maxCents) return false;
      if (!query) return true;
      const goalName = s.goalNames?.[movement.goalId] ?? "Meta";
      const bankName = s.banks.find((bank) => bank.id === movement.bankId)?.name ?? "";
      return `${goalName} ${bankName} ${movement.note}`.toLocaleLowerCase("pt-BR").includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const spendingByCategory = getMonthlySpendingByCategory(
    s.txs,
    monthKey(date),
    s.cards,
    s.invoices,
  );
  const limitAlerts = monthlyBudgets.flatMap((budget) => {
    const spentCents = spendingByCategory[budget.categoryId] ?? 0;
    const progress = (spentCents / budget.amountCents) * 100;
    const status = budgetStatus(progress);
    return status === "normal" ? [] : [{ ...budget, spentCents, progress, status }];
  });

  const cards = [
    { label: "Total Entradas", value: income, cls: "text-income", Icon: TrendingUp },
    { label: "Total Saídas (caixa)", value: expense, cls: "text-expense", Icon: TrendingDown },
    { label: "Saldo Final", value: balance, cls: "text-balance", Icon: Wallet },
    { label: "Patrimônio total", value: netWorth, cls: "text-balance", Icon: Landmark },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <MonthPicker date={date} onChange={setDate} />
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, cls, Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm font-medium">
              {label}
              <Icon className={cn("h-4 w-4", cls)} />
            </div>
            <div className={cn("mt-6 text-[28px] font-bold", cls)}>
              {label === "Patrimônio total" && assetsLoading ? (
                <Skeleton className="h-8 w-36" />
              ) : (
                brl(value)
              )}
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Entradas usam o mês de referência; saídas consideram quando o pagamento ocorreu.
              Compras no cartão aparecem nos gastos por categoria e só entram nas saídas ao pagar a
              fatura.
            </p>
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
                      {brl(
                        overduePayables.reduce((sum, transaction) => sum + transaction.amount, 0),
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-medium">A pagar nos próximos 7 dias</p>
                  <p className="text-sm text-muted-foreground">
                    {nextWeekPayables.length} conta{nextWeekPayables.length === 1 ? "" : "s"} ·{" "}
                    {brl(
                      nextWeekPayables.reduce((sum, transaction) => sum + transaction.amount, 0),
                    )}
                  </p>
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>
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
            A previsão aparece para o mês atual. Selecione {monthKey(today)} para acompanhar o
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
            <Link to="/configuracoes">Revisar orçamento</Link>
          </Button>
        </section>
      )}
      {showFilters && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar transação"
              aria-label="Buscar por descrição, categoria ou instituição"
            />
          </div>
          <select
            className={sel}
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          >
            <option value="">Todas as instituições</option>
            <optgroup label="Bancos">
              {s.banks.map((b) => (
                <option key={b.id} value={`bank:${b.id}`}>
                  {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cartões">
              {s.cards.map((card) => (
                <option key={card.id} value={`card:${card.id}`}>
                  {card.name}
                </option>
              ))}
            </optgroup>
          </select>
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Categoria</option>
            {s.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Valor mínimo (R$)"
            aria-label="Valor mínimo"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="Valor máximo (R$)"
            aria-label="Valor máximo"
          />
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-medium">Todas as Transações</h3>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {list.length === 0
              ? "Nenhuma transação neste mês."
              : "Nenhuma transação corresponde à pesquisa e aos filtros."}
            {list.length === 0 ? (
              <div className="mt-3">
                <Button size="sm" onClick={() => open(null)}>
                  Adicionar transação
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInstitution("");
                    setCat("");
                    setSearch("");
                    setMinAmount("");
                    setMaxAmount("");
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        ) : (
          rows.map((t) => {
            const c = s.categories.find((x) => x.id === t.categoryId);
            const src = t.bankId
              ? s.banks.find((b) => b.id === t.bankId)?.name
              : s.cards.find((k) => k.id === t.cardId)?.name;
            const inc = t.type === "receita";
            const payment = t.type === "pagamento_fatura";
            const pendingPayable = isPendingPayable(t);
            const invoice = t.invoiceId
              ? s.invoices.find((item) => item.id === t.invoiceId)
              : undefined;
            const card = t.cardId ? s.cards.find((item) => item.id === t.cardId) : undefined;
            const cardUnpaid =
              t.type === "despesa" &&
              !!card &&
              !t.paid &&
              (!invoice || invoiceSummary(invoice, s.txs, card).status !== "Paga");
            const description = payment
              ? `Pagamento de fatura · ${src ?? "Cartão"}`
              : t.description;
            const displayedDate = pendingPayable
              ? (t.dueDate ?? t.date)
              : isCashOutflow(t)
                ? transactionCashDate(t)
                : t.date;
            const referenceMonth =
              inc && transactionReferenceMonth(t) !== t.date.slice(0, 7)
                ? monthLabel(
                    new Date(
                      Number(transactionReferenceMonth(t).slice(0, 4)),
                      Number(transactionReferenceMonth(t).slice(5, 7)) - 1,
                      1,
                    ),
                  )
                : null;
            return (
              <button
                key={t.id}
                disabled={payment}
                aria-label={
                  payment
                    ? `${description}, ${fmtDate(displayedDate)}`
                    : `Editar ${description}, ${pendingPayable ? "a pagar" : fmtDate(displayedDate)}`
                }
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
                    {!payment && c?.name ? `${c.name} • ` : ""}
                    {src ? `${src} • ` : ""}
                    {pendingPayable ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        A pagar · vence {fmtDate(displayedDate)}
                      </span>
                    ) : cardUnpaid ? (
                      <span>No cartão · fatura ainda não paga · {fmtDate(displayedDate)}</span>
                    ) : referenceMonth ? (
                      <span className="ml-1 text-primary">
                        · Ref. {referenceMonth} · recebido {fmtDate(t.date)}
                      </span>
                    ) : (
                      fmtDate(displayedDate)
                    )}
                    {t.recurrenceGroupId && (
                      <>
                        {" "}
                        • Recorrência{" "}
                        {t.recurrenceFrequency === "weekly"
                          ? "semanal"
                          : t.recurrenceFrequency === "yearly"
                            ? "anual"
                            : "mensal"}{" "}
                        ({t.recurrenceNumber}/{t.recurrenceCount})
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
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
                  <span
                    className={cn(
                      "mt-1 inline-block rounded border px-2 py-0.5 text-xs font-medium",
                      pendingPayable
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                        : "border-border bg-background",
                    )}
                  >
                    {pendingPayable
                      ? "A pagar"
                      : payment
                        ? "Pagamento de fatura"
                        : inc
                          ? "Receita"
                          : "Despesa"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
      {goalMovementRows.length > 0 && (
        <section
          className="rounded-xl border border-border bg-card p-5"
          aria-labelledby="goal-movements-title"
        >
          <h2 id="goal-movements-title" className="mb-3 font-medium">
            Movimentos de metas
          </h2>
          {goalMovementRows.map((movement) => {
            const goalName = s.goalNames?.[movement.goalId] ?? "Meta";
            const bankName = s.banks.find((bank) => bank.id === movement.bankId)?.name ?? "Conta";
            const isContribution = movement.type === "aporte";
            return (
              <div
                key={movement.id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    isContribution ? "text-expense bg-expense" : "text-income bg-income",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {isContribution ? "Aporte" : "Resgate"} · {goalName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {bankName} · {fmtDate(movement.date)}
                    {movement.note ? ` · ${movement.note}` : ""}
                  </div>
                </div>
                <div
                  className={cn("font-semibold", isContribution ? "text-expense" : "text-income")}
                >
                  {isContribution ? "−" : "+"}
                  {brl(movement.amountCents)}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
