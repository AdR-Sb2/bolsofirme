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

export const Route = createFileRoute("/_authenticated/bancos")({
  head: () => ({
    meta: [
      { title: "Bancos — BolsoFirme" },
      { name: "description", content: "Gerencie suas contas bancárias e acompanhe os saldos." },
      { property: "og:title", content: "Bancos — BolsoFirme" },
      { property: "og:description", content: "Gerencie suas contas bancárias e acompanhe os saldos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Bancos,
});

const BANK_CATALOG=[{name:"Banco do Brasil",color:"#f5c400",logo:"https://cdn.simpleicons.org/bancodobrasil"},{name:"Nubank",color:"#820ad1",logo:"https://cdn.simpleicons.org/nubank"},{name:"Itaú",color:"#ec7000",logo:"https://cdn.simpleicons.org/itau"},{name:"Bradesco",color:"#cc092f",logo:"https://cdn.simpleicons.org/bradesco"},{name:"Caixa",color:"#0066a1",logo:"https://cdn.simpleicons.org/caixa"},{name:"Santander",color:"#ec0000",logo:"https://cdn.simpleicons.org/santander"},{name:"Banco Inter",color:"#ff7a00",logo:"https://cdn.simpleicons.org/bancointer"},{name:"C6 Bank",color:"#242424",logo:"https://cdn.simpleicons.org/c6bank"},{name:"BTG Pactual",color:"#003b5c",logo:"https://cdn.simpleicons.org/btgpactual"},{name:"Sicredi",color:"#3b7d23",logo:"https://cdn.simpleicons.org/sicredi"},{name:"Sicoob",color:"#009b63",logo:"https://cdn.simpleicons.org/sicoob"},{name:"PagBank",color:"#00a5e5",logo:"https://cdn.simpleicons.org/pagbank"},{name:"Mercado Pago",color:"#009ee3",logo:"https://cdn.simpleicons.org/mercadopago"},{name:"PicPay",color:"#21c25e",logo:"https://cdn.simpleicons.org/picpay"},{name:"Neon",color:"#00a5a8",logo:"https://cdn.simpleicons.org/neon"},{name:"Next",color:"#00c8b4",logo:"https://cdn.simpleicons.org/next"},{name:"Original",color:"#00a859",logo:"https://cdn.simpleicons.org/bancooriginal"},{name:"Safra",color:"#a18a52",logo:"https://cdn.simpleicons.org/bancosafra"},{name:"XP",color:"#111111",logo:"https://cdn.simpleicons.org/xpinc"},{name:"Genial",color:"#00a99d",logo:"https://cdn.simpleicons.org/genial"},{name:"Modalmais",color:"#5b2c83",logo:"https://cdn.simpleicons.org/modalmais"},{name:"Daycoval",color:"#003b70",logo:"https://cdn.simpleicons.org/bancodaycoval"},{name:"BMG",color:"#006b54",logo:"https://cdn.simpleicons.org/bmg"},{name:"BRB",color:"#0067a5",logo:"https://cdn.simpleicons.org/brb"},{name:"Banrisul",color:"#00529b",logo:"https://cdn.simpleicons.org/banrisul"},{name:"Banestes",color:"#00529b",logo:"https://cdn.simpleicons.org/banestes"},{name:"Banco Pan",color:"#ff6600",logo:"https://cdn.simpleicons.org/bancopan"},{name:"Will Bank",color:"#ffde00",logo:"https://cdn.simpleicons.org/willbank"},{name:"Stone",color:"#00a868",logo:"https://cdn.simpleicons.org/stone"},{name:"PagSeguro",color:"#00a5e5",logo:"https://cdn.simpleicons.org/pagseguro"}] as const;
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
              <div className="flex items-center gap-2 font-semibold">{b.logo ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background"><img src={b.logo} alt={`Logo ${b.name}`} className="h-6 w-6 rounded object-contain" onError={e=>{e.currentTarget.style.display="none";const fallback=e.currentTarget.nextElementSibling as HTMLElement|null;if(fallback)fallback.style.display="block";}}/><span className="hidden h-2.5 w-2.5 rounded-full ring-1 ring-border" style={{background:b.color}}/></span> : <span className="h-3 w-3 rounded-full ring-1 ring-border" style={{ background: b.color }} />}{b.name}</div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{b.kind}</span>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">Saldo Atual</div>
            <div className="text-xl font-bold text-income">{brl(bankBalance(s, b.id))}</div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Transações no Mês</span><span>{s.txs.filter((t) => t.bankId === b.id && t.date.startsWith(mk)).length}</span></div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => nav({ to: "/transacoes" })}>Ver</Button>
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
  const [f, setF] = useState<Bank>({ id: "", name: "", color: "#3b82f6", logo:"", kind: "Conta Corrente", initial: 0 });
  const [key, setKey] = useState("");
  const k = (bank?.id ?? "new") + String(open);
  if (k !== key) { setKey(k); setF(bank ?? { id: "", name: "", color: "#3b82f6", logo:"", kind: "Conta Corrente", initial: 0 }); }
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
          <div><Label>Banco</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.name} onChange={(e) => { const x=BANK_CATALOG.find(b=>b.name===e.target.value); setF({...f,name:x?.name??e.target.value,color:x?.color??f.color,logo:x?.logo??""}); }}><option value="">Selecione um banco</option>{BANK_CATALOG.map(b=><option key={b.name} value={b.name}>{b.name}</option>)}</select></div>
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
