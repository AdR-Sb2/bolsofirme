import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTitle } from "@/components/AppShell";
import { bankBalance, brl, monthKey, setState, uid, useStore, type Bank } from "@/lib/store";

export const Route = createFileRoute("/bancos")({
  head: () => ({
    meta: [
      { title: "Bancos — BolsoFirme" },
      { name: "description", content: "Gerencie suas contas bancárias e acompanhe os saldos." },
      { property: "og:title", content: "Bancos — BolsoFirme" },
      { property: "og:description", content: "Gerencie suas contas bancárias e acompanhe os saldos." },
    ],
  }),
  component: Bancos,
});

function Bancos() {
  const s = useStore();
  const nav = useNavigate();
  const [edit, setEdit] = useState<Bank | null>(null);
  const [open, setOpen] = useState(false);
  const mk = monthKey(new Date());
  const total = s.banks.reduce((a, b) => a + bankBalance(s, b.id), 0);
  const txCount = s.txs.filter((t) => t.bankId).length;

  const del = (b: Bank) => {
    if (s.txs.some((t) => t.bankId === b.id)) { toast.error("Este banco possui transações vinculadas e não pode ser excluído."); return; }
    if (!confirm(`Excluir ${b.name}?`)) return;
    setState((st) => ({ ...st, banks: st.banks.filter((x) => x.id !== b.id) }));
    toast.success("Banco excluído");
  };

  return (
    <div>
      <PageTitle title="Bancos Cadastrados" sub="Gerencie suas contas bancárias e acompanhe os saldos"
        action={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Adicionar Banco</Button>} />
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Resumo Geral</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><div className="text-sm text-muted-foreground">Total de Bancos</div><div className="text-2xl font-bold">{s.banks.length}</div></div>
          <div><div className="text-sm text-muted-foreground">Saldo Total</div><div className="text-2xl font-bold text-income">{brl(total)}</div></div>
          <div><div className="text-sm text-muted-foreground">Transações Totais</div><div className="text-2xl font-bold">{txCount}</div></div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {s.banks.map((b) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full ring-1 ring-border" style={{ background: b.color }} />{b.name}</div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{b.kind}</span>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">Saldo Atual</div>
            <div className="text-xl font-bold text-income">{brl(bankBalance(s, b.id))}</div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Transações no Mês</span><span>{s.txs.filter((t) => t.bankId === b.id && t.date.startsWith(mk)).length}</span></div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => nav({ to: "/" })}>Ver</Button>
              <Button variant="outline" size="icon" aria-label="Editar" onClick={() => { setEdit(b); setOpen(true); }}><Settings className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Excluir" onClick={() => del(b)}><Trash2 className="h-4 w-4 text-expense" /></Button>
            </div>
          </div>
        ))}
      </div>
      <BankDialog open={open} onOpenChange={setOpen} bank={edit} />
    </div>
  );
}

function BankDialog({ open, onOpenChange, bank }: { open: boolean; onOpenChange: (o: boolean) => void; bank: Bank | null }) {
  const [f, setF] = useState<Bank>({ id: "", name: "", color: "#3b82f6", kind: "Conta Corrente", initial: 0 });
  const [key, setKey] = useState("");
  const k = (bank?.id ?? "new") + String(open);
  if (k !== key) { setKey(k); setF(bank ?? { id: "", name: "", color: "#3b82f6", kind: "Conta Corrente", initial: 0 }); }
  const save = () => {
    if (!f.name.trim()) { toast.error("Informe o nome"); return; }
    setState((st) => ({ ...st, banks: bank ? st.banks.map((b) => (b.id === bank.id ? f : b)) : [...st.banks, { ...f, id: uid() }] }));
    toast.success("Banco salvo"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{bank ? "Editar Banco" : "Adicionar Banco"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Tipo</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Bank["kind"] })}>
              <option>Conta Corrente</option><option>Conta Digital</option><option>Conta Investimento</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Cor</Label><Input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
            <div><Label>Saldo inicial (R$)</Label><Input type="number" value={f.initial / 100} onChange={(e) => setF({ ...f, initial: Math.round(Number(e.target.value) * 100) })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
