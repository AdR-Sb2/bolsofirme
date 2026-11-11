import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker, useTxDialog } from "@/components/AppShell";
import {
  brl,
  categoryName,
  fmtDate,
  invoiceSummary,
  isCashOutflow,
  isPendingPayable,
  monthKey,
  monthLabel,
  monthTotals,
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
  const monthlyTotals = monthTotals(s.txs, monthKey(date));
  const monthList = monthlyTotals.list;
  const list = monthList.filter((transaction) => {
    if (!institution) return true;
    const [type, id] = institution.split(":", 2);
    return type === "bank" ? transaction.bankId === id : transaction.cardId === id;
  });
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <MonthPicker date={date} onChange={setDate} />
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>
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
            {s.categories
              .filter((category) => !category.archived)
              .map((c) => (
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
                    {!payment ? `${categoryName(c)} • ` : ""}
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
