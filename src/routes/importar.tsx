import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Download, Info, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/AppShell";
import { brl, setState, uid, useStore, type Tx } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar Excel — BolsoFirme" },
      { name: "description", content: "Importe suas transações a partir de arquivos Excel ou CSV." },
      { property: "og:title", content: "Importar Excel — BolsoFirme" },
      { property: "og:description", content: "Importe suas transações a partir de arquivos Excel ou CSV." },
    ],
  }),
  component: Importar,
});

const STEPS = ["Upload", "Mapeamento", "Prévia", "Concluído"];
const FIELDS = [["date", "Data"], ["description", "Descrição"], ["amount", "Valor"], ["category", "Categoria"]] as const;
type Row = Record<string, unknown>;

function parseDate(v: unknown): string | null {
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  return null;
}
function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Math.round(v * 100);
  const s = String(v ?? "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? null : Math.round(n * 100);
}

function Importar() {
  const s = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);
  const [count, setCount] = useState(0);

  const handle = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo maior que 10MB");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const data = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]]);
    if (!data.length) return toast.error("Planilha vazia");
    const c = Object.keys(data[0]);
    setRows(data); setCols(c);
    const guess: Record<string, string> = {};
    FIELDS.forEach(([k, l]) => { const g = c.find((x) => x.toLowerCase().startsWith(l.toLowerCase().slice(0, 4))); if (g) guess[k] = g; });
    setMap(guess); setStep(1);
  };

  const preview = rows.map((r) => {
    const date = parseDate(r[map.date]); const amount = parseAmount(r[map.amount]); const description = String(r[map.description] ?? "").trim();
    const catName = String(r[map.category] ?? "").trim().toLowerCase();
    const cat = s.categories.find((c) => c.name.toLowerCase() === catName) ?? s.categories[0];
    let status: "válida" | "erro" | "duplicada" = "válida";
    if (!date || amount === null || !description) status = "erro";
    else if (s.txs.some((t) => t.date === date && t.amount === Math.abs(amount) && t.description === description)) status = "duplicada";
    return { date, amount, description, cat, status };
  });
  const counts = { válida: 0, erro: 0, duplicada: 0 }; preview.forEach((p) => counts[p.status]++);

  const doImport = () => {
    const news: Tx[] = preview.filter((p) => p.status === "válida").map((p) => ({ id: uid(), description: p.description, amount: Math.abs(p.amount!), type: p.amount! < 0 ? "despesa" : (p.cat?.name === "Salário" ? "receita" : "despesa"), date: p.date!, categoryId: p.cat.id, bankId: s.banks[0]?.id }));
    setState((st) => ({ ...st, txs: [...st.txs, ...news] }));
    setCount(news.length); setStep(3); toast.success(`${news.length} transações importadas`);
  };

  const template = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Data", "Descrição", "Valor", "Categoria"], ["05/10/2026", "Supermercado", -123.45, "Alimentação"], ["01/10/2026", "Salário", 2500, "Salário"]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Transações"); XLSX.writeFile(wb, "modelo-bolsofirme.xlsx");
  };

  return (
    <div>
      <PageTitle title="Importação de Dados" sub="Importe suas transações a partir de arquivos Excel ou CSV" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {STEPS.map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", i < step ? "bg-income text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>
            <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>{l}</span>
            {i < 3 && <span className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-semibold">Importar Transações</h3>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-balance/40 bg-balance/10 p-3 text-sm"><Info className="h-4 w-4 text-balance" />Faça upload de um arquivo Excel (.xlsx ou .csv) com suas transações.</div>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
              className={cn("grid place-items-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center", drag && "border-primary bg-accent")}>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="font-semibold">Arraste seu arquivo aqui</div>
              <div className="text-sm text-muted-foreground">ou clique no botão abaixo para selecionar</div>
              <Button className="mt-2" onClick={() => input.current?.click()}>Selecionar Arquivo</Button>
              <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => handle(e.target.files?.[0])} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-secondary p-4 text-sm"><div className="mb-1 font-semibold">Formatos Aceitos</div>Excel (.xlsx) · CSV (.csv) · máximo 10MB</div>
              <div className="rounded-lg bg-secondary p-4 text-sm"><div className="mb-1 font-semibold">Colunas Recomendadas</div>Data, Descrição, Valor, Categoria (opcional)</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-2 font-semibold">Modelo de Planilha</h3>
            <p className="mb-3 text-sm text-muted-foreground">Baixe o modelo com as colunas recomendadas. Valores negativos são despesas.</p>
            <Button variant="outline" onClick={template}><Download className="h-4 w-4" />Baixar Modelo Excel</Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Associe as colunas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([k, l]) => (
              <label key={k} className="grid gap-1 text-sm">{l}
                <select className="h-10 rounded-md border border-input bg-background px-3" value={map[k] ?? ""} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                  <option value="">—</option>{cols.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>Voltar</Button><Button disabled={!map.date || !map.amount || !map.description} onClick={() => setStep(2)}>Continuar</Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="text-income">Válidas: {counts.válida}</span><span className="text-expense">Erros: {counts.erro}</span><span className="text-warning">Duplicadas: {counts.duplicada}</span>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2">Valor</th><th className="p-2">Categoria</th><th className="p-2">Status</th></tr></thead>
              <tbody>{preview.map((p, i) => (
                <tr key={i} className="border-t border-border"><td className="p-2">{p.date ?? "—"}</td><td className="p-2">{p.description}</td><td className="p-2">{p.amount !== null ? brl(p.amount) : "—"}</td><td className="p-2">{p.cat?.name}</td>
                  <td className={cn("p-2 font-medium", p.status === "válida" ? "text-income" : p.status === "erro" ? "text-expense" : "text-warning")}>{p.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-5 flex gap-2"><Button variant="outline" onClick={() => setStep(1)}>Voltar</Button><Button disabled={!counts.válida} onClick={doImport}>Importar {counts.válida} transações</Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Check className="mx-auto h-12 w-12 text-income" />
          <h3 className="mt-3 text-xl font-bold">Importação concluída</h3>
          <p className="text-muted-foreground">{count} transações foram adicionadas.</p>
          <Button className="mt-4" onClick={() => { setStep(0); setRows([]); }}>Nova importação</Button>
        </div>
      )}
    </div>
  );
}
