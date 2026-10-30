import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { MonthPicker, PageTitle } from "@/components/AppShell";
import { brl, monthKey, monthTotals, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — BolsoFirme" },
      { name: "description", content: "Gráficos de gastos e receitas por categoria." },
      { property: "og:title", content: "Relatórios — BolsoFirme" },
      { property: "og:description", content: "Gráficos de gastos e receitas por categoria." },
    ],
  }),
  component: Relatorios,
});

const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";

function Relatorios() {
  const s = useStore();
  const [date, setDate] = useState(() => new Date());
  const [mode, setMode] = useState<"pizza" | "barras" | "tendencia">("pizza");
  const [bank, setBank] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const { list } = monthTotals(s.txs, monthKey(date), bank || undefined);

  const data = useMemo(() => {
    const m = new Map<string, number>();
    list.filter((t) => t.type === "despesa").forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount));
    return [...m].map(([id, v]) => { const c = s.categories.find((x) => x.id === id)!; return { id, name: c?.name ?? "?", icon: c?.icon, color: c?.color ?? "#888", value: v }; }).sort((a, b) => b.value - a.value);
  }, [list, s.categories]);
  const total = data.reduce((a, d) => a + d.value, 0);
  const avg = data.length ? total / data.length : 0;
  const trend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(date.getFullYear(), date.getMonth() - 11 + i, 1);
    const t = monthTotals(s.txs, monthKey(d), bank || undefined);
    return { mes: d.toLocaleDateString("pt-BR", { month: "short" }), Receitas: t.income / 100, Despesas: t.expense / 100 };
  });

  const stats = [
    { l: "Total de Despesas", v: brl(total), c: "border-l-expense" },
    { l: "Maior Categoria", v: data[0] ? `${data[0].name} (${((data[0].value / total) * 100).toFixed(0)}%)` : "—", c: "border-l-orange" },
    { l: "Categorias Ativas", v: String(data.length), c: "border-l-balance" },
    { l: "Média por Categoria", v: brl(avg), c: "border-l-violet" },
  ];

  return (
    <div>
      <PageTitle title="Relatórios" sub="Visualize seus gastos e receitas com gráficos detalhados" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker date={date} onChange={setDate} />
        <div className="flex gap-2">
          {(["pizza", "barras", "tendencia"] as const).map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "pizza" ? "Pizza" : m === "barras" ? "Barras" : "Tendência"}</Button>
          ))}
        </div>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((x) => (
          <div key={x.l} className={cn("rounded-xl border border-l-4 border-border bg-card p-4", x.c)}>
            <div className="text-sm text-muted-foreground">{x.l}</div><div className="mt-2 text-xl font-bold">{x.v}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-3">
        <select className={sel} value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="">Banco: todos</option>{s.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="font-semibold">{mode === "tendencia" ? "Tendência — últimos 12 meses" : "Despesas por Categorias"}</h3>
          {mode !== "tendencia" && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{data.length} categorias</span>}
        </div>
        {mode === "tendencia" ? (
          <div className="h-80"><ResponsiveContainer><LineChart data={trend}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="mes" stroke="var(--muted-foreground)" /><YAxis stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /><Legend /><Line dataKey="Receitas" stroke="var(--income)" strokeWidth={2} /><Line dataKey="Despesas" stroke="var(--expense)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        ) : data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas neste período.</p>
        ) : mode === "barras" ? (
          <div style={{ height: Math.max(200, data.length * 44) }}><ResponsiveContainer><BarChart data={data.map((d) => ({ ...d, v: d.value / 100 }))} layout="vertical"><XAxis type="number" stroke="var(--muted-foreground)" /><YAxis type="category" dataKey="name" width={100} stroke="var(--muted-foreground)" /><Tooltip formatter={(v: number) => brl(v * 100)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /><Bar dataKey="v" radius={4}>{data.map((d) => <Cell key={d.id} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer></div>
        ) : (
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div className="relative h-72">
              <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" innerRadius="60%" outerRadius="90%" stroke="none">{data.map((d) => <Cell key={d.id} fill={d.color} opacity={!active || active === d.id ? 1 : 0.3} />)}</Pie></PieChart></ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">{brl(total)}</div></div></div>
            </div>
            <div className="grid gap-2">
              {data.map((d) => (
                <button key={d.id} onClick={() => setActive(active === d.id ? null : d.id)} className={cn("flex items-center gap-3 rounded-lg border border-border p-3 text-left text-sm", active === d.id && "border-primary bg-accent")}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /><span>{d.icon}</span>
                  <span className="flex-1 font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{((d.value / total) * 100).toFixed(1)}%</span>
                  <span className="font-semibold">{brl(d.value)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
