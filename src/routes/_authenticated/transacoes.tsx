import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    ],
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
  const [showFilters, setShowFilters] = useState(true);
  const { list, income, expense, balance } = monthTotals(s.txs, monthKey(date), bank || undefined);
  const rows = list.filter((t) => !cat || t.categoryId === cat).sort((a, b) => b.date.localeCompare(a.date));

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
        <div className="flex flex-wrap gap-3">
          <select className={sel} value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">Selecionar Banco</option>{s.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Categoria</option>{s.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-medium">Todas as Transações</h3>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma transação neste mês.
            <div className="mt-3"><Button size="sm" onClick={() => open(null)}>Adicionar transação</Button></div>
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
                <div className="truncate text-xs text-muted-foreground">{c?.name} • {src} • {fmtDate(t.date)}</div>
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
