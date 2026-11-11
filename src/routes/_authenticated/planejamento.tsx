import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, PiggyBank, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  bankBalance,
  brl,
  categoryIcon,
  categoryName,
  fmtDate,
  formatCentsInput,
  formatCurrencyInput,
  loadUserData,
  monthKey,
  uid,
  useStore,
  type SavingsGoalMovement,
} from "@/lib/store";
import {
  budgetStatus,
  getMonthlySpendingByCategory,
  monthlySavingsSuggestion,
  progressPercent,
  savingsGoalBalanceCents,
  type SavingsGoalRecord,
  type SpendingBudget,
} from "@/lib/planning";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento — BolsoFirme" },
      {
        name: "description",
        content: "Limites de gastos por categoria e metas de economia.",
      },
      { property: "og:title", content: "Planejamento — BolsoFirme" },
      {
        property: "og:description",
        content: "Limites de gastos por categoria e metas de economia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanejamentoPage,
});

function moneyCents(value: string): number {
  const raw = value.trim().replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

function MovementPreview({
  bankName,
  goalName,
  amountCents,
  bankBalanceCents,
  goalBalanceCents,
  type,
}: {
  bankName: string;
  goalName: string;
  amountCents: number;
  bankBalanceCents: number;
  goalBalanceCents: number;
  type: "aporte" | "resgate";
}) {
  const bankAfter = type === "aporte" ? bankBalanceCents - amountCents : bankBalanceCents + amountCents;
  const goalAfter = type === "aporte" ? goalBalanceCents + amountCents : goalBalanceCents - amountCents;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="mb-1 font-medium">O que vai acontecer</p>
      <p className="text-muted-foreground">
        {bankName}: {brl(bankBalanceCents)} → {brl(bankAfter)} · {goalName}: {brl(goalBalanceCents)}{" "}
        → {brl(goalAfter)}
      </p>
    </div>
  );
}

