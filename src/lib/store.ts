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

const KEY = "bolsofirme-v1";
export const uid = () => Math.random().toString(36).slice(2, 10);
const PALETTE = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#ec4899", "#a855f7", "#14b8a6", "#ef4444", "#84cc16", "#06b6d4", "#f43f5e", "#8b5cf6", "#f59e0b", "#10b981", "#64748b"];
const DEFAULT_CATS: [string, string][] = [
  ["Transporte", "🚗"], ["Alimentação", "🍔"], ["Saúde", "💊"], ["Educação", "📚"], ["Lazer", "🎮"],
  ["Streaming", "📺"], ["Internet", "🌐"], ["Vestuário", "👕"], ["Perfume", "🌸"], ["Eletrônicos", "💻"],
  ["Peças", "🔧"], ["Consertos", "🛠️"], ["Empréstimo", "🏦"], ["Curso", "🎓"], ["Salário", "💰"],
];

function seed(): State {
  const categories = DEFAULT_CATS.map(([name, icon], i) => ({ id: "c" + i, name, icon, color: PALETTE[i % PALETTE.length] as string }));
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

let state: State = seed();
let loaded = false;
const listeners = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch { /* ignore */ }
}
export function setState(fn: (s: State) => State) {
  load();
  state = fn(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
const serverSnap = seed();
export function useStore(): State {
  return useSyncExternalStore(
    (l) => { load(); listeners.add(l); l(); return () => listeners.delete(l); },
    () => { load(); return state; },
    () => serverSnap,
  );
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
