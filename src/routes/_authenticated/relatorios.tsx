import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MonthPicker, PageTitle } from "@/components/AppShell";
import { brl, monthKey, useStore } from "@/lib/store";
import { compareMonthlyPeriods, reportMonthTotals } from "@/lib/reporting";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — BolsoFirme" },
      { name: "description", content: "Acompanhe receitas e despesas por mês e ano." },
      { property: "og:title", content: "Relatórios — BolsoFirme" },
      { property: "og:description", content: "Acompanhe receitas e despesas por mês e ano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

const sel = "h-9 rounded-md border border-input bg-card px-3 text-sm";
type ReportMode = "pizza" | "barras" | "estabelecimentos" | "tendencia" | "anual";

function percentageLabel(value: number | null): string {
  if (value === null) return "Sem base anterior";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function Relatorios() {
  const s = useStore();
  const [date, setDate] = useState(() => new Date());
  const [mode, setMode] = useState<ReportMode>("pizza");
  const [source, setSource] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const selectedMonth = monthKey(date);
  const selectedSource = source ? {
    type: source.startsWith("bank:") ? "bank" as const : "card" as const,
    id: source.slice(source.indexOf(":") + 1),
  } : undefined;
  const { list } = reportMonthTotals(s.txs, selectedMonth, selectedSource);
  const comparison = compareMonthlyPeriods(s.txs, selectedMonth, selectedSource);
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    list
      .filter((transaction) => transaction.type === "despesa")
      .forEach((transaction) => {
        totals.set(
          transaction.categoryId,
          (totals.get(transaction.categoryId) ?? 0) + transaction.amount,
        );
      });
    return [...totals]
      .map(([id, value]) => {
        const category = s.categories.find((item) => item.id === id);
        return {
          id,
          name: category?.name ?? "Sem categoria",
          icon: category?.icon ?? "",
          color: category?.color ?? "#888",
          value,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [list, s.categories]);
  const merchantData = useMemo(() => {
    const totals = new Map<string, number>();
    list
      .filter((transaction) => transaction.type === "despesa")
      .forEach((transaction) => {
        const establishment = transaction.description.trim() || "Sem descrição";
        totals.set(establishment, (totals.get(establishment) ?? 0) + transaction.amount);
      });
    return [...totals]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [list]);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const average = data.length ? total / data.length : 0;
  const trend = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(date.getFullYear(), date.getMonth() - 11 + index, 1);
    const totals = reportMonthTotals(s.txs, monthKey(month), selectedSource);
    return {
      mes: month.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      Receitas: totals.income / 100,
      Despesas: totals.expense / 100,
    };
  });
  const annual = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(date.getFullYear(), index, 1);
    const totals = reportMonthTotals(s.txs, monthKey(month), selectedSource);
    return {
      mes: month.toLocaleDateString("pt-BR", { month: "short" }),
      Receitas: totals.income / 100,
      Despesas: totals.expense / 100,
    };
  });
  const annualIncome = annual.reduce((sum, month) => sum + month.Receitas, 0);
  const annualExpense = annual.reduce((sum, month) => sum + month.Despesas, 0);
  const sourceLabel = selectedSource
    ? selectedSource.type === "bank"
      ? s.banks.find((item) => item.id === selectedSource.id)?.name
      : s.cards.find((item) => item.id === selectedSource.id)?.name
    : undefined;
  const stats = [
    { label: "Total de despesas", value: brl(total), color: "border-l-expense" },
    { label: "Maior categoria", value: data[0]?.name ?? "—", color: "border-l-orange" },
    { label: "Categorias ativas", value: String(data.length), color: "border-l-balance" },
    { label: "Média por categoria", value: brl(average), color: "border-l-violet" },
  ];

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const yearTransactions = s.txs
        .filter((transaction) => transaction.date.startsWith(String(date.getFullYear())))
        .filter((transaction) =>
          !selectedSource ||
          (selectedSource.type === "bank"
            ? transaction.bankId === selectedSource.id
            : transaction.cardId === selectedSource.id),
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const transactionRows = yearTransactions.map((transaction) => ({
        Data: transaction.date,
        Descrição: transaction.description,
        Tipo: transaction.type === "receita" ? "Receita" : "Despesa",
        "Valor (R$)": transaction.amount / 100,
        Categoria:
          s.categories.find((category) => category.id === transaction.categoryId)?.name ??
          "Sem categoria",
        Instituição: transaction.bankId
          ? s.banks.find((item) => item.id === transaction.bankId)?.name ?? ""
          : s.cards.find((item) => item.id === transaction.cardId)?.name ?? "",
      }));
      const annualExpenses = yearTransactions.filter((transaction) => transaction.type === "despesa");
      const categoryTotals = new Map<string, number>();
      const merchantTotals = new Map<string, number>();
      annualExpenses.forEach((transaction) => {
        categoryTotals.set(
          transaction.categoryId,
          (categoryTotals.get(transaction.categoryId) ?? 0) + transaction.amount,
        );
        const establishment = transaction.description.trim() || "Sem descrição";
        merchantTotals.set(establishment, (merchantTotals.get(establishment) ?? 0) + transaction.amount);
      });
      const annualExpenseTotal = [...categoryTotals.values()].reduce((sum, amount) => sum + amount, 0);
      const categoryRows = [...categoryTotals].map(([categoryId, amount]) => ({
        Categoria:
          s.categories.find((category) => category.id === categoryId)?.name ?? "Sem categoria",
        "Despesas (R$)": amount / 100,
        Participação: annualExpenseTotal
          ? `${((amount / annualExpenseTotal) * 100).toFixed(1)}%`
          : "0%",
      }));
      const merchantRows = [...merchantTotals]
        .map(([establishment, amount]) => ({
          Estabelecimento: establishment,
          "Despesas (R$)": amount / 100,
        }))
        .sort((a, b) => b["Despesas (R$)"] - a["Despesas (R$)"]);
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet([
        { Indicador: "Ano", Valor: date.getFullYear() },
        { Indicador: "Receitas anuais (R$)", Valor: annualIncome },
        { Indicador: "Despesas anuais (R$)", Valor: annualExpense },
        { Indicador: "Saldo anual (R$)", Valor: annualIncome - annualExpense },
        { Indicador: `Despesas de ${selectedMonth} (R$)`, Valor: total / 100 },
        { Indicador: "Receitas do mês anterior (R$)", Valor: comparison.previous.income / 100 },
        { Indicador: "Despesas do mês anterior (R$)", Valor: comparison.previous.expense / 100 },
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(categoryRows.length ? categoryRows : [{ Categoria: "Sem despesas" }]),
        "Categorias",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          merchantRows.length ? merchantRows : [{ Estabelecimento: "Sem despesas" }],
        ),
        "Estabelecimentos",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          transactionRows.length ? transactionRows : [{ Descrição: "Sem transações no ano" }],
        ),
        "Transações",
      );
      XLSX.writeFile(workbook, `bolsofirme-relatorio-${date.getFullYear()}.xlsx`);
    } catch (error) {
      console.error("[Reports] Failed to export the Excel report.", error);
      toast.error("Não foi possível gerar o arquivo Excel.");
    }
  };

  return (
    <div className="report-print-area space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Relatórios" sub="Visualize seus gastos e receitas com gráficos detalhados" />
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Salvar em PDF
          </Button>
          <Button size="sm" onClick={() => void exportExcel()}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <MonthPicker date={date} onChange={setDate} />
        <div className="flex flex-wrap gap-2">
          {(["pizza", "barras", "estabelecimentos", "tendencia", "anual"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "default" : "outline"}
              onClick={() => setMode(item)}
            >
              {item === "pizza"
                ? "Pizza"
                : item === "barras"
                  ? "Barras"
                  : item === "anual"
                    ? "Visão anual"
                    : item === "estabelecimentos"
                      ? "Estabelecimentos"
                    : "Tendência"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-xl border border-l-4 border-border bg-card p-4",
              stat.color,
            )}
          >
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="mt-2 text-xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 font-semibold">Comparação com o mês anterior</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {selectedMonth} em relação a {comparison.previousMonth}
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ComparisonCard
            label="Receitas"
            current={comparison.current.income}
            previous={comparison.previous.income}
            change={comparison.incomeChange}
          />
          <ComparisonCard
            label="Despesas"
            current={comparison.current.expense}
            previous={comparison.previous.expense}
            change={comparison.expenseChange}
            expense
          />
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs text-muted-foreground">Variação do saldo</div>
            <strong className={comparison.balanceChange < 0 ? "text-destructive" : "text-income"}>
              {comparison.balanceChange > 0 ? "+" : ""}
              {brl(comparison.balanceChange)}
            </strong>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <select
          className={sel}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="Filtrar relatórios por instituição"
        >
          <option value="">Todas as instituições</option>
          <optgroup label="Bancos">
          {s.banks.map((item) => (
            <option key={item.id} value={`bank:${item.id}`}>{item.name}</option>
          ))}
          </optgroup>
          <optgroup label="Cartões">
            {s.cards.map((item) => (
              <option key={item.id} value={`card:${item.id}`}>{item.name}</option>
            ))}
          </optgroup>
        </select>
        <span className="text-sm text-muted-foreground">Ano selecionado: {date.getFullYear()}</span>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">
          {mode === "anual"
            ? `Resumo anual — ${date.getFullYear()}`
            : mode === "tendencia"
              ? "Tendência — últimos 12 meses"
              : mode === "estabelecimentos"
                ? "Despesas por estabelecimento"
              : "Despesas por categoria"}
        </h3>
        {mode === "anual" ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <AnnualSummary label="Receitas no ano" amount={annualIncome * 100} />
              <AnnualSummary label="Despesas no ano" amount={annualExpense * 100} />
              <AnnualSummary label="Saldo anual" amount={(annualIncome - annualExpense) * 100} />
            </div>
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={annual}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="mes" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(value: number) => brl(value * 100)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="var(--income)" />
                  <Bar dataKey="Despesas" fill="var(--expense)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : mode === "tendencia" ? (
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip formatter={(value: number) => brl(value * 100)} />
                <Legend />
                <Line dataKey="Receitas" stroke="var(--income)" strokeWidth={2} />
                <Line dataKey="Despesas" stroke="var(--expense)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : mode === "estabelecimentos" ? (
          merchantData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas neste período.</p>
          ) : (
            <div style={{ height: Math.max(200, Math.min(merchantData.length, 12) * 44) }}>
              <ResponsiveContainer>
                <BarChart data={merchantData.slice(0, 12).map((item) => ({
                  ...item,
                  valueInReais: item.value / 100,
                }))} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={130} />
                  <Tooltip formatter={(value: number) => brl(value * 100)} />
                  <Bar dataKey="valueInReais" name="Despesas" fill="var(--expense)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        ) : data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas neste período.</p>
        ) : mode === "barras" ? (
          <div style={{ height: Math.max(200, data.length * 44) }}>
            <ResponsiveContainer>
              <BarChart data={data.map((item) => ({ ...item, valueInReais: item.value / 100 }))} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip formatter={(value: number) => brl(value * 100)} />
                <Bar dataKey="valueInReais" name="Despesas" radius={4}>
                  {data.map((item) => <Cell key={item.id} fill={item.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div className="relative h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data} dataKey="value" innerRadius="60%" outerRadius="90%" stroke="none">
                    {data.map((item) => (
                      <Cell
                        key={item.id}
                        fill={item.color}
                        opacity={!active || active === item.id ? 1 : 0.3}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => brl(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-bold">{brl(total)}</div>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              {data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActive(active === item.id ? null : item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border p-3 text-left text-sm print:hidden",
                    active === item.id && "border-primary bg-accent",
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  <span>{item.icon}</span>
                  <span className="flex-1 font-medium">{item.name}</span>
                  <span className="text-muted-foreground">
                    {total ? ((item.value / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                  <span className="font-semibold">{brl(item.value)}</span>
                </button>
              ))}
              <div className="hidden gap-2 print:grid">
                {data.map((item) => (
                  <div key={item.id} className="flex gap-2 text-sm">
                    <span>{item.name}</span>
                    <span className="flex-1">{((item.value / total) * 100).toFixed(1)}%</span>
                    <span>{brl(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ComparisonCard({
  label,
  current,
  previous,
  change,
  expense = false,
}: {
  label: string;
  current: number;
  previous: number;
  change: number | null;
  expense?: boolean;
}) {
  const positive = change !== null && (expense ? change <= 0 : change >= 0);
  return (
    <div className="rounded-lg bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <strong>{brl(current)}</strong>
      <div className="text-xs text-muted-foreground">Mês anterior: {brl(previous)}</div>
      <div
        className={cn(
          "text-xs font-medium",
          change === null ? "text-muted-foreground" : positive ? "text-income" : "text-destructive",
        )}
      >
        {percentageLabel(change)}
      </div>
    </div>
  );
}

function AnnualSummary({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <strong>{brl(amount)}</strong>
    </div>
  );
}
