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
import { supabase } from "@/integrations/supabase/client";
import {
  addMonthsToDate,
  addRecurrenceDate,
  setState,
  uid,
  useStore,
  type RecurrenceFrequency,
  type Tx,
} from "@/lib/store";

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
    categoryId: s.categories.find((category) => category.type === "despesa")?.id ?? "",
    source: "b:" + (s.banks[0]?.id ?? ""),
    installments: "1",
    recurrenceCount: "1",
    recurrenceFrequency: "monthly" as RecurrenceFrequency,
  };
  const [f, setF] = useState(empty);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categoriesForType = s.categories.filter((category) => category.type === f.type);
  const currentCategory = tx
    ? s.categories.find((category) => category.id === f.categoryId)
    : undefined;
  const visibleCategories =
    currentCategory && !categoriesForType.some((category) => category.id === currentCategory.id)
      ? [...categoriesForType, currentCategory]
      : categoriesForType;
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
            recurrenceCount: String(tx.recurrenceCount ?? 1),
            recurrenceFrequency: tx.recurrenceFrequency ?? "monthly",
          }
        : empty,
    );
    setReceiptFile(null);
    setRemoveReceipt(false);
    setReceiptUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx]);

  useEffect(() => {
    if (!open || !tx?.attachmentPath) return;
    let active = true;
    void supabase.storage
      .from("transaction-receipts")
      .createSignedUrl(tx.attachmentPath, 300)
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setReceiptUrl(data.signedUrl);
      })
      .catch((error: unknown) => {
        console.error("Não foi possível gerar o link do comprovante:", error);
        if (active) toast.error("Não foi possível abrir o comprovante.");
      });
    return () => {
      active = false;
    };
  }, [open, tx?.attachmentPath]);

  const save = async (): Promise<void> => {
    if (saving) return;
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
    const recurrenceCount = tx ? 1 : Number(f.recurrenceCount);
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
      toast.error("Escolha entre 1 e 36 parcelas.");
      return;
    }
    if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 36) {
      toast.error("Escolha entre 1 e 36 ocorrências.");
      return;
    }
    if (installmentCount > 1 && recurrenceCount > 1) {
      toast.error("Uma transação não pode ser parcelada e recorrente ao mesmo tempo.");
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
    if (receiptFile) {
      const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!acceptedTypes.includes(receiptFile.type)) {
        toast.error("Use um comprovante em JPG, PNG, WebP ou PDF.");
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        toast.error("O comprovante deve ter no máximo 5 MB.");
        return;
      }
    }
    setSaving(true);
    const transactionId = tx?.id ?? uid();
    let attachmentPath = tx?.attachmentPath;
    try {
      if (receiptFile || removeReceipt) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Entre novamente na sua conta para salvar o comprovante.");
          return;
        }
        if (receiptFile) {
          attachmentPath = attachmentPath ?? `${user.id}/${transactionId}/${uid()}`;
          const { error } = await supabase.storage
            .from("transaction-receipts")
            .upload(attachmentPath, receiptFile, {
              upsert: true,
              contentType: receiptFile.type,
            });
          if (error) throw error;
        } else if (attachmentPath) {
          const { error } = await supabase.storage
            .from("transaction-receipts")
            .remove([attachmentPath]);
          if (error) throw error;
          attachmentPath = undefined;
        }
      }
      const data: Tx = {
        id: transactionId,
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
        recurrenceGroupId: tx?.recurrenceGroupId,
        recurrenceFrequency: tx?.recurrenceFrequency,
        recurrenceNumber: tx?.recurrenceNumber,
        recurrenceCount: tx?.recurrenceCount ?? 1,
        attachmentPath,
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
      } else if (recurrenceCount > 1) {
        const recurrenceGroupId = uid();
        const recurringTransactions = Array.from({ length: recurrenceCount }, (_, index): Tx => ({
          ...data,
          id: uid(),
          date: addRecurrenceDate(f.date, f.recurrenceFrequency, index),
          recurrenceGroupId,
          recurrenceFrequency: f.recurrenceFrequency,
          recurrenceNumber: index + 1,
          recurrenceCount,
        }));
        setState((st) => ({ ...st, txs: [...st.txs, ...recurringTransactions] }));
      } else {
        setState((st) => ({ ...st, txs: [...st.txs, data] }));
      }
      toast.success(tx ? "Transação atualizada" : "Transação criada");
      onOpenChange(false);
    } catch (error) {
      console.error("Não foi possível salvar a transação ou seu comprovante:", error);
      toast.error("Não foi possível salvar a transação ou o comprovante.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!tx) return;
    const installmentGroupId = tx.installmentGroupId;
    const recurrenceGroupId = tx.recurrenceGroupId;
    if (
      !confirm(
        installmentGroupId
          ? "Excluir todas as parcelas desta compra, inclusive as já registradas como pagas?"
          : recurrenceGroupId
            ? "Excluir todas as ocorrências desta transação recorrente?"
            : "Excluir esta transação?",
      )
    )
      return;
    if (saving) return;
    setSaving(true);
    try {
      const groupTransactions = s.txs.filter((item) =>
        installmentGroupId
          ? item.installmentGroupId === installmentGroupId
          : recurrenceGroupId
            ? item.recurrenceGroupId === recurrenceGroupId
            : item.id === tx.id,
      );
      const attachmentPaths = [
        ...new Set(
          groupTransactions.flatMap((item) => (item.attachmentPath ? [item.attachmentPath] : [])),
        ),
      ];
      if (attachmentPaths.length) {
        const { error } = await supabase.storage
          .from("transaction-receipts")
          .remove(attachmentPaths);
        if (error) throw error;
      }
      setState((st) => ({
        ...st,
        txs: st.txs.filter((t) =>
          installmentGroupId
            ? t.installmentGroupId !== installmentGroupId
            : recurrenceGroupId
              ? t.recurrenceGroupId !== recurrenceGroupId
              : t.id !== tx.id,
        ),
      }));
      toast.success("Transação excluída");
      onOpenChange(false);
    } catch (error) {
      console.error("Não foi possível excluir a transação e seus comprovantes:", error);
      toast.error("Não foi possível excluir a transação e seus comprovantes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tx ? "Editar Transação" : "Nova Transação"}</DialogTitle>
          {tx?.recurrenceGroupId && (
            <p className="text-sm text-muted-foreground">
              Ocorrência {tx.recurrenceNumber} de {tx.recurrenceCount}. As alterações afetam somente
              esta ocorrência.
            </p>
          )}
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["despesa", "receita"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={f.type === t ? "default" : "outline"}
                aria-pressed={f.type === t}
                onClick={() =>
                  setF({
                    ...f,
                    type: t,
                    categoryId: tx
                      ? f.categoryId
                      : (s.categories.find((category) => category.type === t)?.id ?? ""),
                  })
                }
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
            <Label htmlFor="transaction-category">Categoria</Label>
            <select
              id="transaction-category"
              className={sel}
              value={f.categoryId}
              onChange={(e) => setF({ ...f, categoryId: e.target.value })}
            >
              <option value="">Sem categoria</option>
              {visibleCategories.map((c) => (
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
          {!tx && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="recurrence-count">Repetir</Label>
                <select
                  id="recurrence-count"
                  className={sel}
                  value={f.recurrenceCount}
                  onChange={(e) => setF({ ...f, recurrenceCount: e.target.value })}
                >
                  {Array.from({ length: 36 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count === 1 ? "Não repetir" : `${count} vezes`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="recurrence-frequency">Frequência</Label>
                <select
                  id="recurrence-frequency"
                  className={sel}
                  value={f.recurrenceFrequency}
                  disabled={f.recurrenceCount === "1"}
                  onChange={(e) =>
                    setF({ ...f, recurrenceFrequency: e.target.value as RecurrenceFrequency })
                  }
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              {f.recurrenceCount !== "1" && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Serão criados {f.recurrenceCount} lançamentos com o mesmo valor, incluindo este.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="transaction-receipt">
              Comprovante (JPG, PNG, WebP ou PDF; até 5 MB)
            </Label>
            <Input
              id="transaction-receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => {
                setReceiptFile(event.target.files?.[0] ?? null);
                setRemoveReceipt(false);
              }}
            />
            {tx?.attachmentPath && !removeReceipt && (
              <div className="flex items-center justify-between gap-2 text-sm">
                {receiptUrl ? (
                  <a
                    className="text-primary underline"
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir comprovante
                  </a>
                ) : (
                  <span className="text-muted-foreground">Preparando comprovante…</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReceiptFile(null);
                    setRemoveReceipt(true);
                    setReceiptUrl(null);
                  }}
                >
                  Remover
                </Button>
              </div>
            )}
            {removeReceipt && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-self-start"
                onClick={() => setRemoveReceipt(false)}
              >
                Cancelar remoção do comprovante
              </Button>
            )}
            {receiptFile && (
              <p className="text-xs text-muted-foreground">Arquivo: {receiptFile.name}</p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {tx && (
            <Button variant="destructive" disabled={saving} onClick={() => void remove()}>
              Excluir
            </Button>
          )}
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
