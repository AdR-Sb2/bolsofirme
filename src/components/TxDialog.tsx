import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setState, uid, useStore, type Tx } from "@/lib/store";

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function TxDialog({ open, onOpenChange, tx }: { open: boolean; onOpenChange: (o: boolean) => void; tx?: Tx | null | undefined }) {
  const s = useStore();
  const empty = { description: "", amount: "", type: "despesa", date: new Date().toISOString().slice(0, 10), categoryId: s.categories[0]?.id ?? "", source: "b:" + (s.banks[0]?.id ?? "") };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(tx ? { description: tx.description, amount: (tx.amount / 100).toFixed(2).replace(".", ","), type: tx.type, date: tx.date, categoryId: tx.categoryId, source: tx.cardId ? "c:" + tx.cardId : "b:" + tx.bankId } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx]);

  const save = (): void => {
    const amount = Math.round(parseFloat(f.amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!f.description.trim() || !amount || amount <= 0) { toast.error("Preencha descrição e valor válidos"); return; }
    const [k, id] = f.source.split(":");
    const data: Tx = { id: tx?.id ?? uid(), description: f.description.trim(), amount, type: f.type as Tx["type"], date: f.date, categoryId: f.categoryId, bankId: k === "b" ? id : undefined, cardId: k === "c" ? id : undefined, paid: tx?.paid };
    setState((st) => ({ ...st, txs: tx ? st.txs.map((t) => (t.id === tx.id ? data : t)) : [...st.txs, data] }));
    toast.success(tx ? "Transação atualizada" : "Transação criada");
    onOpenChange(false);
  };
  const remove = () => {
    if (!tx || !confirm("Excluir esta transação?")) return;
    setState((st) => ({ ...st, txs: st.txs.filter((t) => t.id !== tx.id) }));
    toast.success("Transação excluída");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["despesa", "receita"] as const).map((t) => (
              <Button key={t} type="button" variant={f.type === t ? "default" : "outline"} onClick={() => setF({ ...f, type: t })}>{t === "receita" ? "Receita" : "Despesa"}</Button>
            ))}
          </div>
          <div><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Valor (R$)</Label><Input inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          </div>
          <div><Label>Categoria</Label>
            <select className={sel} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              {s.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div><Label>Conta ou cartão</Label>
            <select className={sel} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <optgroup label="Bancos">{s.banks.map((b) => <option key={b.id} value={"b:" + b.id}>{b.name}</option>)}</optgroup>
              <optgroup label="Cartões">{s.cards.map((c) => <option key={c.id} value={"c:" + c.id}>{c.name}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {tx && <Button variant="destructive" onClick={remove}>Excluir</Button>}
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
