import { useSyncExternalStore } from "react";

export type TxType = "receita" | "despesa";
export type TransactionType = TxType | "pagamento_fatura";
export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
}
export interface Bank {
  id: string;
  name: string;
  color: string;
  logo?: string;
  kind: "Conta Corrente" | "Conta Digital" | "Conta Investimento";
  initial: number;
}
export interface CardC {
  id: string;
  name: string;
  bank: string;
  brand?: string;
  color: string;
  limit: number;
  closing: number;
  due: number;
}
export interface CreditCardInvoice {
  id: string;
  cardId: string;
  dueMonth: string;
  closingDate: string;
  dueDate: string;
}
export interface Tx {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  referenceMonth?: string | undefined;
  categoryId: string;
  bankId?: string | undefined;
  cardId?: string | undefined;
  invoiceId?: string | undefined;
  paid?: boolean | undefined;
  installmentGroupId?: string | undefined;
  installmentNumber?: number | undefined;
  installmentCount?: number | undefined;
  recurrenceGroupId?: string | undefined;
  recurrenceFrequency?: RecurrenceFrequency | undefined;
  recurrenceNumber?: number | undefined;
  recurrenceCount?: number | undefined;
  attachmentPath?: string | undefined;
}
export interface State {
  categories: Category[];
  banks: Bank[];
  cards: CardC[];
  invoices: CreditCardInvoice[];
  txs: Tx[];
}

function parseRecurrenceFrequency(value: string | null): RecurrenceFrequency | undefined {
  if (value === null) return undefined;
  if (value === "weekly" || value === "monthly" || value === "yearly") return value;
  throw new RangeError(`Invalid recurrence frequency: ${value}`);
}

export const uid = () => crypto.randomUUID();
const PALETTE = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ec4899",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
  "#06b6d4",
  "#f43f5e",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#64748b",
];
export const MINIMUM_DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Mercado", icon: "🛒", color: "#22c55e", type: "despesa" },
  { name: "Salário", icon: "💰", color: "#3b82f6", type: "receita" },
];

function seedCategories(): Category[] {
  return MINIMUM_DEFAULT_CATEGORIES.map((category) => ({
    id: uid(),
    ...category,
  }));
}

const empty: State = { categories: [], banks: [], cards: [], invoices: [], txs: [] };
let state: State = empty;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/* ---------- mapping to/from the database ---------- */
const toRow = {
  categories: (c: Category, u: string) => ({
    id: c.id,
    user_id: u,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: c.type,
  }),
  banks: (b: Bank, u: string) => ({
    id: b.id,
    user_id: u,
    name: b.name,
    color: b.color,
    logo: b.logo ?? "",
    kind: b.kind,
    initial_cents: b.initial,
  }),
  cards: (c: CardC, u: string) => ({
    id: c.id,
    user_id: u,
    name: c.name,
    bank: c.bank,
    brand: c.brand ?? "",
    color: c.color,
    limit_cents: c.limit,
    closing_day: c.closing,
    due_day: c.due,
  }),
  invoices: (i: CreditCardInvoice, u: string) => ({
    id: i.id,
    user_id: u,
    card_id: i.cardId,
    due_month: i.dueMonth,
    closing_date: i.closingDate,
    due_date: i.dueDate,
  }),
  transactions: (t: Tx, u: string) => ({
    id: t.id,
    user_id: u,
    description: t.description,
    amount_cents: t.amount,
    type: t.type,
    date: t.date,
    reference_month: t.referenceMonth ?? null,
    category_id: t.categoryId || null,
    bank_id: t.bankId ?? null,
    card_id: t.cardId ?? null,
    invoice_id: t.invoiceId ?? null,
    paid: !!t.paid,
    installment_group_id: t.installmentGroupId ?? null,
    installment_number: t.installmentNumber ?? 1,
    installment_count: t.installmentCount ?? 1,
    recurrence_group_id: t.recurrenceGroupId ?? null,
    recurrence_frequency: t.recurrenceFrequency ?? null,
    recurrence_number: t.recurrenceNumber ?? 1,
    recurrence_count: t.recurrenceCount ?? 1,
    attachment_path: t.attachmentPath ?? null,
  }),
};

