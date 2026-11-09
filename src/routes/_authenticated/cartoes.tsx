import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthPicker, PageTitle } from "@/components/AppShell";
import { brl, cardUsed, fmtDate, setState, uid, useStore, type CardC } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões de Crédito — BolsoFirme" },
      { name: "description", content: "Gerencie seus cartões e acompanhe as faturas." },
      { property: "og:title", content: "Cartões de Crédito — BolsoFirme" },
      { property: "og:description", content: "Gerencie seus cartões e acompanhe as faturas." },
    ],
  }),
  component: Cartoes,
});

function Cartoes() {
  const s = useStore();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<CardC | null>(null);
  const [cfg, setCfg] = useState<{ open: boolean; card: CardC | null }>({ open: false, card: null });

  return (
    <div>
      <PageTitle title="Cartões de Crédito" sub="Gerencie seus cartões e acompanhe as faturas"
        action={<Button onClick={() => setCfg({ open: true, card: null })}><Plus className="h-4 w-4" />Adicionar Cartão</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <MonthPicker date={date} onChange={setDate} prefix="Faturas de " />
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{s.cards.length} cartões ativos</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {s.cards.map((c) => {
          const used = cardUsed(s, c.id);
          const pct = c.limit ? (used / c.limit) * 100 : 0;
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} /><div><div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.bank}</div></div></div>
              <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Limite Usado</span><span>{brl(used)} / {brl(c.limit)}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full", pct <= 50 ? "bg-income" : pct <= 80 ? "bg-warning" : "bg-expense")} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)}% utilizado</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-muted-foreground">Fechamento</div>Dia {c.closing}</div>
                <div><div className="text-muted-foreground">Vencimento</div>Dia {c.due}</div>
              </div>
              <div className="mt-4 rounded-lg bg-secondary p-3"><div className="text-xs text-muted-foreground">Próxima Fatura</div><div className="text-lg font-bold">{brl(used)}</div></div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => setView(c)}>Ver Fatura</Button>
                <Button variant="outline" onClick={() => setCfg({ open: true, card: c })}>Configurar</Button>
              </div>
            </div>
          );
        })}
      </div>
      <InvoiceDialog card={view} onClose={() => setView(null)} />
      <CardDialog open={cfg.open} card={cfg.card} onOpenChange={(o) => setCfg((x) => ({ ...x, open: o }))} />
    </div>
  );
}

function InvoiceDialog({ card, onClose }: { card: CardC | null; onClose: () => void }) {
  const s = useStore();
  const items = card ? s.txs.filter((t) => t.cardId === card.id && !t.paid) : [];
  const total = items.reduce((a, t) => a + t.amount, 0);
  const pay = () => {
    if (!card || !confirm("Confirmar pagamento da fatura?")) return;
    // Pagamento de fatura é transferência: apenas marca as compras como pagas, sem gerar entrada/saída.
    setState((st) => ({ ...st, txs: st.txs.map((t) => (t.cardId === card.id ? { ...t, paid: true } : t)) }));
    toast.success("Fatura paga"); onClose();
  };
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Fatura — {card?.name}</DialogTitle></DialogHeader>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma compra em aberto.</p> : (
          <div className="max-h-72 divide-y divide-border overflow-auto">
            {items.map((t) => <div key={t.id} className="flex justify-between py-2 text-sm"><span>{t.description} <span className="text-muted-foreground">{fmtDate(t.date)}</span></span><span className="text-expense">{brl(t.amount)}</span></div>)}
          </div>
        )}
        <div className="flex justify-between font-semibold"><span>Total</span><span>{brl(total)}</span></div>
        <div className="text-sm">Status: <span className={total ? "text-warning" : "text-income"}>{total ? "Em aberto" : "Paga"}</span></div>
        <DialogFooter><Button disabled={!total} onClick={pay}>Pagar fatura</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardDialog({ open, onOpenChange, card }: { open: boolean; onOpenChange: (o: boolean) => void; card: CardC | null }) {
  const blank: CardC = { id: "", name: "", bank: "", color: "#3b82f6", limit: 0, closing: 1, due: 10 };
  const [f, setF] = useState(blank);
  const [key, setKey] = useState("");
  const k = (card?.id ?? "new") + String(open);
  if (k !== key) { setKey(k); setF(card ?? blank); }
  const save = () => {
    if (!f.name.trim()) { toast.error("Informe o nome"); return; }
    setState((st) => ({ ...st, cards: card ? st.cards.map((c) => (c.id === card.id ? f : c)) : [...st.cards, { ...f, id: uid() }] }));
    toast.success("Cartão salvo"); onOpenChange(false);
  };
  const del = () => {
    if (!card) return;
    if (s_hasTx(card.id)) { toast.error("Este cartão possui transações vinculadas e não pode ser excluído."); return; }
    if (!confirm("Excluir cartão?")) return;
    setState((st) => ({ ...st, cards: st.cards.filter((c) => c.id !== card.id) }));
    toast.success("Cartão excluído"); onOpenChange(false);
  };
  const s = useStore();
  const s_hasTx = (id: string) => s.txs.some((t) => t.cardId === id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{card ? "Configurar Cartão" : "Adicionar Cartão"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Banco</Label><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
            <div><Label>Cor</Label><Input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Limite (R$)</Label><Input type="number" value={f.limit / 100} onChange={(e) => setF({ ...f, limit: Math.round(Number(e.target.value) * 100) })} /></div>
            <div><Label>Fechamento</Label><Input type="number" min={1} max={31} value={f.closing} onChange={(e) => setF({ ...f, closing: Number(e.target.value) })} /></div>
            <div><Label>Vencimento</Label><Input type="number" min={1} max={31} value={f.due} onChange={(e) => setF({ ...f, due: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter className="gap-2">{card && <Button variant="destructive" onClick={del}>Excluir</Button>}<Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
