import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/AppShell";
import { PALETTE, setState, uid, useStore } from "@/lib/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — BolsoFirme" },
      { name: "description", content: "Categorias, preferências e exportação de dados." },
      { property: "og:title", content: "Configurações — BolsoFirme" },
      { property: "og:description", content: "Categorias, preferências e exportação de dados." },
    ],
  }),
  component: Config,
});

function download(name: string, content: string, type: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
}

function Config() {
  const s = useStore();
  const [name, setName] = useState(""); const [icon, setIcon] = useState("🏷️");
  const update = (id: string, patch: Record<string, string>) => setState((st) => ({ ...st, categories: st.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const del = (id: string) => {
    if (s.txs.some((t) => t.categoryId === id)) { toast.error("Categoria em uso por transações."); return; }
    if (!confirm("Excluir categoria?")) return;
    setState((st) => ({ ...st, categories: st.categories.filter((c) => c.id !== id) })); toast.success("Categoria excluída");
  };
  const add = () => {
    if (!name.trim()) return;
    setState((st) => ({ ...st, categories: [...st.categories, { id: uid(), name: name.trim(), icon, color: PALETTE[st.categories.length % PALETTE.length] as string }] }));
    setName(""); toast.success("Categoria criada");
  };
  const csv = () => {
    const lines = [["Data", "Descrição", "Valor", "Tipo", "Categoria"], ...s.txs.map((t) => [t.date, t.description, (t.amount / 100).toFixed(2), t.type, s.categories.find((c) => c.id === t.categoryId)?.name ?? ""])];
    download("bolsofirme.csv", lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle title="Configurações" sub="Personalize categorias, preferências e seus dados" />
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Categorias</h3>
        <div className="mb-4 flex gap-2"><Input className="w-16" value={icon} onChange={(e) => setIcon(e.target.value)} /><Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}>Adicionar</Button></div>
        <div className="grid gap-2">
          {s.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="color" aria-label="Cor" className="h-9 w-9 shrink-0 rounded bg-transparent" value={c.color} onChange={(e) => update(c.id, { color: e.target.value })} />
              <Input className="w-16" value={c.icon} onChange={(e) => update(c.id, { icon: e.target.value })} />
              <Input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
              <Button variant="outline" size="icon" aria-label="Excluir" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Preferências</h3>
        <p className="text-sm text-muted-foreground">Tema: Escuro · Moeda: Real brasileiro (R$)</p>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Dados</h3>
        <div className="flex gap-2"><Button variant="outline" onClick={() => download("bolsofirme.json", JSON.stringify(s, null, 2), "application/json")}>Exportar JSON</Button><Button variant="outline" onClick={csv}>Exportar CSV</Button></div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Conta</h3>
        <p className="text-sm text-muted-foreground">Seus dados estão salvos neste navegador. Login com email ainda não está ativo.</p>
      </section>
    </div>
  );
}