/** Loads the signed-in user's data; seeds default categories, banks and cards on first use. */
export async function loadUserData(userId: string) {
  if (loadedFor === userId) return;
  const { supabase } = await import("@/integrations/supabase/client");
  const db = supabase;
  const [c, b, k, i, t, settings] = await Promise.all([
    db.from("categories").select("*").eq("user_id", userId).order("created_at"),
    db.from("banks").select("*").eq("user_id", userId).order("created_at"),
    db.from("cards").select("*").eq("user_id", userId).order("created_at"),
    db.from("credit_card_invoices").select("*").eq("user_id", userId).order("due_month"),
    db.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }),
    db.from("user_settings").select("onboarding_complete").eq("user_id", userId).maybeSingle(),
  ]);
  const err = c.error || b.error || k.error || i.error || t.error || settings.error;
  if (err) throw err;
  let next: State = {
    categories: (c.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      type: r.type === "receita" ? "receita" : "despesa",
    })),
    banks: (b.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      logo: r.logo ?? "",
      kind: r.kind as Bank["kind"],
      initial: Number(r.initial_cents),
    })),
    cards: (k.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      bank: r.bank,
      brand: r.brand ?? "",
      color: r.color,
      limit: Number(r.limit_cents),
      closing: r.closing_day,
      due: r.due_day,
    })),
    invoices: (i.data ?? []).map((r) => ({
      id: r.id,
      cardId: r.card_id,
      dueMonth: r.due_month,
      closingDate: r.closing_date,
      dueDate: r.due_date,
    })),
    txs: (t.data ?? []).map((r) => ({
      id: r.id,
      description: r.description,
      amount: Number(r.amount_cents),
      type: r.type as TransactionType,
      date: r.date,
      referenceMonth: r.reference_month ?? undefined,
      categoryId: r.category_id ?? "",
      bankId: r.bank_id ?? undefined,
      cardId: r.card_id ?? undefined,
      invoiceId: r.invoice_id ?? undefined,
      paid: r.paid,
      installmentGroupId: r.installment_group_id ?? undefined,
      installmentNumber: r.installment_number,
      installmentCount: r.installment_count,
      recurrenceGroupId: r.recurrence_group_id ?? undefined,
      recurrenceFrequency: parseRecurrenceFrequency(r.recurrence_frequency),
      recurrenceNumber: r.recurrence_number,
      recurrenceCount: r.recurrence_count,
      attachmentPath: r.attachment_path ?? undefined,
    })),
  };
  if (next.categories.length === 0 && settings.data?.onboarding_complete) {
    next = { ...next, categories: seedCategories() };
    const { error } = await supabase
      .from("categories")
      .insert(next.categories.map((x) => toRow.categories(x, userId)));
    if (error) throw error;
  }
  state = next;
  loadedFor = userId;
  emit();
}
export function resetStore() {
  state = empty;
  loadedFor = null;
  emit();
}

type TableKey = keyof typeof toRow;
const tableName: Record<
  TableKey,
  "categories" | "banks" | "cards" | "credit_card_invoices" | "transactions"
> = {
  categories: "categories",
  banks: "banks",
  cards: "cards",
  invoices: "credit_card_invoices",
  transactions: "transactions",
};
const stateKey: Record<TableKey, keyof State> = {
  categories: "categories",
  banks: "banks",
  cards: "cards",
  invoices: "invoices",
  transactions: "txs",
};

