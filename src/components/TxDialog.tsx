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
  cardInvoiceDates,
  cardInvoiceKey,
  invoiceSummary,
  monthKey,
  monthLabel,
  transactionInvoiceMonth,
  setState,
  uid,
  useStore,
  type CardC,
  type CreditCardInvoice,
  type RecurrenceFrequency,
  type Tx,
  type TxType,
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

function referenceMonthForDate(
  receivedDate: string,
  baseReceivedDate: string,
  baseReferenceMonth: string,
): string | undefined {
  if (baseReferenceMonth === baseReceivedDate.slice(0, 7)) return undefined;
  const baseYear = Number(baseReceivedDate.slice(0, 4));
  const baseMonth = Number(baseReceivedDate.slice(5, 7));
  const receivedYear = Number(receivedDate.slice(0, 4));
  const receivedMonth = Number(receivedDate.slice(5, 7));
  const referenceYear = Number(baseReferenceMonth.slice(0, 4));
  const referenceMonth = Number(baseReferenceMonth.slice(5, 7));
  const monthOffset = (receivedYear - baseYear) * 12 + receivedMonth - baseMonth;
  const shifted = new Date(referenceYear, referenceMonth - 1 + monthOffset, 1);
  return `${monthKey(shifted)}-01`;
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
    type: "despesa" as TxType,
    date: new Date().toISOString().slice(0, 10),
    referenceMonth: "",
    categoryId: s.categories.find((category) => category.type === "despesa")?.id ?? "",
    source: "b:" + (s.banks[0]?.id ?? ""),
    invoiceMonth: "",
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
  const selectedCard = f.source.startsWith("c:")
    ? s.cards.find((card) => card.id === f.source.slice(2))
    : undefined;
  const suggestedInvoiceMonth =
    selectedCard && f.type === "despesa" ? cardInvoiceKey(f.date, selectedCard) : "";
  const selectedInvoiceMonth = f.invoiceMonth || suggestedInvoiceMonth;
  const selectedReferenceMonth = f.referenceMonth || f.date.slice(0, 7);
  const referenceMonthOptions = Array.from({ length: 49 }, (_, index) => {
    const now = new Date();
    return monthKey(new Date(now.getFullYear(), now.getMonth() + index - 36, 1));
  });
  if (!referenceMonthOptions.includes(selectedReferenceMonth)) {
    referenceMonthOptions.push(selectedReferenceMonth);
    referenceMonthOptions.sort();
  }
  const invoiceOptions = selectedCard
    ? s.invoices
        .filter((invoice) => invoice.cardId === selectedCard.id)
        .filter(
          (invoice) =>
            invoiceSummary(invoice, s.txs, selectedCard).outstanding > 0 ||
            invoice.dueMonth.slice(0, 7) === selectedInvoiceMonth,
        )
        .map((invoice) => ({
          month: invoice.dueMonth.slice(0, 7),
          label: invoiceSummary(invoice, s.txs, selectedCard).status,
        }))
    : [];
  if (
    selectedCard &&
    selectedInvoiceMonth &&
    !invoiceOptions.some((option) => option.month === selectedInvoiceMonth)
  ) {
    invoiceOptions.push({
      month: selectedInvoiceMonth,
      label: "Nova fatura",
    });
  }
  const currentCategory = tx
    ? s.categories.find((category) => category.id === f.categoryId)
    : undefined;
  const visibleCategories =
    currentCategory && !categoriesForType.some((category) => category.id === currentCategory.id)
      ? [...categoriesForType, currentCategory]
      : categoriesForType;
  useEffect(() => {
    if (!open) return;
    const txCard = tx?.cardId ? s.cards.find((card) => card.id === tx.cardId) : undefined;
    setF(
      tx
        ? {
            description: tx.description,
            amount: (tx.amount / 100).toFixed(2).replace(".", ","),
            type: tx.type === "receita" ? "receita" : "despesa",
            date: tx.date,
            referenceMonth: tx.referenceMonth?.slice(0, 7) ?? "",
            categoryId: tx.categoryId,
            source: tx.cardId ? "c:" + tx.cardId : "b:" + tx.bankId,
            invoiceMonth:
              tx.type === "despesa" && txCard
                ? (s.invoices
                    .find((invoice) => invoice.id === tx.invoiceId)
                    ?.dueMonth.slice(0, 7) ?? transactionInvoiceMonth(tx, txCard, s.invoices))
                : "",
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
    const parsedAmount = Math.round(
      parseFloat(f.amount.replace(/\./g, "").replace(",", ".")) * 100,
    );
    const [k, id] = f.source.split(":");
    const isCardRefund = f.type === "despesa" && k === "c" && parsedAmount < 0;
    if (!f.description.trim() || !parsedAmount || (parsedAmount < 0 && !isCardRefund)) {
      toast.error("Preencha descrição e valor válidos");
      return;
    }
    if (!isValidIsoDate(f.date)) {
      toast.error("Informe uma data válida.");
      return;
    }
    if (f.type === "despesa" && k === "c" && !f.categoryId) {
      toast.error("Escolha uma categoria para a compra no cartão.");
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
    const amount = Math.abs(parsedAmount);
    if (isCardRefund && installmentCount > 1) {
      toast.error("Estornos no cartão devem ser lançados à vista.");
      return;
    }
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
      const card = k === "c" ? s.cards.find((item) => item.id === id) : undefined;
      const newInvoices: CreditCardInvoice[] = [];
      const invoiceForDate = (date: string, preferredMonth?: string): string | undefined => {
        if (!card || f.type !== "despesa") return undefined;
        const month = preferredMonth || cardInvoiceKey(date, card);
        const dueMonth = `${month}-01`;
        const existing = s.invoices.find(
          (invoice) => invoice.cardId === card.id && invoice.dueMonth === dueMonth,
        );
        if (existing) return existing.id;
        let created = newInvoices.find(
          (invoice) => invoice.cardId === card.id && invoice.dueMonth === dueMonth,
        );
        if (!created) {
          const dates = cardInvoiceDates(month, card);
          created = {
            id: uid(),
            cardId: card.id,
            dueMonth,
            closingDate: dates.closingDate,
            dueDate: dates.dueDate,
          };
          newInvoices.push(created);
        }
        return created.id;
      };
      const data: Tx = {
        id: transactionId,
        description: f.description.trim(),
        amount: isCardRefund ? -amount : amount,
        type: f.type,
        date: f.date,
        referenceMonth:
          f.type === "receita"
            ? referenceMonthForDate(f.date, f.date, selectedReferenceMonth)
            : undefined,
        categoryId: f.categoryId,
        bankId: k === "b" ? id : undefined,
        cardId: k === "c" ? id : undefined,
        invoiceId: invoiceForDate(f.date, f.invoiceMonth || undefined),
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
      const saveTransactions = (transactions: Tx[]) =>
        setState((st) => ({
          ...st,
          invoices: [
            ...st.invoices,
            ...newInvoices.filter(
              (invoice) => !st.invoices.some((existing) => existing.id === invoice.id),
            ),
          ],
          txs: tx
            ? st.txs.map((item) => (item.id === tx.id ? data : item))
            : [...st.txs, ...transactions],
        }));
      if (tx) {
        saveTransactions([data]);
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
          invoiceId: invoiceForDate(
            addMonthsToDate(f.date, index),
            index === 0 ? f.invoiceMonth || undefined : undefined,
          ),
          installmentGroupId,
          installmentNumber: index + 1,
          installmentCount,
        }));
        saveTransactions(installments);
      } else if (recurrenceCount > 1) {
        const recurrenceGroupId = uid();
        const recurringTransactions = Array.from({ length: recurrenceCount }, (_, index): Tx => ({
          ...data,
          id: uid(),
          date: addRecurrenceDate(f.date, f.recurrenceFrequency, index),
          referenceMonth:
            f.type === "receita"
              ? referenceMonthForDate(
                  addRecurrenceDate(f.date, f.recurrenceFrequency, index),
                  f.date,
                  selectedReferenceMonth,
                )
              : undefined,
          invoiceId: invoiceForDate(
            addRecurrenceDate(f.date, f.recurrenceFrequency, index),
            index === 0 ? f.invoiceMonth || undefined : undefined,
          ),
          recurrenceGroupId,
          recurrenceFrequency: f.recurrenceFrequency,
          recurrenceNumber: index + 1,
          recurrenceCount,
        }));
        saveTransactions(recurringTransactions);
      } else {
        saveTransactions([data]);
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
              {f.type === "despesa" && selectedCard && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Para registrar um estorno, informe o valor negativo.
                </p>
              )}
            </div>
            <div>
              <Label>{f.type === "receita" ? "Data do recebimento" : "Data"}</Label>
              <Input
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value, invoiceMonth: "" })}
              />
            </div>
          </div>
          {f.type === "receita" && (
            <div>
              <Label htmlFor="transaction-reference-month">Contabilizar em</Label>
              <select
                id="transaction-reference-month"
                className={sel}
                value={selectedReferenceMonth}
                onChange={(event) => setF({ ...f, referenceMonth: event.target.value })}
              >
                {referenceMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(
                      new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1),
                    )}
                  </option>
                ))}
              </select>
              {selectedReferenceMonth !== f.date.slice(0, 7) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Use para receitas recebidas em um mês diferente do mês de referência. Ex.: salário
                  de novembro pago em dezembro.
                </p>
              )}
            </div>
          )}
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
            {f.type === "despesa" && selectedCard && (
              <p className="mt-1 text-xs text-muted-foreground">
                Obrigatória para compras no cartão.
              </p>
            )}
          </div>
          <div>
            <Label>Conta ou cartão</Label>
            <select
              aria-label="Conta ou cartão"
              className={sel}
              value={f.source}
              onChange={(e) => setF({ ...f, source: e.target.value, invoiceMonth: "" })}
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
          {f.type === "despesa" && selectedCard && (
            <div>
              <Label htmlFor="transaction-invoice">Fatura</Label>
              <select
                id="transaction-invoice"
                className={sel}
                value={selectedInvoiceMonth}
                onChange={(event) => setF({ ...f, invoiceMonth: event.target.value })}
              >
                {invoiceOptions.map((option) => (
                  <option key={option.month} value={option.month}>
                    Fatura de{" "}
                    {monthLabel(
                      new Date(
                        Number(option.month.slice(0, 4)),
                        Number(option.month.slice(5, 7)) - 1,
                        1,
                      ),
                    )}
                    {" · "}
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Sugerida pelo fechamento do cartão; você pode escolher outra fatura em aberto.
              </p>
            </div>
          )}
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
