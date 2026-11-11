import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PALETTE, setState, uid, useStore, type Category, type TxType } from "@/lib/store";
import type { SpendingBudget } from "@/lib/planning";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — BolsoFirme" },
      {
        name: "description",
        content: "Organize suas categorias com ícones e cores fáceis de reconhecer.",
      },
      { property: "og:title", content: "Categorias — BolsoFirme" },
      {
        property: "og:description",
        content: "Organize suas categorias com ícones e cores fáceis de reconhecer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriasPage,
});

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

function CategoriasPage() {
  const s = useStore();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [newCategoryType, setNewCategoryType] = useState<TxType>("despesa");
  const [categoryColor, setCategoryColor] = useState(PALETTE[0] as string);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySort, setCategorySort] = useState<"name" | "usage">("name");
  const [categoryTab, setCategoryTab] = useState<"ativas" | "arquivadas">("ativas");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("🏷️");
  const [editColor, setEditColor] = useState(PALETTE[0] as string);
  const [editType, setEditType] = useState<TxType>("despesa");
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [spendingBudgets, setSpendingBudgets] = useState<SpendingBudget[]>([]);
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
        const { data, error } = await supabase
          .from("spending_budgets")
          .select("id,category_id,month,amount_cents")
          .eq("user_id", user.id);
        if (error) throw error;
        if (active) {
          setSpendingBudgets(
            (data ?? []).map((budget) => ({
              id: budget.id,
              categoryId: budget.category_id,
              month: budget.month.slice(0, 7),
              amountCents: Number(budget.amount_cents),
            })),
          );
        }
      } catch (error) {
        console.error("[Categories] Failed to load spending budgets.", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
  const archiveCategory = (category: Category) => {
    update(category.id, { archived: true });
    toast(`“${category.name}” arquivada. As transações foram mantidas.`, {
      action: {
        label: "Desfazer",
        onClick: () => update(category.id, { archived: false }),
      },
    });
  };
  const restoreCategory = (category: Category) => {
    update(category.id, { archived: false });
    toast(`“${category.name}” está ativa novamente.`, {
      action: {
        label: "Desfazer",
        onClick: () => update(category.id, { archived: true }),
      },
    });
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
    setNewCategoryOpen(false);
    setCategoryTab("ativas");
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
  const activeCategories = s.categories.filter((category) => !category.archived);
  const archivedCategories = s.categories.filter((category) => category.archived === true);
  const visibleCategories = activeCategories
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
  const groupedActiveCategories: { title: string; type: TxType; items: Category[] }[] = [
    { title: "Despesas", type: "despesa", items: visibleCategories.filter((c) => c.type === "despesa") },
    { title: "Receitas", type: "receita", items: visibleCategories.filter((c) => c.type === "receita") },
  ];
  const visibleArchivedCategories = archivedCategories
    .filter((category) =>
      category.name
        .toLocaleLowerCase("pt-BR")
        .includes(categorySearch.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle
        title="Categorias"
        sub="Organize seus lançamentos com ícones e cores fáceis de reconhecer"
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Suas categorias</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCategories.length}{" "}
              {activeCategories.length === 1 ? "categoria ativa" : "categorias ativas"} ·{" "}
              {archivedCategories.length}{" "}
              {archivedCategories.length === 1 ? "arquivada" : "arquivadas"}
            </p>
          </div>
          <Button onClick={() => setNewCategoryOpen(true)}>
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            Nova categoria
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-secondary p-1">
            <button
              type="button"
              onClick={() => setCategoryTab("ativas")}
              aria-pressed={categoryTab === "ativas"}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                categoryTab === "ativas"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ativas
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab("arquivadas")}
              aria-pressed={categoryTab === "arquivadas"}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                categoryTab === "arquivadas"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Arquivadas
              {archivedCategories.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {archivedCategories.length}
                </span>
              )}
            </button>
          </div>
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
          {categoryTab === "ativas" && (
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
          )}
        </div>
        {categoryTab === "ativas" ? (
          activeCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma categoria ativa. Crie uma com “Nova categoria” ou restaure algo da aba
              Arquivadas.
            </p>
          ) : visibleCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma categoria encontrada.
            </p>
          ) : (
            groupedActiveCategories.map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.type} className="mb-4 last:mb-0">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </h4>
                    <div className="grid gap-2">
                      {group.items.map((category) => {
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
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {category.name}
                            </span>
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
                              aria-label={`Arquivar categoria ${category.name}`}
                              title="Arquivar mantém o histórico das transações"
                              onClick={() => archiveCategory(category)}
                            >
                              <Archive aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
            )
          )
        ) : visibleArchivedCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {archivedCategories.length === 0
              ? "Nenhuma categoria arquivada. Arquivar guarda o histórico sem deixar seus lançamentos sem categoria."
              : "Nenhuma categoria arquivada encontrada."}
          </p>
        ) : (
          <div className="grid gap-2">
            {visibleArchivedCategories.map((category) => {
              const count = categoryUsage.get(category.id) ?? 0;
              const hasBudget = spendingBudgets.some(
                (budget) => budget.categoryId === category.id,
              );
              return (
                <div
                  key={category.id}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span aria-hidden="true" className="text-lg">
                    {category.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">
                    {category.name}
                  </span>
                  <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                    {count} {count === 1 ? "transação" : "transações"}
                  </Badge>
                  <span className="sr-only">
                    {count} {count === 1 ? "transação" : "transações"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => restoreCategory(category)}>
                    <ArchiveRestore aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Restaurar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir definitivamente a categoria ${category.name}`}
                    title={
                      count > 0
                        ? "Só é possível excluir categorias sem transações. Arquivada, o histórico continua intacto."
                        : hasBudget
                          ? "Remova os limites mensais dessa categoria antes de excluí-la."
                          : "Excluir definitivamente"
                    }
                    disabled={count > 0 || hasBudget}
                    onClick={() => setDeletingCategory(category)}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
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
      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>
              Dê um nome, um ícone e uma cor fáceis de reconhecer nos seus lançamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
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
            <div>
              <label htmlFor="new-category-type" className="mb-1 block text-sm font-medium">
                Tipo
              </label>
              <select
                id="new-category-type"
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={newCategoryType}
                onChange={(event) => setNewCategoryType(event.target.value as TxType)}
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Ícone</span>
              <EmojiPicker value={icon} onChange={setIcon} label="Ícone da nova categoria" />
            </div>
            <ColorPalette
              value={categoryColor}
              onChange={setCategoryColor}
              label="Cor da nova categoria"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={add} disabled={!name.trim()}>
              Adicionar categoria
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
                      A categoria “{deletingCategory.name}” será excluída permanentemente.
                      {count > 0
                        ? ` Ela está vinculada a ${count} ${
                            count === 1 ? "transação" : "transações"
                          }. Arquivar é mais seguro: o histórico continua intacto.`
                        : " Como não há transações vinculadas, nada mais será afetado. Esta ação não pode ser desfeita."}
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
    </div>
  );
}