/** Updates the screen immediately, then saves the differences to the database. */
export function setState(fn: (s: State) => State) {
  const prev = state;
  const next = fn(state);
  state = next;
  emit();
  const userId = loadedFor;
  if (!userId) return;
  void (async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const db = supabase;
    // Write order respects references: parents first for upserts, children first for deletes.
    const order: TableKey[] = ["categories", "banks", "cards", "invoices", "transactions"];
    try {
      for (const tbl of order) {
        const k = stateKey[tbl];
        const before = new Map((prev[k] as { id: string }[]).map((x) => [x.id, x]));
        const changed = (next[k] as { id: string }[]).filter((x) => before.get(x.id) !== x);
        if (changed.length) {
          const { error } = await db
            .from(tableName[tbl])
            .upsert(
              changed.map((x) => (toRow[tbl] as (v: unknown, u: string) => never)(x, userId)),
            );
          if (error) throw error;
        }
      }
      for (const tbl of [...order].reverse()) {
        const k = stateKey[tbl];
        const keep = new Set((next[k] as { id: string }[]).map((x) => x.id));
        const removed = (prev[k] as { id: string }[])
          .filter((x) => !keep.has(x.id))
          .map((x) => x.id);
        if (removed.length) {
          const { error } = await db.from(tableName[tbl]).delete().in("id", removed);
          if (error) throw error;
        }
      }
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("Não foi possível salvar no banco de dados");
      console.error(e);
      state = prev;
      emit();
    }
  })();
}
export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}
export function useLoaded() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => loadedFor !== null,
    () => false,
  );
}

export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (d: Date) => {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function dateFromIso(iso: string): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) throw new RangeError(`Invalid ISO date: ${iso}`);
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError(`Invalid ISO date: ${iso}`);
  }
  return date;
}

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateAtDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** Returns the invoice due month for a card purchase date. */
export function cardInvoiceKey(date: string, card: Pick<CardC, "closing" | "due">): string {
  const purchase = dateFromIso(date);
  const closingMonth = new Date(
    purchase.getFullYear(),
    purchase.getMonth() + (purchase.getDate() > card.closing ? 1 : 0),
    1,
  );
  const dueMonth = new Date(
    closingMonth.getFullYear(),
    closingMonth.getMonth() + (card.due <= card.closing ? 1 : 0),
    1,
  );
  return monthKey(dueMonth);
}

/** Gets the statement closing date and payment due date for a due month (YYYY-MM). */
export function cardInvoiceDates(
  dueMonthKey: string,
  card: Pick<CardC, "closing" | "due">,
): { closingDate: string; dueDate: string } {
  const { year, month } = parseMonthKey(dueMonthKey);
  const dueDate = dateAtDay(year, month - 1, card.due);
  const closingMonth = new Date(year, month - 1 - (card.due <= card.closing ? 1 : 0), 1);
  const closingDate = dateAtDay(closingMonth.getFullYear(), closingMonth.getMonth(), card.closing);
  return { closingDate: dateToIso(closingDate), dueDate: dateToIso(dueDate) };
}

export function invoiceMonth(invoice: CreditCardInvoice): string {
  return invoice.dueMonth.slice(0, 7);
}

export function transactionInvoiceMonth(
  transaction: Tx,
  card: CardC,
  invoices: CreditCardInvoice[],
): string {
  const invoice = transaction.invoiceId
    ? invoices.find((item) => item.id === transaction.invoiceId)
    : undefined;
  return invoice ? invoiceMonth(invoice) : cardInvoiceKey(transaction.date, card);
}

