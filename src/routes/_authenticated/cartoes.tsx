import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CreditCard, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import { MonthPicker, PageTitle } from "@/components/AppShell";
import {
  brl,
  cardInvoiceDates,
  cardInvoiceKey,
  cardUsed,
  fmtDate,
  monthKey,
  monthLabel,
  setState,
  uid,
  useStore,
  type CardC,
  type Tx,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões de Crédito — BolsoFirme" },
      { name: "description", content: "Gerencie cartões, parcelas e faturas." },
      { property: "og:title", content: "Cartões de Crédito — BolsoFirme" },
      { property: "og:description", content: "Gerencie cartões, parcelas e faturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cartoes,
});

type InvoiceSelection = { card: CardC; month: string };
const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function monthDate(key: string): Date {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month - 1, 1);
}

function parseMonthKey(key: string): { year: number; month: number } {
  const parts = /^(\d{4})-(\d{2})$/.exec(key);
  if (!parts) throw new RangeError(`Invalid month key: ${key}`);
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  if (month < 1 || month > 12) throw new RangeError(`Invalid month key: ${key}`);
  return { year, month };
}

function todayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function daysUntil(isoDate: string): number {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!parts) throw new RangeError(`Invalid ISO date: ${isoDate}`);
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function getInvoiceStatus(card: CardC, month: string, items: Tx[]): string {
  if (!items.length) return "Sem lançamentos";
  if (items.every((item) => item.paid)) return "Paga";
  const dates = cardInvoiceDates(month, card);
  if (dates.dueDate < todayKey()) return "Vencida";
  if (dates.closingDate <= todayKey()) return "Fechada · em aberto";
  return "Aberta";
}

