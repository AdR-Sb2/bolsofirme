import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Trash2,
  Camera,
  LockKeyhole,
  UserRound,
  Save,
  PiggyBank,
  Target,
  Moon,
  Sun,
  History,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  PALETTE,
  bankBalance,
  brl,
  fmtDate,
  formatCentsInput,
  formatCurrencyInput,
  loadUserData,
  monthKey,
  setState,
  uid,
  useStore,
  type Category,
  type SavingsGoalMovement,
  type TxType,
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
import { applyThemePreference, getThemePreference, type ThemePreference } from "@/lib/theme";

const CATEGORY_EMOJIS = [
  "🏷️",
  "🍔",
  "🛒",
  "🚗",
  "🏠",
  "💡",
  "💊",
  "📚",
  "🎮",
  "✈️",
  "🐾",
  "👕",
  "💰",
  "💳",
  "🎁",
  "🍽️",
  "☕",
  "🏋️",
  "🎵",
  "📦",
  "🧾",
  "🚌",
  "🛠️",
  "🌿",
  "💻",
  "📱",
  "🎓",
  "🏦",
  "🧹",
  "❤️",
];

function EmojiPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (emoji: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={`${label}: ${value}`}>
          <span aria-hidden="true" className="mr-2 text-lg">
            {value}
          </span>
          Escolher ícone
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <p className="mb-2 text-sm font-medium">Escolha um ícone</p>
        <div className="grid grid-cols-6 gap-1">
          {CATEGORY_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              type="button"
              size="icon"
              variant={value === emoji ? "secondary" : "ghost"}
              aria-label={`Selecionar ${emoji}`}
              aria-pressed={value === emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              <span aria-hidden="true" className="text-lg">
                {emoji}
              </span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColorPalette({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
              value === color
                ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Selecionar cor ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — BolsoFirme" },
      { name: "description", content: "Categorias, preferências e exportação de dados." },
      { property: "og:title", content: "Configurações — BolsoFirme" },
      { property: "og:description", content: "Categorias, preferências e exportação de dados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Config,
});

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

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

function Config() {
  const s = useStore();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [newCategoryType, setNewCategoryType] = useState<TxType>("despesa");
  const [categoryColor, setCategoryColor] = useState(PALETTE[0] as string);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySort, setCategorySort] = useState<"name" | "usage">("name");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("🏷️");
  const [editColor, setEditColor] = useState(PALETTE[0] as string);
  const [editType, setEditType] = useState<TxType>("despesa");
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [profileName, setProfileName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [spendingBudgets, setSpendingBudgets] = useState<SpendingBudget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRecord[]>([]);
  const [planningMonth, setPlanningMonth] = useState(monthKey(new Date()));
  const [planningReady, setPlanningReady] = useState(false);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [planningError, setPlanningError] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [activity, setActivity] = useState<{ id: number; summary: string; created_at: string }[]>(
    [],
  );
  const [activityReady, setActivityReady] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
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
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("display_name,avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfileName(
        data?.display_name ||
          user.user_metadata?.["full_name"] ||
          user.user_metadata?.["name"] ||
          "",
      );
      setAvatar(
        data?.avatar_url ||
          user.user_metadata?.["avatar_url"] ||
          user.user_metadata?.["picture"] ||
          "",
      );
      setEmail(user.email || "");
    })();
  }, []);
  useEffect(() => setTheme(getThemePreference()), []);
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
          toast.error(
            "Não foi possível carregar o planejamento. Aplique a migration de metas e orçamento no Supabase.",
          );
        }
      } finally {
        if (active) setPlanningReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_log")
          .select("id,summary,created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (active) setActivity(data ?? []);
      } catch (error) {
        console.error("[Activity] Failed to load account activity.", error);
        if (active) setActivityError(true);
      } finally {
        if (active) setActivityReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const saveProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Entre novamente na sua conta.");
      return;
    }
    if (profileName.trim().length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setProfileBusy(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .upsert({ user_id: user.id, display_name: profileName.trim(), avatar_url: avatar });
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim(), name: profileName.trim() },
      });
      if (metadataError) throw metadataError;
      toast.success("Perfil atualizado.");
      window.dispatchEvent(new Event("profile-updated"));
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar seu perfil.");
    } finally {
      setProfileBusy(false);
    }
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];
    if (!extension) {
      toast.error("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Entre novamente na sua conta.");
      return;
    }
    setProfileBusy(true);
    const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        console.error("[Profile] Failed to upload avatar.", uploadError);
        const message = uploadError.message.toLowerCase();
        if (message.includes("bucket not found")) {
          toast.error(
            "O armazenamento de fotos não está configurado. Aplique a migration 20261110000100_profile_avatars.sql no Supabase.",
          );
        } else if (message.includes("row-level security") || message.includes("unauthorized")) {
          toast.error(
            "O Supabase recusou o envio da foto. Verifique as políticas de acesso do bucket avatars.",
          );
        } else {
          toast.error(`Não foi possível enviar a foto: ${uploadError.message}`);
        }
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: saveError } = await supabase.from("user_profiles").upsert({
        user_id: user.id,
        display_name: profileName.trim() || user.email?.split("@")[0] || "Usuário",
        avatar_url: data.publicUrl,
      });
      if (saveError) {
        console.error("[Profile] Avatar uploaded but profile could not be updated.", saveError);
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([path]);
        if (cleanupError)
          console.error("[Profile] Failed to remove unlinked avatar.", cleanupError);
        toast.error("A foto foi enviada, mas não foi possível salvá-la no perfil.");
        return;
      }
      setAvatar(data.publicUrl);
      toast.success("Foto de perfil atualizada.");
      window.dispatchEvent(new Event("profile-updated"));
    } catch (e) {
      console.error("[Profile] Unexpected avatar upload error.", e);
      toast.error("Ocorreu um erro inesperado ao enviar a foto.");
    } finally {
      setProfileBusy(false);
    }
  };
  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setProfileBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Senha atualizada com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível alterar a senha.");
    } finally {
      setProfileBusy(false);
    }
  };
  const update = (id: string, patch: Partial<Category>) =>
    setState((st) => ({
      ...st,
      categories: st.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  const del = (id: string) => {
    if (spendingBudgets.some((budget) => budget.categoryId === id)) {
      toast.error("Remova os limites mensais antes de excluir a categoria.");
      return;
    }
    setState((st) => ({
      ...st,
      categories: st.categories.filter((category) => category.id !== id),
      txs: st.txs.map((transaction) =>
        transaction.categoryId === id ? { ...transaction, categoryId: "" } : transaction,
      ),
    }));
    toast.success("Categoria excluída. As transações foram mantidas sem categoria.");
  };
  const add = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe um nome para a categoria.");
      return;
    }
    if (
      s.categories.some(
        (category) =>
          category.name.toLocaleLowerCase("pt-BR") === trimmedName.toLocaleLowerCase("pt-BR"),
      )
    ) {
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }
    setState((st) => ({
      ...st,
      categories: [
        ...st.categories,
        { id: uid(), name: trimmedName, icon, color: categoryColor, type: newCategoryType },
      ],
    }));
    setName("");
    setIcon("🏷️");
    setCategoryColor(PALETTE[0] as string);
    setNewCategoryType("despesa");
    toast.success("Categoria criada");
  };
  const openCategoryEditor = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setEditType(category.type);
  };
  const saveCategoryEdit = () => {
    const trimmedName = editName.trim();
    if (!editingCategory || !trimmedName) {
      toast.error("Informe um nome para a categoria.");
      return;
    }
    if (
      s.categories.some(
        (category) =>
          category.id !== editingCategory.id &&
          category.name.toLocaleLowerCase("pt-BR") === trimmedName.toLocaleLowerCase("pt-BR"),
      )
    ) {
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }
    if (
      editType === "receita" &&
      editingCategory.type !== "receita" &&
      spendingBudgets.some((budget) => budget.categoryId === editingCategory.id)
    ) {
      toast.error("Remova o limite mensal antes de transformar esta categoria em receita.");
      return;
    }
    update(editingCategory.id, {
      name: trimmedName,
      icon: editIcon,
      color: editColor,
      type: editType,
    });
    setEditingCategory(null);
    toast.success("Categoria atualizada.");
  };
  const categoryUsage = new Map<string, number>();
  for (const transaction of s.txs) {
    if (transaction.categoryId) {
      categoryUsage.set(
        transaction.categoryId,
        (categoryUsage.get(transaction.categoryId) ?? 0) + 1,
      );
    }
  }
  const visibleCategories = s.categories
    .filter((category) =>
      category.name
        .toLocaleLowerCase("pt-BR")
        .includes(categorySearch.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      categorySort === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : (categoryUsage.get(b.id) ?? 0) - (categoryUsage.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name, "pt-BR"),
    );
  const csv = () => {
    const lines = [
      ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
      ...s.txs.map((t) => [
        t.date,
        t.description,
        (t.amount / 100).toFixed(2),
        t.type,
        s.categories.find((c) => c.id === t.categoryId)?.name ?? "",
      ]),
    ];
    download(
      "bolsofirme.csv",
      lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"),
      "text/csv",
    );
  };
  const deleteAccount = async () => {
    if (deletePhrase !== "EXCLUIR") return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError)
        console.error("[Account] Deleted account but sign-out returned an error.", signOutError);
      window.location.assign("/auth");
    } catch (error) {
      console.error("[Account] Account deletion failed.", error);
      toast.error(
        "Não foi possível excluir a conta. Verifique se a função delete-account foi publicada no Supabase.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };
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

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle title="Configurações" sub="Personalize categorias, preferências e seus dados" />
      <section id="perfil" className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Meu perfil</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border bg-secondary text-xl font-bold text-primary">
            {avatar ? (
              <img src={avatar} alt="Foto do perfil" className="h-full w-full object-cover" />
            ) : (
              profileName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((x) => x[0])
                .join("")
                .toUpperCase() || "BF"
            )}
          </div>
          <div className="grid gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent">
              <Camera className="h-4 w-4" />
              Alterar foto
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={profileBusy}
                onChange={(e) => {
                  void uploadAvatar(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máximo 5 MB</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome de exibição</label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail da conta</label>
            <Input value={email} disabled />
          </div>
        </div>
        <Button className="mt-3" onClick={() => void saveProfile()} disabled={profileBusy}>
          <Save className="mr-2 h-4 w-4" />
          Salvar perfil
        </Button>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Segurança e senha</h3>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Defina uma senha para entrar também com e-mail e senha. Para contas Google, isso não
          altera a senha da sua conta Google.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nova senha</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirmar nova senha</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Repita a senha"
            />
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => void changePassword()}
          disabled={profileBusy}
        >
          Atualizar senha
        </Button>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="font-semibold">Categorias</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize seus lançamentos com ícones e cores fáceis de reconhecer.
          </p>
        </div>
        <div className="mb-5 grid gap-3 rounded-lg border border-border bg-background/40 p-3">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <div>
              <span className="mb-1 block text-sm font-medium">Ícone</span>
              <EmojiPicker value={icon} onChange={setIcon} label="Ícone da nova categoria" />
            </div>
            <div>
              <label htmlFor="new-category-type" className="mb-1 block text-sm font-medium">
                Tipo
              </label>
              <select
                id="new-category-type"
                className="mb-2 h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={newCategoryType}
                onChange={(event) => setNewCategoryType(event.target.value as TxType)}
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
              <label htmlFor="new-category-name" className="mb-1 block text-sm font-medium">
                Nome da categoria
              </label>
              <Input
                id="new-category-name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Mercado"
                onKeyDown={(event) => {
                  if (event.key === "Enter") add();
                }}
              />
            </div>
            <Button onClick={add} disabled={!name.trim()}>
              Adicionar categoria
            </Button>
          </div>
          <ColorPalette
            value={categoryColor}
            onChange={setCategoryColor}
            label="Cor da nova categoria"
          />
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              aria-label="Buscar categoria"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="Buscar categoria"
            />
          </div>
          <div>
            <label htmlFor="category-sort" className="sr-only">
              Ordenar categorias
            </label>
            <select
              id="category-sort"
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-auto"
              value={categorySort}
              onChange={(event) => setCategorySort(event.target.value as "name" | "usage")}
            >
              <option value="name">Ordem alfabética</option>
              <option value="usage">Mais transações</option>
            </select>
          </div>
        </div>
        <div className="grid gap-2">
          {visibleCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {s.categories.length === 0
                ? "Nenhuma categoria cadastrada."
                : "Nenhuma categoria encontrada."}
            </p>
          ) : (
            visibleCategories.map((category) => {
              const count = categoryUsage.get(category.id) ?? 0;
              return (
                <div
                  key={category.id}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span aria-hidden="true" className="text-lg">
                    {category.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                  <Badge variant="outline" className="shrink-0">
                    {category.type === "receita" ? "Receita" : "Despesa"}
                  </Badge>
                  <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                    {count} {count === 1 ? "transação" : "transações"}
                  </Badge>
                  <span className="sr-only">
                    {count} {count === 1 ? "transação" : "transações"}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Editar categoria ${category.name}`}
                    onClick={() => openCategoryEditor(category)}
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir categoria ${category.name}`}
                    onClick={() => setDeletingCategory(category)}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </section>
      <Dialog
        open={Boolean(editingCategory)}
        onOpenChange={(open) => {
          if (!open) setEditingCategory(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>
              Altere o nome, o ícone e a cor usados para identificar esta categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label htmlFor="edit-category-name" className="mb-1 block text-sm font-medium">
                Nome da categoria
              </label>
              <Input
                id="edit-category-name"
                value={editName}
                maxLength={40}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-category-type" className="mb-1 block text-sm font-medium">
                Tipo
              </label>
              <select
                id="edit-category-type"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={editType}
                onChange={(event) => setEditType(event.target.value as TxType)}
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Ícone</span>
              <EmojiPicker value={editIcon} onChange={setEditIcon} label="Ícone da categoria" />
            </div>
            <ColorPalette value={editColor} onChange={setEditColor} label="Cor da categoria" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancelar
            </Button>
            <Button onClick={saveCategoryEdit} disabled={!editName.trim()}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory &&
                (() => {
                  const count = categoryUsage.get(deletingCategory.id) ?? 0;
                  return (
                    <>
                      A categoria “{deletingCategory.name}” está vinculada a {count}{" "}
                      {count === 1 ? "transação" : "transações"}. Essas transações serão mantidas,
                      mas ficarão sem categoria. Esta ação não pode ser desfeita.
                      {spendingBudgets.some(
                        (budget) => budget.categoryId === deletingCategory.id,
                      ) && " Remova os limites mensais dessa categoria antes de excluí-la."}
                    </>
                  );
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingCategory) del(deletingCategory.id);
                setDeletingCategory(null);
              }}
            >
              Excluir categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Orçamento e metas</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe despesas do mês e o dinheiro movimentado para suas metas.
            </p>
          </div>
        </div>
        {planningError && (
          <p
            role="alert"
            className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            Planejamento indisponível. Aplique a migration de metas e orçamento no Supabase e
            recarregue a página.
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
                      disabled={planningBusy || s.categories.length === 0}
                    >
                      <option value="">Selecionar categoria</option>
                      {s.categories
                        .filter((category) => category.type === "despesa")
                        .map((category) => (
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
                            {budget.category?.icon} {budget.category?.name}
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
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => window.location.assign("/bancos")}
                  >
                    Gerenciar contas
                  </button>
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
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Privacidade e conexões</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Gerencie convites e escolha quais informações financeiras compartilha.
        </p>
        <Button variant="outline" onClick={() => window.location.assign("/conexoes")}>
          Gerenciar conexões e compartilhamento
        </Button>
        <h3 className="mb-2 mt-5 font-semibold">Preferências</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Escolha a aparência do aplicativo. A preferência fica salva neste dispositivo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            aria-pressed={theme === "light"}
            onClick={() => {
              setTheme("light");
              applyThemePreference("light");
            }}
          >
            <Sun className="mr-2 h-4 w-4" />
            Claro
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            aria-pressed={theme === "dark"}
            onClick={() => {
              setTheme("dark");
              applyThemePreference("dark");
            }}
          >
            <Moon className="mr-2 h-4 w-4" />
            Escuro
          </Button>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">Dados</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              download("bolsofirme.json", JSON.stringify(s, null, 2), "application/json")
            }
          >
            Exportar JSON
          </Button>
          <Button variant="outline" onClick={csv}>
            Exportar CSV
          </Button>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Histórico de atividades</h3>
        </div>
        {activityError ? (
          <p role="status" className="text-sm text-muted-foreground">
            Histórico indisponível. Aplique a migration
            20261110000800_investment_history_and_activity.sql no Supabase.
          </p>
        ) : !activityReady ? (
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            As próximas alterações financeiras aparecerão aqui.
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 border-b border-border py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 text-sm">{item.summary}</span>
                <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(item.created_at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 font-semibold">Conta</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Excluir a conta remove permanentemente seus dados financeiros e conexões.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
            placeholder={'Digite "EXCLUIR" para confirmar'}
            aria-label="Confirmação para exclusão da conta"
            autoComplete="off"
          />
          <Button
            variant="destructive"
            className="shrink-0"
            disabled={deletePhrase !== "EXCLUIR" || deleteBusy}
            onClick={() => void deleteAccount()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteBusy ? "Excluindo..." : "Excluir conta"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A exclusão exige que a função segura delete-account esteja publicada no Supabase.
        </p>
      </section>
    </div>
  );
}
