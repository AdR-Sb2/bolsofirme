import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { brl } from "@/lib/store";
import { calculatePortfolioSummary } from "@/lib/investment-math";

type Asset = Tables<"investments">;
type Dividend = Tables<"investment_dividends">;
type Snapshot = Pick<Tables<"investment_snapshots">, "captured_on" | "total_value_cents">;

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — BolsoFirme" },
      { name: "description", content: "Acompanhe carteira, rentabilidade, proventos e evolução." },
      { property: "og:title", content: "Investimentos — BolsoFirme" },
      { property: "og:description", content: "Acompanhe carteira, rentabilidade, proventos e evolução." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Investimentos,
});

const assetTypes = [
  "Ação",
  "FII",
  "ETF",
  "Tesouro Direto",
  "Renda fixa",
  "Criptomoeda",
  "Fundo",
  "Outro",
];
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function centsFromInput(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isSafeInteger(Math.round(parsed * 100))) {
    return null;
  }
  return Math.round(parsed * 100);
}

function Investimentos() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [kind, setKind] = useState(assetTypes[0] ?? "Ação");
  const [quantity, setQuantity] = useState("1");
  const [averagePrice, setAveragePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [dividendAsset, setDividendAsset] = useState("");
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendDate, setDividendDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dividendNote, setDividendNote] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      const [assetsResult, dividendsResult, snapshotsResult] = await Promise.all([
        supabase.from("investments").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("investment_dividends").select("*").eq("user_id", user.id).order("paid_at", { ascending: false }),
        supabase.from("investment_snapshots").select("captured_on,total_value_cents").eq("user_id", user.id).order("captured_on"),
      ]);
      const error = assetsResult.error ?? dividendsResult.error ?? snapshotsResult.error;
      if (error) {
        console.error("[Investments] Failed to load investment data.", error);
        toast.error(
          error.message.includes("does not exist")
            ? "Aplique a migration 20261110000800_investment_history_and_activity.sql para habilitar o histórico e os proventos."
            : "Não foi possível carregar os investimentos.",
        );
      } else {
        const assets = assetsResult.data ?? [];
        setRows(assets);
        setDividends(dividendsResult.data ?? []);
        setSnapshots(snapshotsResult.data ?? []);
        setPriceDrafts(Object.fromEntries(assets.map((asset) => [
          asset.id,
          (asset.current_price_cents / 100).toFixed(2),
        ])));
        if (!dividendAsset && assets[0]) setDividendAsset(assets[0].id);
      }
    } catch (error) {
      console.error("[Investments] Unexpected error while loading investment data.", error);
      toast.error("Não foi possível carregar os investimentos.");
    } finally {
      setBusy(false);
    }
  }, [dividendAsset]);
  useEffect(() => {
    void load();
  }, [load]);

  const totalDividends = dividends.reduce((sum, dividend) => sum + dividend.amount_cents, 0);
  const portfolio = useMemo(
    () => calculatePortfolioSummary(rows, totalDividends),
    [rows, totalDividends],
  );
  const {
    investedCents: invested,
    currentCents: currentValue,
    accumulatedReturnCents: accumulatedReturn,
    returnPercent,
    allocation,
  } = portfolio;

  const saveAsset = async () => {
    const quantityValue = Number(quantity);
    const averageCents = centsFromInput(averagePrice);
    const currentCents = centsFromInput(currentPrice);
    if (!name.trim() || !Number.isFinite(quantityValue) || quantityValue <= 0 || !averageCents || !currentCents) {
      toast.error("Preencha nome, quantidade e preços válidos maiores que zero.");
      return;
    }
    setSaving(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[Investments] Could not verify signed-in user.", authError);
      toast.error("Entre novamente na sua conta.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("investments").insert({
      user_id: user.id,
      name: name.trim(),
      ticker: ticker.trim(),
      asset_type: kind,
      quantity: quantityValue,
      average_price_cents: averageCents,
      current_price_cents: currentCents,
    });
    if (error) {
      console.error("[Investments] Failed to add asset.", error);
      toast.error("Não foi possível adicionar o ativo.");
    } else {
      setName("");
      setTicker("");
      setQuantity("1");
      setAveragePrice("");
      setCurrentPrice("");
      toast.success("Ativo adicionado à carteira.");
      await load();
    }
    setSaving(false);
  };

  const updatePrice = async (asset: Asset) => {
    const cents = centsFromInput(priceDrafts[asset.id] ?? "");
    if (!cents) {
      toast.error("Informe um preço atual válido maior que zero.");
      return;
    }
    const { error } = await supabase
      .from("investments")
      .update({ current_price_cents: cents })
      .eq("id", asset.id);
    if (error) {
      console.error("[Investments] Failed to update market price.", error);
      toast.error("Não foi possível atualizar o preço do ativo.");
      return;
    }
    toast.success("Preço atualizado e evolução registrada.");
    await load();
  };

  const removeAsset = async (asset: Asset) => {
    if (!window.confirm(`Excluir ${asset.name} e os proventos vinculados?`)) return;
    const { error } = await supabase.from("investments").delete().eq("id", asset.id);
    if (error) {
      console.error("[Investments] Failed to delete asset.", error);
      toast.error("Não foi possível excluir o ativo.");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== asset.id));
    setDividends((current) => current.filter((item) => item.investment_id !== asset.id));
    toast.success("Ativo excluído.");
    await load();
  };

  const addDividend = async () => {
    const amountCents = centsFromInput(dividendAmount);
    if (!dividendAsset || !amountCents || !dividendDate) {
      toast.error("Selecione um ativo e informe valor e data válidos.");
      return;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[Investments] Could not verify signed-in user.", authError);
      toast.error("Entre novamente na sua conta.");
      return;
    }
    const { error } = await supabase.from("investment_dividends").insert({
      user_id: user.id,
      investment_id: dividendAsset,
      amount_cents: amountCents,
      paid_at: dividendDate,
      note: dividendNote.trim(),
    });
    if (error) {
      console.error("[Investments] Failed to record dividend.", error);
      toast.error("Não foi possível registrar o provento.");
      return;
    }
    setDividendAmount("");
    setDividendNote("");
    toast.success("Provento registrado.");
    await load();
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title="Investimentos"
        sub="Carteira, renda de proventos, distribuição e evolução patrimonial"
        action={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        }
      />
      {busy ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Patrimônio investido" value={brl(currentValue)} icon={<Wallet className="h-4 w-4" />} />
          <Metric label="Custo de aquisição" value={brl(invested)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric label="Rentabilidade acumulada" value={`${returnPercent >= 0 ? "+" : ""}${returnPercent.toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} positive={accumulatedReturn >= 0} />
          <Metric label="Proventos recebidos" value={brl(totalDividends)} icon={<BarChart3 className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 font-semibold">Evolução do patrimônio investido</h3>
          <p className="mb-4 text-sm text-muted-foreground">Snapshots diários são registrados quando a carteira muda.</p>
          {busy ? <Skeleton className="h-64 w-full" /> : snapshots.length < 2 ? (
            <p className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
              A evolução aparecerá após atualizar os preços em dias diferentes.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={snapshots}>
                  <XAxis dataKey="captured_on" tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tickFormatter={(value: number) => brl(value)} width={88} />
                  <Tooltip formatter={(value: number) => brl(value)} labelFormatter={(value) => `Data: ${value}`} />
                  <Line type="monotone" dataKey="total_value_cents" name="Patrimônio" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 font-semibold">Distribuição por classe de ativo</h3>
          <p className="mb-4 text-sm text-muted-foreground">Participação calculada pelo valor atual informado.</p>
          {busy ? <Skeleton className="h-64 w-full" /> : allocation.length === 0 ? (
            <p className="grid h-64 place-items-center text-sm text-muted-foreground">Adicione ativos para visualizar a distribuição.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="type" innerRadius="55%" outerRadius="82%">
                    {allocation.map((item, index) => (
                      <Cell key={item.type} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => brl(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Adicionar ativo</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input placeholder="Nome do ativo" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Código (ex.: PETR4)" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} />
          <select className="h-10 rounded-md border border-input bg-background px-3" value={kind} onChange={(event) => setKind(event.target.value)}>
            {assetTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <Input type="number" min="0.00000001" step="any" placeholder="Quantidade" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <Input type="number" min="0.01" step="0.01" placeholder="Preço médio (R$)" value={averagePrice} onChange={(event) => setAveragePrice(event.target.value)} />
          <Input type="number" min="0.01" step="0.01" placeholder="Preço atual (R$)" value={currentPrice} onChange={(event) => setCurrentPrice(event.target.value)} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void saveAsset()} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar à carteira
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Registrar provento recebido</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Adicione um ativo antes de registrar dividendos ou juros.</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select className="h-10 rounded-md border border-input bg-background px-3" value={dividendAsset} onChange={(event) => setDividendAsset(event.target.value)} aria-label="Ativo do provento">
                {rows.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}{asset.ticker ? ` (${asset.ticker})` : ""}</option>)}
              </select>
              <Input type="number" min="0.01" step="0.01" placeholder="Valor recebido (R$)" value={dividendAmount} onChange={(event) => setDividendAmount(event.target.value)} />
              <Input type="date" value={dividendDate} onChange={(event) => setDividendDate(event.target.value)} aria-label="Data de recebimento" />
              <Input placeholder="Descrição opcional" value={dividendNote} onChange={(event) => setDividendNote(event.target.value)} />
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" onClick={() => void addDividend()}>Registrar provento</Button>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Minha carteira</h3>
        {busy ? (
          <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sua carteira está vazia. Adicione seu primeiro ativo acima para acompanhar rentabilidade e distribuição.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((asset) => {
              const cost = asset.quantity * asset.average_price_cents;
              const value = asset.quantity * asset.current_price_cents;
              const result = value - cost;
              return (
                <div key={asset.id} className="grid gap-3 border-b border-border py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {asset.name} {asset.ticker && <span className="text-xs text-muted-foreground">· {asset.ticker}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{asset.asset_type} · {asset.quantity} unidades</div>
                  </div>
                  <div className="text-sm sm:text-right">
                    <div className="font-semibold">{brl(value)}</div>
                    <div className="text-xs text-muted-foreground">Custo {brl(cost)} · {result >= 0 ? "+" : ""}{brl(result)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-32"
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-label={`Preço atual de ${asset.name}`}
                      value={priceDrafts[asset.id] ?? ""}
                      onChange={(event) => setPriceDrafts((current) => ({ ...current, [asset.id]: event.target.value }))}
                    />
                    <Button size="icon" variant="outline" aria-label={`Atualizar preço de ${asset.name}`} onClick={() => void updatePrice(asset)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Excluir ${asset.name}`} onClick={() => void removeAsset(asset)}>
                      <Trash2 className="h-4 w-4 text-expense" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Histórico de proventos</h3>
        {dividends.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">Os dividendos e juros registrados aparecerão aqui.</p>
        ) : (
          <div className="space-y-2">
            {dividends.slice(0, 20).map((dividend) => (
              <div key={dividend.id} className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {rows.find((asset) => asset.id === dividend.investment_id)?.name ?? "Ativo"}{dividend.note ? ` · ${dividend.note}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{dividend.paid_at}</span>
                <strong className="text-sm text-income">+{brl(dividend.amount_cents)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  positive = true,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className={`mt-2 text-xl font-bold ${positive ? "" : "text-expense"}`}>{value}</div>
    </div>
  );
}