function Cartoes() {
  const store = useStore();
  const [date, setDate] = useState(() => new Date());
  const [invoice, setInvoice] = useState<InvoiceSelection | null>(null);
  const [config, setConfig] = useState<{ open: boolean; card: CardC | null }>({
    open: false,
    card: null,
  });
  const selectedMonth = monthKey(date);
  const projectionMonths = Array.from({ length: 3 }, (_, index) =>
    monthKey(new Date(new Date().getFullYear(), new Date().getMonth() + index, 1)),
  );
  const projectedInvoices = projectionMonths.map((month) => ({
    month,
    total: store.txs
      .filter(
        (transaction) =>
          transaction.cardId &&
          !transaction.paid &&
          store.cards.some((card) => card.id === transaction.cardId) &&
          store.cards.some(
            (card) =>
              card.id === transaction.cardId && cardInvoiceKey(transaction.date, card) === month,
          ),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  }));

  return (
    <div className="space-y-5">
      <PageTitle
        title="Cartões de crédito"
        sub="Acompanhe limites, compras parceladas e faturas por vencimento."
        action={
          <Button onClick={() => setConfig({ open: true, card: null })}>
            <Plus className="h-4 w-4" />
            Adicionar cartão
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker date={date} onChange={setDate} prefix="Faturas de " />
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
          {store.cards.length} {store.cards.length === 1 ? "cartão" : "cartões"}
        </span>
      </div>

      {store.cards.length > 0 && (
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Projeção das próximas faturas</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {projectedInvoices.map(({ month, total }) => (
              <div key={month} className="rounded-lg bg-secondary/70 p-3">
                <p className="text-sm capitalize text-muted-foreground">
                  {monthLabel(monthDate(month))}
                </p>
                <p className="mt-1 text-lg font-bold">{brl(total)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {store.cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold">Nenhum cartão cadastrado</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Cadastre um cartão para acompanhar limite disponível, parcelas e vencimentos.
          </p>
          <Button className="mt-4" onClick={() => setConfig({ open: true, card: null })}>
            <Plus className="h-4 w-4" />
            Cadastrar cartão
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {store.cards.map((card) => {
            const used = cardUsed(store, card.id);
            const available = card.limit - used;
            const percentage = card.limit > 0 ? (used / card.limit) * 100 : 0;
            const invoiceItems = store.txs.filter(
              (transaction) =>
                transaction.cardId === card.id &&
                cardInvoiceKey(transaction.date, card) === selectedMonth,
            );
            const invoiceTotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
            const outstanding = store.txs
              .filter((transaction) => transaction.cardId === card.id && !transaction.paid)
              .map((transaction) => {
                const month = cardInvoiceKey(transaction.date, card);
                const dates = cardInvoiceDates(month, card);
                return { month, dueDate: dates.dueDate };
              })
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const nextDue = outstanding[0];
            const daysToDue = nextDue ? daysUntil(nextDue.dueDate) : null;
            const dueWarning = daysToDue !== null && daysToDue <= 7;
            const invoiceDates = cardInvoiceDates(selectedMonth, card);
            const invoiceStatus = getInvoiceStatus(card, selectedMonth, invoiceItems);

            return (
              <article key={card.id} className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: `${card.color}22`, color: card.color }}
                    >
                      <CreditCard className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{card.name}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {[card.brand, card.bank].filter(Boolean).join(" · ") || "Cartão"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      invoiceStatus === "Vencida"
                        ? "bg-destructive/10 text-destructive"
                        : invoiceStatus === "Paga"
                          ? "bg-income/10 text-income"
                          : "bg-warning/10 text-warning",
                    )}
                  >
                    {invoiceStatus}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs text-muted-foreground">Limite disponível</p>
                    <p className="mt-1 text-lg font-bold">{brl(available)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs text-muted-foreground">
                      Fatura de {monthLabel(monthDate(selectedMonth))}
                    </p>
                    <p className="mt-1 text-lg font-bold">{brl(invoiceTotal)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Limite utilizado</span>
                    <span>
                      {brl(used)} / {brl(card.limit)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-label={`Limite utilizado no cartão ${card.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.max(0, percentage))}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        percentage <= 50
                          ? "bg-income"
                          : percentage <= 80
                            ? "bg-warning"
                            : "bg-expense",
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% utilizado
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Fechamento da fatura</p>
                    <p>
                      Dia {card.closing} · {fmtDate(invoiceDates.closingDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p>
                      Dia {card.due} · {fmtDate(invoiceDates.dueDate)}
                    </p>
                  </div>
                </div>

                {dueWarning && nextDue && daysToDue !== null && (
                  <div
                    className={cn(
                      "mt-4 flex items-start gap-2 rounded-lg p-3 text-sm",
                      daysToDue < 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/10 text-warning",
                    )}
                    role="status"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {daysToDue < 0
                        ? `Fatura vencida em ${fmtDate(nextDue.dueDate)}.`
                        : daysToDue === 0
                          ? "A fatura vence hoje."
                          : `A próxima fatura vence em ${daysToDue} ${daysToDue === 1 ? "dia" : "dias"}.`}
                    </span>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setInvoice({ card, month: selectedMonth })}
                  >
                    Ver fatura
                  </Button>
                  <Button variant="outline" onClick={() => setConfig({ open: true, card })}>
                    Configurar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <InvoiceDialog invoice={invoice} onClose={() => setInvoice(null)} />
      <CardDialog
        open={config.open}
        card={config.card}
        onOpenChange={(open) => setConfig((current) => ({ ...current, open }))}
      />
    </div>
  );
}

function InvoiceDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceSelection | null;
  onClose: () => void;
}) {
  const store = useStore();
  const items = invoice
    ? store.txs
        .filter(
          (transaction) =>
            transaction.cardId === invoice.card.id &&
            cardInvoiceKey(transaction.date, invoice.card) === invoice.month,
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const unpaid = items.filter((item) => !item.paid);
  const total = unpaid.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = items.filter((item) => item.paid).reduce((sum, item) => sum + item.amount, 0);
  const status = invoice ? getInvoiceStatus(invoice.card, invoice.month, items) : "Sem lançamentos";
  const dates = invoice ? cardInvoiceDates(invoice.month, invoice.card) : null;

  const pay = () => {
    if (!invoice || !unpaid.length || !confirm("Confirmar pagamento desta fatura?")) return;
    const unpaidIds = new Set(unpaid.map((item) => item.id));
    setState((current) => ({
      ...current,
      txs: current.txs.map((transaction) =>
        unpaidIds.has(transaction.id) ? { ...transaction, paid: true } : transaction,
      ),
    }));
    toast.success("Fatura marcada como paga.");
    onClose();
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Fatura — {invoice?.card.name}
            {invoice ? ` · ${monthLabel(monthDate(invoice.month))}` : ""}
          </DialogTitle>
        </DialogHeader>
        {dates && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Fechamento: {fmtDate(dates.closingDate)}</span>
            <span>Vencimento: {fmtDate(dates.dueDate)}</span>
            <span>Status: {status}</span>
          </div>
        )}
        {items.length === 0 ? (
          <div className="rounded-lg bg-secondary/60 p-5 text-center">
            <Wallet className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum lançamento nesta fatura</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compras no cartão aparecerão aqui conforme o ciclo de fechamento.
            </p>
          </div>
        ) : (
          <div className="max-h-72 divide-y overflow-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(item.date)}
                    {item.installmentCount && item.installmentCount > 1
                      ? ` · Parcela ${item.installmentNumber} de ${item.installmentCount}`
                      : ""}
                    {item.paid ? " · Paga" : " · Em aberto"}
                  </p>
                </div>
                <span className={cn("shrink-0 font-medium", item.paid && "text-muted-foreground")}>
                  {brl(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-1 border-t pt-3 text-sm">
          {paidTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Já pago</span>
              <span>{brl(paidTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Em aberto</span>
            <span>{brl(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!total} onClick={pay}>
            Marcar fatura como paga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const blankCard: CardC = {
  id: "",
  name: "",
  bank: "",
  brand: "Visa",
  color: "#3b82f6",
  limit: 0,
  closing: 1,
  due: 10,
};

function CardDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardC | null;
}) {
  const store = useStore();
  const [form, setForm] = useState(blankCard);

  useEffect(() => {
    if (open) setForm(card ?? blankCard);
  }, [card, open]);

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do cartão.");
      return;
    }
    if (
      !Number.isFinite(form.limit) ||
      form.limit < 0 ||
      !Number.isInteger(form.closing) ||
      form.closing < 1 ||
      form.closing > 31 ||
      !Number.isInteger(form.due) ||
      form.due < 1 ||
      form.due > 31
    ) {
      toast.error("Informe limite e dias de fechamento/vencimento válidos.");
      return;
    }
    setState((current) => ({
      ...current,
      cards: card
        ? current.cards.map((item) => (item.id === card.id ? { ...form, id: card.id } : item))
        : [...current.cards, { ...form, id: uid() }],
    }));
    toast.success("Cartão salvo.");
    onOpenChange(false);
  };

  const remove = () => {
    if (!card) return;
    if (store.txs.some((transaction) => transaction.cardId === card.id)) {
      toast.error("Este cartão possui transações vinculadas e não pode ser excluído.");
      return;
    }
    if (!confirm("Excluir este cartão?")) return;
    setState((current) => ({
      ...current,
      cards: current.cards.filter((item) => item.id !== card.id),
    }));
    toast.success("Cartão excluído.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? "Configurar cartão" : "Adicionar cartão"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="card-name">Nome do cartão</Label>
            <Input
              id="card-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: Cartão principal"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="card-brand">Bandeira</Label>
              <select
                id="card-brand"
                className={inputClass}
                value={form.brand ?? "Visa"}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
              >
                {["Visa", "Mastercard", "Elo", "American Express", "Hipercard"].map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="card-bank">Banco</Label>
              <select
                id="card-bank"
                className={inputClass}
                value={form.bank}
                onChange={(event) => {
                  const bank = store.banks.find((item) => item.name === event.target.value);
                  setForm({ ...form, bank: event.target.value, color: bank?.color ?? form.color });
                }}
              >
                <option value="">Selecione</option>
                {store.banks.map((bank) => (
                  <option key={bank.id} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="card-color">Cor</Label>
              <Input
                id="card-color"
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="card-limit">Limite (R$)</Label>
              <Input
                id="card-limit"
                type="number"
                min="0"
                step="0.01"
                value={form.limit / 100}
                onChange={(event) =>
                  setForm({ ...form, limit: Math.round(Number(event.target.value) * 100) })
                }
              />
            </div>
            <div>
              <Label htmlFor="card-closing">Fechamento</Label>
              <Input
                id="card-closing"
                type="number"
                min="1"
                max="31"
                value={form.closing}
                onChange={(event) => setForm({ ...form, closing: Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="card-due">Vencimento</Label>
              <Input
                id="card-due"
                type="number"
                min="1"
                max="31"
                value={form.due}
                onChange={(event) => setForm({ ...form, due: Number(event.target.value) })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O limite disponível é atualizado considerando compras e parcelas ainda não pagas.
          </p>
        </div>
        <DialogFooter className="gap-2">
          {card && (
            <Button variant="destructive" onClick={remove}>
              Excluir
            </Button>
          )}
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
