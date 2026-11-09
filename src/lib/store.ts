import { useSyncExternalStore } from "react";

export type TxType = "receita" | "despesa";
export interface Category { id: string; name: string; icon: string; color: string }
export interface Bank { id: string; name: string; color: string; kind: "Conta Corrente" | "Conta Digital" | "Conta Investimento"; initial: number }
export interface CardC { id: string; name: string; bank: string; color: string; limit: number; closing: number; due: number }
export interface Tx {
  id: string; description: string; amount: number; type: TxType; date: string;
  categoryId: string; bankId?: string | undefined; cardId?: string | undefined; paid?: boolean | undefined;
}
export interface State { categories: Category[]; banks: Bank[]; cards: CardC[]; txs: Tx[] }

export const uid = () => crypto.randomUUID();
const PALETTE = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#ec4899", "#a855f7", "#14b8a6", "#ef4444", "#84cc16", "#06b6d4", "#f43f5e", "#8b5cf6", "#f59e0b", "#10b981", "#64748b"];
const DEFAULT_CATS: [string, string][] = [
  ["Transporte", "🚗"], ["Alimentação", "🍔"], ["Saúde", "💊"], ["Educação", "📚"], ["Lazer", "🎮"],
  ["Streaming", "📺"], ["Internet", "🌐"], ["Vestuário", "👕"], ["Perfume", "🌸"], ["Eletrônicos", "💻"],
  ["Peças", "🔧"], ["Consertos", "🛠️"], ["Empréstimo", "🏦"], ["Curso", "🎓"], ["Salário", "💰"],
];

function seed(): State {
  const categories = DEFAULT_CATS.map(([name, icon], i) => ({ id: uid(), name, icon, color: PALETTE[i % PALETTE.length] as string }));
  const cat = (n: string) => categories.find((c) => c.name === n)!.id;
  const banks: Bank[] = [
    { id: "bb", name: "Banco do Brasil", color: "#eab308", kind: "Conta Corrente", initial: 0 },
    { id: "nu", name: "Nubank", color: "#8b5cf6", kind: "Conta Digital", initial: 0 },
    { id: "inter", name: "Inter", color: "#f97316", kind: "Conta Corrente", initial: 0 },
    { id: "btg", name: "BTG Pactual", color: "#0f172a", kind: "Conta Investimento", initial: 0 },
  ];
  const cards: CardC[] = [
    { id: "k1", name: "Banco do Brasil - Visa", bank: "Banco do Brasil", color: "#eab308", limit: 400000, closing: 8, due: 12 },
    { id: "k2", name: "Nubank - Mastercard", bank: "Nubank", color: "#8b5cf6", limit: 500000, closing: 15, due: 20 },
  ];
  const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = (day: number) => `${y}-${m}-${String(day).padStart(2, "0")}`;
  const txs: Tx[] = [
    { id: uid(), description: "Salário", amount: 250000, type: "receita", date: d(5), categoryId: cat("Salário"), bankId: "bb" },
    { id: uid(), description: "Supermercado", amount: 12300, type: "despesa", date: d(7), categoryId: cat("Alimentação"), bankId: "nu" },
    { id: uid(), description: "Combustível", amount: 8550, type: "despesa", date: d(9), categoryId: cat("Transporte"), bankId: "inter" },
    { id: uid(), description: "Restaurante", amount: 12300, type: "despesa", date: d(3), categoryId: cat("Alimentação"), cardId: "k1" },
    { id: uid(), description: "Notebook", amount: 145678, type: "despesa", date: d(10), categoryId: cat("Eletrônicos"), cardId: "k2" },
  ];
  return { categories, banks, cards, txs };
}

const empty: State = { categories: [], banks: [], cards: [], txs: [] };
let state: State = empty;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/* ---------- mapping to/from the database ---------- */
const toRow = {
  categories: (c: Category, u: string) => ({ id: c.id, user_id: u, name: c.name, icon: c.icon, color: c.color }),
  banks: (b: Bank, u: string) => ({ id: b.id, user_id: u, name: b.name, color: b.color, kind: b.kind, initial_cents: b.initial }),
  cards: (c: CardC, u: string) => ({ id: c.id, user_id: u, name: c.name, bank: c.bank, color: c.color, limit_cents: c.limit, closing_day: c.closing, due_day: c.due }),
  transactions: (t: Tx, u: string) => ({ id: t.id, user_id: u, description: t.description, amount_cents: t.amount, type: t.type, date: t.date, category_id: t.categoryId || null, bank_id: t.bankId ?? null, card_id: t.cardId ?? null, paid: !!t.paid }),
};

