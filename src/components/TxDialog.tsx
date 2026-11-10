import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonthsToDate, setState, uid, useStore, type Tx } from "@/lib/store";

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function isValidIsoDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function TxDialog({
  open,
  onOpenChange,
  tx,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tx?: Tx | null | undefined;
}) {
  const s = useStore();
  const empty = {
    description: "",
    amount: "",
    type: "despesa",
    date: new Date().toISOString().slice(0, 10),
    categoryId: s.categories[0]?.id ?? "",
    source: "b:" + (s.banks[0]?.id ?? ""),
    installments: "1",
  };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(
      tx
        ? {
            description: tx.description,
            amount: (tx.amount / 100).toFixed(2).replace(".", ","),
            type: tx.type,
            date: tx.date,
            categoryId: tx.categoryId,
            source: tx.cardId ? "c:" + tx.cardId : "b:" + tx.bankId,
            installments: String(tx.installmentCount ?? 1),
          }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx]);

  const save = (): void => {
    const amount = Math.round(parseFloat(f.amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!f.description.trim() || !amount || amount <= 0) {
      toast.error("Preencha descrição e valor válidos");
      return;
    }
    if (!isValidIsoDate(f.date)) {
      toast.error("Informe uma data válida.");
      return;
    }
    const installmentCount = tx ? 1 : Number(f.installments);
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
      toast.error("Escolha entre 1 e 36 parcelas.");
      return;
    }
    const [k, id] = f.source.split(":");
    if (installmentCount > 1 && (k !== "c" || f.type !== "despesa")) {
      toast.error("Parcelamento está disponível para despesas no cartão.");
      return;
    }
    if (tx?.installmentGroupId && (k !== "c" || f.type !== "despesa")) {
      toast.error("Uma parcela existente deve continuar vinculada a um cartão.");
      return;
    }
    if (installmentCount > amount) {
      toast.error("O valor não pode ser dividido em parcelas menores que R$ 0,01.");
      return;
    }
    const data: Tx = {
      id: tx?.id ?? uid(),
      description: f.description.trim(),
      amount,
      type: f.type as Tx["type"],
      date: f.date,
      categoryId: f.categoryId,
      bankId: k === "b" ? id : undefined,
      cardId: k === "c" ? id : undefined,
      paid: tx?.paid ?? false,
      installmentGroupId: tx?.installmentGroupId,
      installmentNumber: tx?.installmentNumber,
      installmentCount: tx?.installmentCount ?? 1,
    };
    if (tx) {
      setState((st) => ({ ...st, txs: st.txs.map((t) => (t.id === tx.id ? data : t)) }));
    } else if (installmentCount > 1) {
      const installmentGroupId = uid();
      const baseAmount = Math.floor(amount / installmentCount);
      const remainder = amount % installmentCount;
      const installments = Array.from({ length: installmentCount }, (_, index): Tx => ({
        ...data,
        id: uid(),
        description: `${data.description} (${index + 1}/${installmentCount})`,
        amount: baseAmount + (index < remainder ? 1 : 0),
        date: addMonthsToDate(f.date, index),
        installmentGroupId,
        installmentNumber: index + 1,
        installmentCount,
      }));
      setState((st) => ({ ...st, txs: [...st.txs, ...installments] }));
    } else {
      setState((st) => ({ ...st, txs: [...st.txs, data] }));
    }
    toast.success(tx ? "Transação atualizada" : "Transação criada");
    onOpenChange(false);
  };
  const remove = () => {
    if (!tx) return;
    const grouped = Boolean(tx.installmentGroupId);
    if (
      !confirm(
        grouped
          ? "Excluir todas as parcelas desta compra, inclusive as já registradas como pagas?"
          : "Excluir esta transação?",
      )
    )
      return;
    setState((st) => ({
      ...st,
      txs: st.txs.filter((t) =>
        grouped ? t.installmentGroupId !== tx.installmentGroupId : t.id !== tx.id,
      ),
    }));
    toast.success("Transação excluída");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx ? "Editar Transação" : "Nova Transação"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["despesa", "receita"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={f.type === t ? "default" : "outline"}
                onClick={() => setF({ ...f, type: t })}
              >
                {t === "receita" ? "Receita" : "Despesa"}
              </Button>
            ))}
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              className={sel}
              value={f.categoryId}
              onChange={(e) => setF({ ...f, categoryId: e.target.value })}
            >
              {s.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Conta ou cartão</Label>
            <select
              className={sel}
              value={f.source}
              onChange={(e) => setF({ ...f, source: e.target.value })}
            >
              <optgroup label="Bancos">
                {s.banks.map((b) => (
                  <option key={b.id} value={"b:" + b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões">
                {s.cards.map((c) => (
                  <option key={c.id} value={"c:" + c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          {!tx && f.type === "despesa" && f.source.startsWith("c:") && (
            <div>
              <Label htmlFor="installment-count">Parcelas</Label>
              <select
                id="installment-count"
                className={sel}
                value={f.installments}
                onChange={(e) => setF({ ...f, installments: e.target.value })}
              >
                {Array.from({ length: 36 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count === 1 ? "À vista" : `${count}x`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                O valor informado é o total da compra; as parcelas serão lançadas nas faturas
                seguintes.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {tx && (
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
