import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageTitle, useTxDialog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  bankBalance,
  brl,
  fmtDate,
  formatCentsInput,
  formatCurrencyInput,
  isPendingPayable,
  loadUserData,
  monthKey,
  parseCurrencyInput,
  setState,
  useStore,
  type Tx,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/a-pagar")({
  head: () => ({
    meta: [
      { title: "A pagar — BolsoFirme" },
      {
        name: "description",
        content: "Organize contas pendentes e acompanhe a previsão de saldo.",
      },
    ],
  }),
  component: A_pagar,
});

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isValidDate(iso: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return false;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return (
    date.getFullYear() === Number(parts[1]) &&
    date.getMonth() === Number(parts[2]) - 1 &&
    date.getDate() === Number(parts[3])
  );
}

function initialHorizon(today: string, pending: Tx[]): string {
  const month = monthKey(new Date(`${today}T12:00:00`));
  const [year, monthNumber] = month.split("-").map(Number);
  const endOfMonth = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
  const nextDue = pending
    .map((transaction) => transaction.dueDate)
    .filter((dueDate): dueDate is string => !!dueDate && dueDate >= today)
    .sort()[0];
  return nextDue && nextDue > endOfMonth ? nextDue : endOfMonth;
}

function A_pagar() {
  const store = useStore();
  const openTransaction = useTxDialog();
  const today = todayKey();
  const pending = store.txs.filter(isPendingPayable);
  const [horizon, setHorizon] = useState(() => initialHorizon(today, pending));
  const horizonTouched = useRef(false);
  const [paying, setPaying] = useState<Tx | null>(null);
  const nextWeek = addDays(today, 7);
  const currentMonth = monthKey(new Date(`${today}T12:00:00`));
  const overdue = pending
    .filter((transaction) => !!transaction.dueDate && transaction.dueDate < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const upcoming = pending
    .filter(
      (transaction) =>
        !!transaction.dueDate && transaction.dueDate >= today && transaction.dueDate <= nextWeek,
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const later = pending
    .filter((transaction) => !!transaction.dueDate && transaction.dueDate > nextWeek)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const monthPayables = pending.filter((transaction) =>
    transaction.dueDate?.startsWith(currentMonth),
  );
  const suggestedHorizon = initialHorizon(today, pending);
  const currentBalance = store.banks.reduce(
    (total, bank) => total + bankBalance(store, bank.id),
    0,
  );
  let projectedBalance = currentBalance;
  const forecast = pending
    .filter((transaction) => !!transaction.dueDate && transaction.dueDate <= horizon)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .map((transaction) => {
      projectedBalance -= transaction.amount;
      return { transaction, projectedBalance };
    });
  const firstNegative = forecast.find((item) => item.projectedBalance < 0);
  const endingBalance = forecast.at(-1)?.projectedBalance ?? currentBalance;

  useEffect(() => {
    if (!horizonTouched.current) setHorizon(suggestedHorizon);
  }, [suggestedHorizon]);

  const updateSeriesStatus = async (
    seriesId: string,
    status: "ativa" | "pausada" | "encerrada",
  ) => {
    try {
      const { error } = await supabase.rpc("set_payable_series_status", {
        p_series_id: seriesId,
        p_status: status,
      });
      if (error) throw error;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      await loadUserData(user.id, true);
      toast.success(
        status === "pausada"
          ? "Recorrência pausada."
          : status === "encerrada"
            ? "Recorrência encerrada."
            : "Recorrência retomada.",
      );
    } catch (error) {
      console.error("[Payables] Failed to update recurring series.", error);
      toast.error("Não foi possível atualizar a recorrência.");
    }
  };

  const removePayable = async (transaction: Tx) => {
    if (
      !confirm(
        transaction.payableSeriesId
          ? "Excluir esta conta e encerrar a recorrência? Isso não altera saldos."
          : "Excluir esta conta a pagar? Isso não altera saldos.",
      )
    ) {
      return;
    }
    try {
      if (transaction.payableSeriesId) {
        const { error } = await supabase.rpc("set_payable_series_status", {
          p_series_id: transaction.payableSeriesId,
          p_status: "encerrada",
        });
        if (error) throw error;
      }
      if (transaction.attachmentPath) {
        const { error } = await supabase.storage
          .from("transaction-receipts")
          .remove([transaction.attachmentPath]);
        if (error) throw error;
      }
      setState((current) => ({
        ...current,
        txs: current.txs.filter((item) => item.id !== transaction.id),
      }));
      toast.success("Conta a pagar excluída.");
    } catch (error) {
      console.error("[Payables] Failed to delete payable transaction.", error);
      toast.error("Não foi possível excluir a conta a pagar.");
    }
  };

  const renderGroup = (title: string, items: Tx[], tone: "danger" | "warning" | "neutral") => (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2
        className={cn(
          "mb-3 flex items-center gap-2 font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-amber-700 dark:text-amber-300",
        )}
      >
        {tone === "danger" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CalendarClock className="h-4 w-4" />
        )}
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nenhuma conta nesta faixa.</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((transaction) => {
            const category = store.categories.find((item) => item.id === transaction.categoryId);
            const series = store.payableSeries?.find(
              (item) => item.id === transaction.payableSeriesId,
            );
            const days = Math.ceil(
              (new Date(`${transaction.dueDate}T12:00:00`).getTime() -
                new Date(`${today}T12:00:00`).getTime()) /
                86_400_000,
            );
            return (
              <article key={transaction.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {category?.icon} {category?.name ?? "Sem categoria"} · vence{" "}
                    {fmtDate(transaction.dueDate ?? transaction.date)} ·{" "}
                    {days < 0
                      ? `${Math.abs(days)} dia(s) de atraso`
                      : days === 0
                        ? "vence hoje"
                        : `faltam ${days} dia(s)`}
                  </p>
                  {series && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recorrência mensal · {series.status}
                    </p>
                  )}
                </div>
                <strong className="mr-2 whitespace-nowrap">{brl(transaction.amount)}</strong>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" onClick={() => setPaying(transaction)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Pagar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Editar ${transaction.description}`}
                    onClick={() => openTransaction(transaction)}
                  >
                    Editar
                  </Button>
                  {series && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={
                          series.status === "pausada" ? "Retomar recorrência" : "Pausar recorrência"
                        }
                        title={
                          series.status === "pausada" ? "Retomar recorrência" : "Pausar recorrência"
                        }
                        onClick={() =>
                          void updateSeriesStatus(
                            series.id,
                            series.status === "pausada" ? "ativa" : "pausada",
                          )
                        }
                      >
                        {series.status === "pausada" ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </Button>
                      {series.status !== "encerrada" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Encerrar recorrência"
                          title="Encerrar recorrência"
                          onClick={() => {
                            if (
                              confirm(
                                "Encerrar esta recorrência? A conta atual continuará disponível.",
                              )
                            ) {
                              void updateSeriesStatus(series.id, "encerrada");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir ${transaction.description}`}
                    onClick={() => void removePayable(transaction)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <PageTitle
        title="A pagar"
        sub="Contas pendentes não alteram saldos nem totais de caixa até serem pagas."
        action={
          <Button onClick={() => openTransaction(null)}>
            <CalendarClock className="h-4 w-4" />
            Nova conta a pagar
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          title="A pagar neste mês"
          value={monthPayables.reduce((sum, transaction) => sum + transaction.amount, 0)}
        />
        <SummaryCard
          title="Vencido"
          value={overdue.reduce((sum, transaction) => sum + transaction.amount, 0)}
          danger={overdue.length > 0}
        />
        <SummaryCard
          title={`Saldo projetado até ${fmtDate(horizon)}`}
          value={endingBalance}
          danger={endingBalance < 0}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Previsão de saldo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldo atual {brl(currentBalance)} · contas até {fmtDate(horizon)}:{" "}
              {brl(forecast.reduce((sum, item) => sum + item.transaction.amount, 0))}
            </p>
          </div>
          <div>
            <Label htmlFor="payables-horizon">Projetar até</Label>
            <Input
              id="payables-horizon"
              type="date"
              min={today}
              value={horizon}
              onChange={(event) => {
                horizonTouched.current = true;
                if (isValidDate(event.target.value)) setHorizon(event.target.value);
              }}
            />
          </div>
        </div>
        {firstNegative && (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Saldo projetado negativo de {brl(Math.abs(firstNegative.projectedBalance))} em{" "}
            {fmtDate(firstNegative.transaction.dueDate ?? firstNegative.transaction.date)}, após o
            vencimento de “{firstNegative.transaction.description}”.
          </p>
        )}
        {store.banks.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {store.banks.map((bank) => (
              <div
                key={bank.id}
                className="flex justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm"
              >
                <span>{bank.name}</span>
                <span className="font-medium">{brl(bankBalance(store, bank.id))}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 divide-y divide-border">
          {forecast.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhuma conta com vencimento até a data escolhida.
            </p>
          ) : (
            forecast.map(({ transaction, projectedBalance }) => (
              <div
                key={transaction.id}
                className="flex flex-wrap justify-between gap-2 py-2 text-sm"
              >
                <span>
                  {fmtDate(transaction.dueDate ?? transaction.date)} · {transaction.description}
                </span>
                <span className="font-medium">
                  −{brl(transaction.amount)} · saldo {brl(projectedBalance)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {renderGroup("Vencidas", overdue, "danger")}
      {renderGroup("Próximos 7 dias", upcoming, "warning")}
      {renderGroup("Mais tarde", later, "neutral")}
      <PaymentDialog transaction={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={cn("mt-2 text-xl font-bold", danger && "text-destructive")}>{brl(value)}</p>
    </div>
  );
}

function PaymentDialog({ transaction, onClose }: { transaction: Tx | null; onClose: () => void }) {
  const store = useStore();
  const today = todayKey();
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setBankId(store.banks[0]?.id ?? "");
    setAmount(formatCentsInput(transaction.amount));
    setDate(todayKey());
  }, [transaction, store.banks]);

  const cents = parseCurrencyInput(amount);
  const selectedBalance = bankId ? bankBalance(store, bankId) : 0;
  const insufficient = !Number.isInteger(cents) || cents <= 0 || cents > selectedBalance;

  const save = async () => {
    if (!transaction || saving) return;
    if (!bankId) {
      toast.error("Selecione uma conta de origem.");
      return;
    }
    if (!Number.isInteger(cents) || cents <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!isValidDate(date)) {
      toast.error("Informe uma data de pagamento válida.");
      return;
    }
    if (date > todayKey()) {
      toast.error("A data do pagamento não pode estar no futuro.");
      return;
    }
    if (!confirm(`Confirmar o pagamento de ${brl(cents)} em ${fmtDate(date)}?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("pay_payable_transaction", {
        p_transaction_id: transaction.id,
        p_amount_cents: cents,
        p_bank_id: bankId,
        p_paid_at: date,
      });
      if (error) throw error;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      await loadUserData(user.id, true);
      toast.success("Conta paga.");
      onClose();
    } catch (error) {
      console.error("[Payables] Failed to pay payable transaction.", error);
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("insufficient bank balance")
          ? "Saldo insuficiente na conta selecionada."
          : "Não foi possível registrar o pagamento.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar conta</DialogTitle>
        </DialogHeader>
        {transaction && (
          <p className="text-sm text-muted-foreground">
            {transaction.description} · valor previsto {brl(transaction.amount)}
          </p>
        )}
        <div className="grid gap-3">
          <div>
            <Label htmlFor="payable-bank">Conta de origem</Label>
            <select
              id="payable-bank"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={bankId}
              onChange={(event) => setBankId(event.target.value)}
            >
              <option value="">Selecione uma conta</option>
              {store.banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name} · saldo {brl(bankBalance(store, bank.id))}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="payable-payment-amount">Valor pago (R$)</Label>
              <Input
                id="payable-payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(formatCurrencyInput(event.target.value))}
                aria-label="Valor total pago em reais"
              />
            </div>
            <div>
              <Label htmlFor="payable-payment-date">Data do pagamento</Label>
              <Input
                id="payable-payment-date"
                type="date"
                max={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>
          {bankId && (
            <p
              className={cn(
                "rounded-md p-2 text-sm",
                insufficient
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground",
              )}
              role={insufficient ? "alert" : undefined}
            >
              {insufficient
                ? `Saldo insuficiente. Disponível: ${brl(selectedBalance)}.`
                : `Saldo estimado após o pagamento: ${brl(selectedBalance - cents)}.`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || insufficient || !transaction}>
            {saving ? "Salvando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