/** Loads the signed-in user's data; seeds default categories, banks and cards on first use. */
export async function loadUserData(userId: string) {
  if (loadedFor === userId) return;
  const { supabase } = await import("@/integrations/supabase/client");
  const [c, b, k, t] = await Promise.all([
    supabase.from("categories").select("*").order("created_at"),
    supabase.from("banks").select("*").order("created_at"),
    supabase.from("cards").select("*").order("created_at"),
    supabase.from("transactions").select("*").order("date", { ascending: false }),
  ]);
  const err = c.error || b.error || k.error || t.error;
  if (err) throw err;
  let next: State = {
    categories: (c.data ?? []).map((r) => ({ id: r.id, name: r.name, icon: r.icon, color: r.color })),
    banks: (b.data ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, kind: r.kind as Bank["kind"], initial: Number(r.initial_cents) })),
    cards: (k.data ?? []).map((r) => ({ id: r.id, name: r.name, bank: r.bank, color: r.color, limit: Number(r.limit_cents), closing: r.closing_day, due: r.due_day })),
    txs: (t.data ?? []).map((r) => ({ id: r.id, description: r.description, amount: Number(r.amount_cents), type: r.type as TxType, date: r.date, categoryId: r.category_id ?? "", bankId: r.bank_id ?? undefined, cardId: r.card_id ?? undefined, paid: r.paid })),
  };
  if (next.categories.length === 0) {
    const sd = seed();
    next = { ...next, categories: sd.categories, banks: next.banks.length ? next.banks : sd.banks, cards: next.cards.length ? next.cards : sd.cards };
    await supabase.from("categories").insert(next.categories.map((x) => toRow.categories(x, userId)));
    if (!b.data?.length) await supabase.from("banks").insert(next.banks.map((x) => toRow.banks(x, userId)));
    if (!k.data?.length) await supabase.from("cards").insert(next.cards.map((x) => toRow.cards(x, userId)));
  }
  state = next; loadedFor = userId; emit();
}
export function resetStore() { state = empty; loadedFor = null; emit(); }

type TableKey = keyof typeof toRow;
const stateKey: Record<TableKey, keyof State> = { categories: "categories", banks: "banks", cards: "cards", transactions: "txs" };

/** Updates the screen immediately, then saves the differences to the database. */
export function setState(fn: (s: State) => State) {
  const prev = state; const next = fn(state);
  state = next; emit();
  const userId = loadedFor; if (!userId) return;
  void (async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // Write order respects references: parents first for upserts, children first for deletes.
    const order: TableKey[] = ["categories", "banks", "cards", "transactions"];
    try {
      for (const tbl of order) {
        const k = stateKey[tbl];
        const before = new Map((prev[k] as { id: string }[]).map((x) => [x.id, x]));
        const changed = (next[k] as { id: string }[]).filter((x) => before.get(x.id) !== x);
        if (changed.length) {
          const { error } = await supabase.from(tbl).upsert(changed.map((x) => (toRow[tbl] as (v: unknown, u: string) => never)(x, userId)));
          if (error) throw error;
        }
      }
      for (const tbl of [...order].reverse()) {
        const k = stateKey[tbl];
        const keep = new Set((next[k] as { id: string }[]).map((x) => x.id));
        const removed = (prev[k] as { id: string }[]).filter((x) => !keep.has(x.id)).map((x) => x.id);
        if (removed.length) { const { error } = await supabase.from(tbl).delete().in("id", removed); if (error) throw error; }
      }
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("Não foi possível salvar no banco de dados");
      console.error(e);
      state = prev; emit();
    }
  })();
}
export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => empty);
}
export function useLoaded() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => loadedFor !== null, () => false);
}

export const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (d: Date) => {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Totais do mês. Compras de cartão contam como saída pela data da compra. */
export function monthTotals(txs: Tx[], month: string, bankId?: string) {
  const list = txs.filter((t) => t.date.startsWith(month) && (!bankId || t.bankId === bankId));
  const income = list.filter((t) => t.type === "receita").reduce((a, t) => a + t.amount, 0);
  const expense = list.filter((t) => t.type === "despesa").reduce((a, t) => a + t.amount, 0);
  return { list, income, expense, balance: income - expense };
}
/** Saldo do banco considera só transações com bankId. */
export function bankBalance(s: State, bankId: string) {
  const b = s.banks.find((x) => x.id === bankId);
  return s.txs.filter((t) => t.bankId === bankId).reduce((a, t) => a + (t.type === "receita" ? t.amount : -t.amount), b?.initial ?? 0);
}
/** Limite usado = compras de cartão ainda não pagas. */
export function cardUsed(s: State, cardId: string) {
  return s.txs.filter((t) => t.cardId === cardId && !t.paid).reduce((a, t) => a + t.amount, 0);
}
export { PALETTE };
