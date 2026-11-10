import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker, useTxDialog } from "@/components/AppShell";
import { brl, fmtDate, monthKey, monthTotals, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações — BolsoFirme" },
      { name: "description", content: "Acompanhe entradas, saídas e saldo do mês no BolsoFirme." },
      { property: "og:title", content: "Transações — BolsoFirme" },
      { property: "og:description", content: "Acompanhe entradas, saídas e saldo do mês no BolsoFirme." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Transacoes,
});

const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";

function Transacoes() {
  const s = useStore();
  const open = useTxDialog();
  const [date, setDate] = useState(() => new Date());
  const [bank, setBank] = useState("");
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const { list, income, expense, balance } = monthTotals(s.txs, monthKey(date), bank || undefined);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const minCents = minAmount === "" ? undefined : Math.round(Number(minAmount) * 100);
  const maxCents = maxAmount === "" ? undefined : Math.round(Number(maxAmount) * 100);
  const rows = list
    .filter((t) => {
      if (cat && t.categoryId !== cat) return false;
      if (minCents !== undefined && t.amount < minCents) return false;
      if (maxCents !== undefined && t.amount > maxCents) return false;
      if (!query) return true;
      const categoryName = s.categories.find((category) => category.id === t.categoryId)?.name ?? "";
      const sourceName = t.bankId
        ? s.banks.find((item) => item.id === t.bankId)?.name ?? ""
        : s.cards.find((item) => item.id === t.cardId)?.name ?? "";
      return `${t.description} ${categoryName} ${sourceName}`.toLocaleLowerCase("pt-BR").includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const cards = [
    { label: "Total Entradas", value: income, cls: "text-income", Icon: TrendingUp },
    { label: "Total Saídas", value: expense, cls: "text-expense", Icon: TrendingDown },
    { label: "Saldo Final", value: balance, cls: "text-balance", Icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <MonthPicker date={date} onChange={setDate} />
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" />Filtros</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, cls, Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm font-medium">{label}<Icon className={cn("h-4 w-4", cls)} /></div>
            <div className={cn("mt-6 text-[28px] font-bold", cls)}>{brl(value)}</div>
          </div>
        ))}
      </div>
      {showFilters && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar transação" aria-label="Buscar por descrição, categoria ou instituição" />
          </div>
          <select className={sel} value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">Selecionar Banco</option>{s.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Categoria</option>{s.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <Input type="number" min="0" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Valor mínimo (R$)" aria-label="Valor mínimo" />
          <Input type="number" min="0" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Valor máximo (R$)" aria-label="Valor máximo" />
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-medium">Todas as Transações</h3>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {list.length === 0 ? "Nenhuma transação neste mês." : "Nenhuma transação corresponde à pesquisa e aos filtros."}
            {list.length === 0 ? (
              <div className="mt-3"><Button size="sm" onClick={() => open(null)}>Adicionar transação</Button></div>
            ) : (
              <div className="mt-3"><Button size="sm" variant="outline" onClick={() => {
                setBank("");
                setCat("");
                setSearch("");
                setMinAmount("");
                setMaxAmount("");
              }}>Limpar filtros</Button></div>
            )}
          </div>
        ) : rows.map((t) => {
          const c = s.categories.find((x) => x.id === t.categoryId);
          const src = t.bankId ? s.banks.find((b) => b.id === t.bankId)?.name : s.cards.find((k) => k.id === t.cardId)?.name;
          const inc = t.type === "receita";
          return (
            <button key={t.id} onClick={() => open(t)} className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-0 hover:bg-accent/40">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", inc ? "bg-income" : "bg-expense")} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t.description}</div>
                <div className="truncate text-xs text-muted-foreground">{c?.name} • {src} • {fmtDate(t.date)}{t.recurrenceGroupId && <> • Recorrência {t.recurrenceFrequency === "weekly" ? "semanal" : t.recurrenceFrequency === "yearly" ? "anual" : "mensal"} ({t.recurrenceNumber}/{t.recurrenceCount})</>}</div>
              </div>
              <div className="text-right">
                <div className={cn("font-semibold", inc ? "text-income" : "text-expense")}>{inc ? "+" : ""}{brl(t.amount)}</div>
                <span className="mt-1 inline-block rounded border border-border bg-background px-2 py-0.5 text-xs font-medium">{inc ? "Receita" : "Despesa"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