function PlanejamentoPage() {
  const s = useStore();
  const [spendingBudgets, setSpendingBudgets] = useState<SpendingBudget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRecord[]>([]);
  const [planningMonth, setPlanningMonth] = useState(monthKey(new Date()));
  const [planningReady, setPlanningReady] = useState(false);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [planningError, setPlanningError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [limitValue, setLimitValue] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [editingGoal, setEditingGoal] = useState<SavingsGoalRecord | null>(null);
  const [movementGoal, setMovementGoal] = useState<SavingsGoalRecord | null>(null);
  const [movementType, setMovementType] = useState<"aporte" | "resgate">("aporte");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementBank, setMovementBank] = useState("");
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [movementNote, setMovementNote] = useState("");
  const [editingMovement, setEditingMovement] = useState<SavingsGoalMovement | null>(null);
  const [legacyBanks, setLegacyBanks] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("No authenticated user.");
        const [budgetsResult, goalsResult] = await Promise.all([
          supabase.from("spending_budgets").select("*").eq("user_id", user.id).order("month"),
          supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at"),
        ]);
        if (budgetsResult.error) throw budgetsResult.error;
        if (goalsResult.error) throw goalsResult.error;
        if (active) {
          setSpendingBudgets(
            (budgetsResult.data ?? []).map((budget) => ({
              id: budget.id,
              categoryId: budget.category_id,
              month: budget.month.slice(0, 7),
              amountCents: Number(budget.amount_cents),
            })),
          );
          setSavingsGoals(
            (goalsResult.data ?? []).map((goal) => ({
              id: goal.id,
              name: goal.name,
              targetCents: Number(goal.target_cents),
              deadline: goal.deadline,
              icon: goal.icon,
              color: goal.color,
              status: goal.status as SavingsGoalRecord["status"],
              legacyBalanceCents: Number(goal.legacy_balance_cents),
              createdAt: goal.created_at,
            })),
          );
        }
      } catch (error) {
        console.error("[Planning] Failed to load budgets and savings goals.", error);
        if (active) {
          setPlanningError(true);
          toast.error("Não foi possível carregar o planejamento.");
        }
      } finally {
        if (active) setPlanningReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const reloadPlanning = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("No authenticated user.");
    const [budgetsResult, goalsResult] = await Promise.all([
      supabase.from("spending_budgets").select("*").eq("user_id", user.id).order("month"),
      supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    if (budgetsResult.error) throw budgetsResult.error;
    if (goalsResult.error) throw goalsResult.error;
    setSpendingBudgets(
      (budgetsResult.data ?? []).map((budget) => ({
        id: budget.id,
        categoryId: budget.category_id,
        month: budget.month.slice(0, 7),
        amountCents: Number(budget.amount_cents),
      })),
    );
    setSavingsGoals(
      (goalsResult.data ?? []).map((goal) => ({
        id: goal.id,
        name: goal.name,
        targetCents: Number(goal.target_cents),
        deadline: goal.deadline,
        icon: goal.icon,
        color: goal.color,
        status: goal.status as SavingsGoalRecord["status"],
        legacyBalanceCents: Number(goal.legacy_balance_cents),
        createdAt: goal.created_at,
      })),
    );
  };
  const saveLimit = async () => {
    const amountCents = moneyCents(limitValue);
    if (
      !selectedCategory ||
      !s.categories.some(
        (category) => category.id === selectedCategory && category.type === "despesa",
      ) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0
    ) {
      toast.error("Selecione uma categoria e informe um limite maior que zero.");
      return;
    }
    setPlanningBusy(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      const monthDate = `${planningMonth}-01`;
      const { error } = await supabase.from("spending_budgets").upsert(
        {
          user_id: user.id,
          category_id: selectedCategory,
          month: monthDate,
          amount_cents: amountCents,
        },
        { onConflict: "user_id,category_id,month" },
      );
      if (error) throw error;
      await reloadPlanning();
      setLimitValue("");
      toast.success("Limite mensal salvo.");
    } catch (error) {
      console.error("[Planning] Failed to save monthly budget.", error);
      toast.error("Não foi possível salvar o limite mensal.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const saveGoal = async () => {
    const targetCents = moneyCents(goalTarget);
    const trimmedName = goalName.trim();
    if (!trimmedName || !Number.isSafeInteger(targetCents) || targetCents <= 0) {
      toast.error("Informe o nome da meta e um valor-alvo maior que zero.");
      return;
    }
    setPlanningBusy(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      const { error } = await supabase.from("savings_goals").insert({
        id: uid(),
        user_id: user.id,
        name: trimmedName,
        target_cents: targetCents,
        deadline: goalDeadline || null,
        status: "em_andamento",
      });
      if (error) throw error;
      await reloadPlanning();
      setGoalName("");
      setGoalTarget("");
      setGoalDeadline("");
      toast.success("Meta de economia criada.");
    } catch (error) {
      console.error("[Planning] Failed to create savings goal.", error);
      toast.error("Não foi possível criar a meta.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const updateGoal = async () => {
    if (!editingGoal) return;
    const targetCents = moneyCents(goalTarget);
    const trimmedName = goalName.trim();
    if (!trimmedName || !Number.isSafeInteger(targetCents) || targetCents <= 0) {
      toast.error("Informe o nome da meta e um valor-alvo maior que zero.");
      return;
    }
    setPlanningBusy(true);
    try {
      const balanceCents = savingsGoalBalanceCents(editingGoal, s.goalMovements ?? []);
      const { error } = await supabase
        .from("savings_goals")
        .update({
          name: trimmedName,
          target_cents: targetCents,
          deadline: goalDeadline || null,
          status: balanceCents >= targetCents ? "concluida" : "em_andamento",
        })
        .eq("id", editingGoal.id);
      if (error) throw error;
      await reloadPlanning();
      setEditingGoal(null);
      setGoalName("");
      setGoalTarget("");
      setGoalDeadline("");
      toast.success("Meta atualizada.");
    } catch (error) {
      console.error("[Planning] Failed to update savings goal.", error);
      toast.error("Não foi possível atualizar a meta.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const openMovementDialog = (goal: SavingsGoalRecord, type: "aporte" | "resgate") => {
    setMovementGoal(goal);
    setMovementType(type);
    setMovementAmount("");
    setMovementBank(s.banks[0]?.id ?? "");
    setMovementDate(new Date().toISOString().slice(0, 10));
    setMovementNote("");
    setEditingMovement(null);
  };
  const submitMovement = async () => {
    const amountCents = moneyCents(movementAmount);
    if (!movementGoal || !movementBank || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      toast.error("Informe a conta e um valor maior que zero.");
      return;
    }
    if (!editingMovement && movementGoal) {
      const bankName = s.banks.find((bank) => bank.id === movementBank)?.name ?? "conta";
      if (movementType === "aporte") {
        const available = bankBalance(s, movementBank);
        if (amountCents > available) {
          toast.error(`Você tem ${brl(available)} em ${bankName}.`);
          return;
        }
      } else {
        const goalBalance = savingsGoalBalanceCents(movementGoal, s.goalMovements ?? []);
        if (amountCents > goalBalance) {
          toast.error(`Você tem ${brl(goalBalance)} guardado em ${movementGoal.name}.`);
          return;
        }
      }
    }
    setPlanningBusy(true);
    try {
      const { error } = editingMovement
        ? await supabase.rpc("update_savings_goal_movement", {
            p_movement_id: editingMovement.id,
            p_amount_cents: amountCents,
            p_date: movementDate,
            p_note: movementNote,
          })
        : await supabase.rpc("create_savings_goal_movement", {
            p_goal_id: movementGoal.id,
            p_type: movementType,
            p_amount_cents: amountCents,
            p_bank_id: movementBank,
            p_date: movementDate,
            p_note: movementNote,
          });
      if (error) throw error;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      await Promise.all([loadUserData(user.id, true), reloadPlanning()]);
      setMovementGoal(null);
      setEditingMovement(null);
      toast.success(
        editingMovement
          ? "Movimento atualizado."
          : movementType === "aporte"
            ? "Aporte registrado."
            : "Resgate registrado.",
      );
    } catch (error) {
      console.error("[Planning] Failed to save savings goal movement.", error);
      toast.error("Não foi possível salvar o movimento. Confira o saldo da conta e da meta.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const reconcileLegacyBalance = async (goal: SavingsGoalRecord) => {
    const bankId = legacyBanks[goal.id];
    if (!bankId) {
      toast.error("Selecione a conta de onde saiu o saldo antigo.");
      return;
    }
    setPlanningBusy(true);
    try {
      const { error } = await supabase.rpc("reconcile_legacy_savings_goal", {
        p_goal_id: goal.id,
        p_bank_id: bankId,
      });
      if (error) throw error;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      await Promise.all([loadUserData(user.id, true), reloadPlanning()]);
      toast.success("Saldo antigo conciliado com a conta.");
    } catch (error) {
      console.error("[Planning] Failed to reconcile a legacy savings goal balance.", error);
      toast.error("Não foi possível conciliar. Verifique se a conta tem saldo suficiente.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const removeMovement = async (movement: SavingsGoalMovement) => {
    if (!window.confirm("Excluir este movimento? O saldo da conta e da meta será recalculado."))
      return;
    setPlanningBusy(true);
    try {
      const { error } = await supabase.rpc("delete_savings_goal_movement", {
        p_movement_id: movement.id,
      });
      if (error) throw error;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      await Promise.all([loadUserData(user.id, true), reloadPlanning()]);
      toast.success("Movimento excluído.");
    } catch (error) {
      console.error("[Planning] Failed to delete savings goal movement.", error);
      toast.error("Não foi possível excluir. Um resgate posterior pode depender deste aporte.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const archiveGoal = async (goal: SavingsGoalRecord) => {
    const balanceCents = savingsGoalBalanceCents(goal, s.goalMovements ?? []);
    if (balanceCents > 0) {
      toast.error("Resgate o saldo da meta antes de arquivá-la.");
      return;
    }
    if (!window.confirm(`Arquivar a meta “${goal.name}”? O histórico será mantido.`)) return;
    setPlanningBusy(true);
    try {
      const { error } = await supabase
        .from("savings_goals")
        .update({ status: "arquivada" })
        .eq("id", goal.id);
      if (error) throw error;
      await reloadPlanning();
      toast.success("Meta arquivada.");
    } catch (error) {
      console.error("[Planning] Failed to archive savings goal.", error);
      toast.error("Não foi possível arquivar a meta.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const copyPreviousMonthBudgets = async () => {
    const [year, month] = planningMonth.split("-").map(Number);
    const previousMonth = monthKey(new Date(year, month - 2, 1));
    const previousBudgets = spendingBudgets.filter((budget) => budget.month === previousMonth);
    if (previousBudgets.length === 0) {
      toast.error("Não há limites no mês anterior para copiar.");
      return;
    }
    setPlanningBusy(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");
      const { error } = await supabase.from("spending_budgets").upsert(
        previousBudgets.map((budget) => ({
          user_id: user.id,
          category_id: budget.categoryId,
          month: `${planningMonth}-01`,
          amount_cents: budget.amountCents,
        })),
        { onConflict: "user_id,category_id,month" },
      );
      if (error) throw error;
      await reloadPlanning();
      toast.success("Limites do mês anterior copiados.");
    } catch (error) {
      console.error("[Planning] Failed to copy previous month's budgets.", error);
      toast.error("Não foi possível copiar os limites do mês anterior.");
    } finally {
      setPlanningBusy(false);
    }
  };
  const currentMonthSpending = getMonthlySpendingByCategory(
    s.txs,
    planningMonth,
    s.cards,
    s.invoices,
  );
  const budgetRows = spendingBudgets
    .filter((budget) => budget.month === planningMonth)
    .map((budget) => {
      const category = s.categories.find((item) => item.id === budget.categoryId);
      const spentCents = currentMonthSpending[budget.categoryId] ?? 0;
      return {
        ...budget,
        category,
        spentCents,
        progress: progressPercent(Math.max(0, spentCents), budget.amountCents),
      };
    })
    .filter((budget) => budget.category?.type === "despesa");
  const savedGoalsTotal = savingsGoals.reduce(
    (total, goal) =>
      total +
      (goal.status === "arquivada" ? 0 : savingsGoalBalanceCents(goal, s.goalMovements ?? [])),
    0,
  );
  const monthBudgetTotal = budgetRows.reduce((total, budget) => total + budget.amountCents, 0);
  const monthBudgetSpent = budgetRows.reduce((total, budget) => total + budget.spentCents, 0);
  const activeExpenseCategories = s.categories.filter(
    (category) => category.type === "despesa" && !category.archived,
  );

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle
        title="Planejamento"
        sub="Acompanhe despesas do mês e o dinheiro movimentado para suas metas"
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Orçamento e metas</h3>
            <p className="text-sm text-muted-foreground">
              Defina limites por categoria e guarde dinheiro para seus objetivos.
            </p>
          </div>
        </div>
        {planningError && (
          <p
            role="alert"
            className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            Planejamento indisponível. Recarregue a página e tente novamente.
          </p>
        )}
        {planningReady && !planningError && (
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Guardado em metas</p>
              <p className="font-semibold">{brl(savedGoalsTotal)}</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Limites de {planningMonth}</p>
              <p className="font-semibold">{brl(monthBudgetTotal)}</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Consumido nas categorias limitadas</p>
              <p className="font-semibold">{brl(monthBudgetSpent)}</p>
            </div>
          </div>
        )}
        {!planningReady ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando orçamento e metas…
          </p>
        ) : (
          !planningError && (
            <div className="space-y-6">
              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Limites por categoria</h4>
                    <p className="text-sm text-muted-foreground">
                      Compras de cartão são agrupadas pelo mês de vencimento da fatura.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="budget-month" className="mb-1 block text-sm font-medium">
                      Mês do orçamento
                    </label>
                    <Input
                      id="budget-month"
                      type="month"
                      value={planningMonth}
                      onChange={(event) => setPlanningMonth(event.target.value)}
                      disabled={planningBusy}
                    />
                  </div>
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label htmlFor="budget-category" className="mb-1 block text-sm font-medium">
                      Categoria de despesa
                    </label>
                    <select
                      id="budget-category"
                      className="h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm"
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      disabled={planningBusy || activeExpenseCategories.length === 0}
                    >
                      <option value="">Selecionar categoria</option>
                      {activeExpenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="budget-value" className="mb-1 block text-sm font-medium">
                      Limite (R$)
                    </label>
                    <div className="flex items-center rounded-md border border-input bg-card pl-3">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input
                        id="budget-value"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={limitValue}
                        onChange={(event) => setLimitValue(formatCurrencyInput(event.target.value))}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                        disabled={planningBusy}
                      />
                    </div>
                  </div>
                  <Button
                    className="self-end"
                    onClick={() => void saveLimit()}
                    disabled={
                      planningBusy ||
                      !selectedCategory ||
                      !Number.isSafeInteger(moneyCents(limitValue)) ||
                      moneyCents(limitValue) <= 0
                    }
                  >
                    Salvar limite
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyPreviousMonthBudgets()}
                  disabled={planningBusy}
                >
                  Copiar limites do mês anterior
                </Button>
                {budgetRows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nenhum limite definido para este mês.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {budgetRows.map((budget) => (
                      <div key={budget.id} className="rounded-lg border border-border p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {categoryIcon(budget.category)}{" "}
                            {budget.category ? categoryName(budget.category) : "Sem categoria"}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              budgetStatus(budget.progress) === "estourado"
                                ? "text-destructive"
                                : budgetStatus(budget.progress) === "atencao"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {brl(budget.spentCents)} de {brl(budget.amountCents)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={planningBusy}
                            onClick={() => {
                              setSelectedCategory(budget.categoryId);
                              setLimitValue(formatCentsInput(budget.amountCents));
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir limite de ${budget.category?.name}`}
                            disabled={planningBusy}
                            onClick={() => {
                              void (async () => {
                                if (
                                  !window.confirm(`Excluir o limite de ${budget.category?.name}?`)
                                )
                                  return;
                                setPlanningBusy(true);
                                try {
                                  const { error } = await supabase
                                    .from("spending_budgets")
                                    .delete()
                                    .eq("id", budget.id);
                                  if (error) throw error;
                                  await reloadPlanning();
                                  toast.success("Limite excluído.");
                                } catch (error) {
                                  console.error(
                                    "[Planning] Failed to delete monthly budget.",
                                    error,
                                  );
                                  toast.error("Não foi possível excluir o limite.");
                                } finally {
                                  setPlanningBusy(false);
                                }
                              })();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-expense" />
                          </Button>
                        </div>
                        <Progress
                          value={budget.progress}
                          aria-label={`Orçamento usado: ${Math.round(budget.progress)}%`}
                        />
                        {budgetStatus(budget.progress) === "estourado" && (
                          <p className="mt-2 text-xs text-destructive">
                            Limite ultrapassado em {brl(budget.spentCents - budget.amountCents)}.
                          </p>
                        )}
                        {budgetStatus(budget.progress) === "atencao" && (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            Atenção: {Math.round(budget.progress)}% do limite foi usado.
                          </p>
                        )}
                        {budgetStatus(budget.progress) === "normal" && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Restam {brl(Math.max(0, budget.amountCents - budget.spentCents))} neste
                            limite.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Metas de economia</h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="goal-name" className="mb-1 block text-sm font-medium">
                      Nome da meta
                    </label>
                    <Input
                      id="goal-name"
                      value={goalName}
                      onChange={(event) => setGoalName(event.target.value)}
                      placeholder="Ex.: Viagem"
                      disabled={planningBusy}
                    />
                  </div>
                  <div>
                    <label htmlFor="goal-target" className="mb-1 block text-sm font-medium">
                      Valor-alvo (R$)
                    </label>
                    <div className="flex items-center rounded-md border border-input bg-card pl-3">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input
                        id="goal-target"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={goalTarget}
                        onChange={(event) => setGoalTarget(formatCurrencyInput(event.target.value))}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                        disabled={planningBusy}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="goal-deadline" className="mb-1 block text-sm font-medium">
                      Prazo (opcional)
                    </label>
                    <Input
                      id="goal-deadline"
                      type="month"
                      value={goalDeadline.slice(0, 7)}
                      onChange={(event) =>
                        setGoalDeadline(event.target.value ? `${event.target.value}-01` : "")
                      }
                      disabled={planningBusy}
                    />
                  </div>
                  <Button
                    className="self-end"
                    onClick={() => (editingGoal ? void updateGoal() : void saveGoal())}
                    disabled={
                      planningBusy ||
                      !goalName.trim() ||
                      !Number.isSafeInteger(moneyCents(goalTarget)) ||
                      moneyCents(goalTarget) <= 0
                    }
                  >
                    {editingGoal ? "Salvar alterações" : "Criar meta"}
                  </Button>
                </div>
                {editingGoal && (
                  <Button
                    className="mt-2"
                    variant="ghost"
                    onClick={() => {
                      setEditingGoal(null);
                      setGoalName("");
                      setGoalTarget("");
                      setGoalDeadline("");
                    }}
                  >
                    Cancelar edição
                  </Button>
                )}
                <p className="mt-3 text-sm text-muted-foreground">
                  Aportes e resgates sempre usam uma conta. Se guardar dinheiro em espécie, cadastre
                  em Bancos uma conta virtual “Dinheiro guardado” com o saldo disponível.{" "}
                  <Link to="/bancos" className="font-medium text-primary underline">
                    Gerenciar contas
                  </Link>
                </p>
                {savingsGoals.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Crie uma meta para acompanhar o progresso de uma compra ou viagem.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {savingsGoals.map((goal) => {
                      const goalBalance = savingsGoalBalanceCents(goal, s.goalMovements ?? []);
                      const progress = progressPercent(goalBalance, goal.targetCents);
                      const completed = goalBalance >= goal.targetCents;
                      const monthlySuggestion = monthlySavingsSuggestion(
                        goalBalance,
                        goal.targetCents,
                        goal.deadline,
                      );
                      const goalMovements = (s.goalMovements ?? [])
                        .filter((movement) => movement.goalId === goal.id)
                        .sort((a, b) => b.date.localeCompare(a.date));
                      return (
                        <div key={goal.id} className="rounded-lg border border-border p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xl" aria-hidden="true">
                              {goal.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {goal.name}
                            </span>
                            <Badge
                              variant={
                                goal.status === "arquivada"
                                  ? "secondary"
                                  : completed
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {goal.status === "arquivada"
                                ? "Arquivada"
                                : completed
                                  ? "Concluída"
                                  : "Em andamento"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {brl(goalBalance)} de {brl(goal.targetCents)} · {Math.round(progress)}
                              %
                            </span>
                          </div>
                          <Progress
                            value={progress}
                            aria-label={`${goal.name}: ${Math.round(progress)}% concluída`}
                          />
                          {goal.deadline && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Prazo:{" "}
                              {new Intl.DateTimeFormat("pt-BR", {
                                month: "long",
                                year: "numeric",
                              }).format(new Date(`${goal.deadline}T12:00:00`))}
                              {monthlySuggestion !== null && !completed && (
                                <>
                                  {" "}
                                  · faltam {brl(Math.max(0, goal.targetCents - goalBalance))} ·
                                  sugestão de {brl(monthlySuggestion)}/mês
                                </>
                              )}
                            </p>
                          )}
                          {goal.legacyBalanceCents > 0 && (
                            <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                              <p className="text-sm font-medium">
                                Saldo antigo pendente de conciliação: {brl(goal.legacyBalanceCents)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Escolha a conta onde esse dinheiro estava. A conciliação registra o
                                aporte e reduz o saldo da conta uma única vez.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <select
                                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm"
                                  aria-label={`Conta de origem do saldo antigo de ${goal.name}`}
                                  value={legacyBanks[goal.id] ?? ""}
                                  onChange={(event) =>
                                    setLegacyBanks((current) => ({
                                      ...current,
                                      [goal.id]: event.target.value,
                                    }))
                                  }
                                  disabled={planningBusy}
                                >
                                  <option value="">Selecione a conta de origem</option>
                                  {s.banks.map((bank) => (
                                    <option key={bank.id} value={bank.id}>
                                      {bank.name}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="outline"
                                  disabled={planningBusy || !legacyBanks[goal.id]}
                                  onClick={() => void reconcileLegacyBalance(goal)}
                                >
                                  Conciliar saldo
                                </Button>
                              </div>
                            </div>
                          )}
                          {goal.deadline === null && goal.status !== "arquivada" && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Sem prazo definido.
                            </p>
                          )}
                          {goal.status !== "arquivada" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => openMovementDialog(goal, "aporte")}
                                disabled={planningBusy || s.banks.length === 0}
                              >
                                Aportar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openMovementDialog(goal, "resgate")}
                                disabled={planningBusy || s.banks.length === 0 || goalBalance <= 0}
                              >
                                Resgatar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingGoal(goal);
                                  setGoalName(goal.name);
                                  setGoalTarget(formatCentsInput(goal.targetCents));
                                  setGoalDeadline(goal.deadline?.slice(0, 7) ?? "");
                                }}
                                disabled={planningBusy}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void archiveGoal(goal)}
                                disabled={planningBusy}
                              >
                                Arquivar
                              </Button>
                            </div>
                          )}
                          {goalMovements.length > 0 && (
                            <details className="mt-3 border-t border-border pt-3">
                              <summary className="cursor-pointer text-sm font-medium">
                                Histórico de movimentos ({goalMovements.length})
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {goalMovements.map((movement) => (
                                  <li
                                    key={movement.id}
                                    className="flex flex-wrap items-center gap-2 text-sm"
                                  >
                                    <span className="min-w-0 flex-1">
                                      {movement.type === "aporte" ? "Aporte" : "Resgate"} ·{" "}
                                      {brl(movement.amountCents)} · {fmtDate(movement.date)}
                                      {" · "}
                                      {s.banks.find((bank) => bank.id === movement.bankId)?.name ??
                                        "Conta"}
                                      {movement.note ? ` · ${movement.note}` : ""}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Editar ${movement.type} de ${goal.name} em ${fmtDate(movement.date)}`}
                                      disabled={planningBusy}
                                      onClick={() => {
                                        setMovementGoal(goal);
                                        setMovementType(movement.type);
                                        setEditingMovement(movement);
                                        setMovementAmount(formatCentsInput(movement.amountCents));
                                        setMovementBank(movement.bankId);
                                        setMovementDate(movement.date);
                                        setMovementNote(movement.note);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Excluir ${movement.type} de ${goal.name} em ${fmtDate(movement.date)}`}
                                      disabled={planningBusy}
                                      onClick={() => void removeMovement(movement)}
                                    >
                                      <Trash2 className="h-4 w-4 text-expense" />
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </section>
      <Dialog
        open={movementGoal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovementGoal(null);
            setEditingMovement(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMovement
                ? "Editar movimento"
                : movementType === "aporte"
                  ? "Aportar na meta"
                  : "Resgatar da meta"}
            </DialogTitle>
            <DialogDescription>
              {movementGoal?.name}.{" "}
              {movementType === "aporte"
                ? "O valor será debitado da conta escolhida."
                : "O valor será creditado na conta escolhida."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="goal-movement-bank" className="mb-1 block text-sm font-medium">
                {movementType === "aporte" ? "Conta de origem" : "Conta de destino"}
              </label>
              <select
                id="goal-movement-bank"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={movementBank}
                onChange={(event) => setMovementBank(event.target.value)}
                disabled={planningBusy || editingMovement !== null}
              >
                <option value="">Selecione uma conta</option>
                {s.banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal-movement-amount" className="mb-1 block text-sm font-medium">
                Valor (R$)
              </label>
              <div className="flex items-center rounded-md border border-input bg-card pl-3">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  id="goal-movement-amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(formatCurrencyInput(event.target.value))}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  disabled={planningBusy}
                />
              </div>
            </div>
            <div>
              <label htmlFor="goal-movement-date" className="mb-1 block text-sm font-medium">
                Data
              </label>
              <Input
                id="goal-movement-date"
                type="date"
                value={movementDate}
                onChange={(event) => setMovementDate(event.target.value)}
                disabled={planningBusy}
              />
            </div>
            <div>
              <label htmlFor="goal-movement-note" className="mb-1 block text-sm font-medium">
                Observação (opcional)
              </label>
              <Input
                id="goal-movement-note"
                value={movementNote}
                onChange={(event) => setMovementNote(event.target.value)}
                disabled={planningBusy}
              />
            </div>
            {!editingMovement && movementGoal && Number.isSafeInteger(moneyCents(movementAmount)) && moneyCents(movementAmount) > 0 && (
              <MovementPreview
                bankName={s.banks.find((bank) => bank.id === movementBank)?.name ?? ""}
                goalName={movementGoal.name}
                amountCents={moneyCents(movementAmount)}
                bankBalanceCents={movementBank ? bankBalance(s, movementBank) : 0}
                goalBalanceCents={savingsGoalBalanceCents(movementGoal, s.goalMovements ?? [])}
                type={movementType}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementGoal(null)} disabled={planningBusy}>
              Cancelar
            </Button>
            <Button
              onClick={() => void submitMovement()}
              disabled={
                planningBusy ||
                !movementBank ||
                !Number.isSafeInteger(moneyCents(movementAmount)) ||
                moneyCents(movementAmount) <= 0
              }
            >
              {editingMovement ? "Salvar movimento" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