export function invoiceSummary(
  invoice: CreditCardInvoice,
  transactions: Tx[],
  card?: CardC,
  today = dateToIso(new Date()),
) {
  const month = invoiceMonth(invoice);
  const items = transactions.filter(
    (transaction) =>
      transaction.type === "despesa" &&
      transaction.cardId === invoice.cardId &&
      (transaction.invoiceId === invoice.id ||
        (!transaction.invoiceId && card && cardInvoiceKey(transaction.date, card) === month)),
  );
  const payments = transactions.filter(
    (transaction) =>
      transaction.type === "pagamento_fatura" && transaction.invoiceId === invoice.id,
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const legacyPaid = items.filter((item) => item.paid).reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const settled = legacyPaid + paymentTotal;
  const outstanding = Math.max(0, total - settled);
  const status =
    items.length === 0
      ? "Sem lançamentos"
      : outstanding <= 0
        ? "Paga"
        : settled > 0
          ? "Parcialmente paga"
          : invoice.dueDate < today
            ? "Vencida"
            : invoice.closingDate <= today
              ? "Fechada · em aberto"
              : "Aberta";
  return { items, payments, total, settled, outstanding, status };
}

function parseMonthKey(key: string): { year: number; month: number } {
  const parts = /^(\d{4})-(\d{2})$/.exec(key);
  if (!parts) throw new RangeError(`Invalid month key: ${key}`);
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  if (month < 1 || month > 12) throw new RangeError(`Invalid month key: ${key}`);
  return { year, month };
}

/** Advances a purchase date by whole calendar months, clamping to each month's last day. */
export function addMonthsToDate(iso: string, months: number): string {
  const date = dateFromIso(iso);
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return dateToIso(dateAtDay(targetMonth.getFullYear(), targetMonth.getMonth(), date.getDate()));
}

/** Advances a recurring transaction date without drifting across short months. */
export function addRecurrenceDate(
  iso: string,
  frequency: RecurrenceFrequency,
  step: number,
): string {
  const date = dateFromIso(iso);
  if (!Number.isInteger(step) || step < 0) throw new RangeError(`Invalid recurrence step: ${step}`);
  if (frequency === "monthly") return addMonthsToDate(iso, step);
  const target = new Date(date);
  if (frequency === "weekly") {
    target.setDate(target.getDate() + step * 7);
    return dateToIso(target);
  }
  const year = date.getFullYear() + step;
  return dateToIso(dateAtDay(year, date.getMonth(), date.getDate()));
}

/** Totais do mês. Compras de cartão contam como saída pela data da compra. */
export function monthTotals(txs: Tx[], month: string, bankId?: string) {
  const list = txs.filter(
    (transaction) =>
      (transaction.type === "receita"
        ? transactionReferenceMonth(transaction)
        : transaction.date.slice(0, 7)) === month &&
      (!bankId || transaction.bankId === bankId),
  );
  const income = list.filter((t) => t.type === "receita").reduce((a, t) => a + t.amount, 0);
  const expense = list.filter((t) => t.type === "despesa").reduce((a, t) => a + t.amount, 0);
  const cashIncome = txs
    .filter(
      (transaction) =>
        transaction.type === "receita" &&
        transaction.date.startsWith(month) &&
        (!bankId || transaction.bankId === bankId),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { list, income, cashIncome, expense, balance: cashIncome - expense };
}
export function transactionReferenceMonth(transaction: Tx): string {
  return transaction.referenceMonth?.slice(0, 7) ?? transaction.date.slice(0, 7);
}
/** Saldo do banco considera só transações com bankId. */
export function bankBalance(s: State, bankId: string) {
  const b = s.banks.find((x) => x.id === bankId);
  const today = dateToIso(new Date());
  return s.txs
    .filter((t) => t.bankId === bankId && (!t.recurrenceGroupId || t.date <= today))
    .reduce((a, t) => a + (t.type === "receita" ? t.amount : -t.amount), b?.initial ?? 0);
}
/** Limite usado = compras de cartão ainda não pagas. */
export function cardUsed(s: State, cardId: string) {
  const today = dateToIso(new Date());
  const card = s.cards.find((item) => item.id === cardId);
  const invoiceIds = new Set(
    s.invoices.filter((invoice) => invoice.cardId === cardId).map((invoice) => invoice.id),
  );
  const outstandingByInvoice = new Map<string, number>();
  for (const transaction of s.txs) {
    if (
      transaction.cardId !== cardId ||
      transaction.type !== "despesa" ||
      transaction.paid ||
      (transaction.recurrenceGroupId && transaction.date > today)
    ) {
      continue;
    }
    const key =
      transaction.invoiceId ??
      (card ? cardInvoiceKey(transaction.date, card) : `unassigned:${transaction.id}`);
    outstandingByInvoice.set(key, (outstandingByInvoice.get(key) ?? 0) + transaction.amount);
  }
  for (const transaction of s.txs) {
    if (
      transaction.type === "pagamento_fatura" &&
      transaction.invoiceId &&
      invoiceIds.has(transaction.invoiceId)
    ) {
      outstandingByInvoice.set(
        transaction.invoiceId,
        (outstandingByInvoice.get(transaction.invoiceId) ?? 0) - transaction.amount,
      );
    }
  }
  return [...outstandingByInvoice.values()].reduce(
    (total, outstanding) => total + Math.max(0, outstanding),
    0,
  );
}
export { PALETTE };
