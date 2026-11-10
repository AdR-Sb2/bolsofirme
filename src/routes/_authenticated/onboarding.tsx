import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BANK_CATALOG } from "@/lib/bank-catalog";
import {
  MINIMUM_DEFAULT_CATEGORIES,
  setState,
  uid,
  useStore,
  type Bank,
  type CardC,
  type Category,
  type TxType,
} from "@/lib/store";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configurar carteira — BolsoFirme" },
      { name: "description", content: "Prepare seus bancos, categorias e cartões no BolsoFirme." },
      { property: "og:title", content: "Configurar carteira — BolsoFirme" },
      {
        property: "og:description",
        content: "Prepare seus bancos, categorias e cartões no BolsoFirme.",
      },
    ],
  }),
  component: Onboarding,
});

type DraftCard = {
  id: string;
  bank: string;
  brand: string;
  limit: string;
  closing: string;
  due: string;
};

type CategorySuggestion = Omit<Category, "id"> & { key: string; group: string };
type CustomCategory = Omit<CategorySuggestion, "key" | "group"> & { key: string };
type OnboardingDraft = {
  step: number;
  selectedBanks: string[];
  cards: DraftCard[];
  selectedCategories: string[];
  customCategories: CustomCategory[];
  activeCategoryType: TxType;
  newCategoryName: string;
  newCategoryIcon: string;
  useDefaultCategories: boolean;
};

const BRANDS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard"];
const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const ONBOARDING_STEPS = ["Bancos", "Categorias", "Cartões", "Finalização"];
const STORAGE_KEY = "bolsofirme-onboarding-draft";
const CATEGORY_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
  "#4f46e5",
  "#0f766e",
  "#c026d3",
  "#65a30d",
];
const CATEGORY_EMOJIS = [
  "🏠",
  "💡",
  "🛒",
  "🚗",
  "💊",
  "🍽️",
  "⛽",
  "👕",
  "💅",
  "📺",
  "📱",
  "🎮",
  "🎉",
  "✈️",
  "🏋️",
  "📚",
  "🎁",
  "🐾",
  "💰",
  "💻",
  "🏦",
  "🧾",
];

const CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  {
    key: "despesa:moradia",
    name: "Moradia",
    icon: "🏠",
    color: "#2563eb",
    type: "despesa",
    group: "Essenciais",
  },
  {
    key: "despesa:contas-casa",
    name: "Contas da casa",
    icon: "💡",
    color: "#16a34a",
    type: "despesa",
    group: "Essenciais",
  },
  {
    key: "despesa:mercado",
    name: "Mercado",
    icon: "🛒",
    color: "#ea580c",
    type: "despesa",
    group: "Essenciais",
  },
  {
    key: "despesa:transporte",
    name: "Transporte",
    icon: "🚗",
    color: "#9333ea",
    type: "despesa",
    group: "Essenciais",
  },
  {
    key: "despesa:saude",
    name: "Saúde",
    icon: "💊",
    color: "#db2777",
    type: "despesa",
    group: "Essenciais",
  },
  {
    key: "despesa:restaurantes",
    name: "Restaurantes e delivery",
    icon: "🍽️",
    color: "#0891b2",
    type: "despesa",
    group: "Dia a dia",
  },
  {
    key: "despesa:combustivel",
    name: "Combustível",
    icon: "⛽",
    color: "#ca8a04",
    type: "despesa",
    group: "Dia a dia",
  },
  {
    key: "despesa:farmacia",
    name: "Farmácia",
    icon: "🩹",
    color: "#dc2626",
    type: "despesa",
    group: "Dia a dia",
  },
  {
    key: "despesa:roupas",
    name: "Roupas",
    icon: "👕",
    color: "#4f46e5",
    type: "despesa",
    group: "Dia a dia",
  },
  {
    key: "despesa:beleza",
    name: "Beleza e cuidados",
    icon: "💅",
    color: "#0f766e",
    type: "despesa",
    group: "Dia a dia",
  },
  {
    key: "despesa:streaming",
    name: "Streaming",
    icon: "📺",
    color: "#c026d3",
    type: "despesa",
    group: "Digital e assinaturas",
  },
  {
    key: "despesa:internet-celular",
    name: "Internet e celular",
    icon: "📱",
    color: "#65a30d",
    type: "despesa",
    group: "Digital e assinaturas",
  },
  {
    key: "despesa:apps",
    name: "Apps e assinaturas",
    icon: "🧾",
    color: "#2563eb",
    type: "despesa",
    group: "Digital e assinaturas",
  },
  {
    key: "despesa:jogos",
    name: "Jogos",
    icon: "🎮",
    color: "#16a34a",
    type: "despesa",
    group: "Digital e assinaturas",
  },
  {
    key: "despesa:lazer",
    name: "Lazer",
    icon: "🎉",
    color: "#ea580c",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "despesa:viagens",
    name: "Viagens",
    icon: "✈️",
    color: "#9333ea",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "despesa:academia",
    name: "Academia",
    icon: "🏋️",
    color: "#db2777",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "despesa:educacao",
    name: "Educação e cursos",
    icon: "📚",
    color: "#0891b2",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "despesa:presentes",
    name: "Presentes",
    icon: "🎁",
    color: "#ca8a04",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "despesa:pets",
    name: "Pets",
    icon: "🐾",
    color: "#dc2626",
    type: "despesa",
    group: "Vida e tempo livre",
  },
  {
    key: "receita:salario",
    name: "Salário",
    icon: "💰",
    color: "#2563eb",
    type: "receita",
    group: "Principal",
  },
  {
    key: "receita:freelance",
    name: "Freelance",
    icon: "💻",
    color: "#16a34a",
    type: "receita",
    group: "Principal",
  },
  {
    key: "receita:pro-labore",
    name: "Pró-labore",
    icon: "🏦",
    color: "#ea580c",
    type: "receita",
    group: "Principal",
  },
  {
    key: "receita:investimentos",
    name: "Investimentos (rendimentos)",
    icon: "📈",
    color: "#9333ea",
    type: "receita",
    group: "Outros",
  },
  {
    key: "receita:aluguel",
    name: "Aluguel recebido",
    icon: "🏠",
    color: "#db2777",
    type: "receita",
    group: "Outros",
  },
  {
    key: "receita:vendas",
    name: "Vendas",
    icon: "🛍️",
    color: "#0891b2",
    type: "receita",
    group: "Outros",
  },
  {
    key: "receita:outros",
    name: "Outros rendimentos",
    icon: "💵",
    color: "#ca8a04",
    type: "receita",
    group: "Outros",
  },
];

const SUGGESTED_SELECTION = ["despesa:mercado", "despesa:transporte", "receita:salario"];
const ICON_ONLY_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Mercado", icon: "🛒", color: "#16a34a", type: "despesa" },
  { name: "Salário", icon: "💰", color: "#2563eb", type: "receita" },
];

function readDraft(userId: string): Partial<OnboardingDraft> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return {};
    return value as Partial<OnboardingDraft>;
  } catch (error) {
    console.error("[Onboarding] Could not restore the local setup draft.", error);
    return {};
  }
}

function Onboarding() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const store = useStore();
  const [initialDraft] = useState(() => readDraft(userId));
  const [step, setStep] = useState(() =>
    Number.isInteger(initialDraft.step) ? Math.min(4, Math.max(0, initialDraft.step!)) : 0,
  );
  const [selectedBanks, setSelectedBanks] = useState<string[]>(
    () => initialDraft.selectedBanks ?? [],
  );
  const [cards, setCards] = useState<DraftCard[]>(() => initialDraft.cards ?? []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => initialDraft.selectedCategories ?? SUGGESTED_SELECTION,
  );
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    () => initialDraft.customCategories ?? [],
  );
  const [activeCategoryType, setActiveCategoryType] = useState<TxType>(
    () => initialDraft.activeCategoryType ?? "despesa",
  );
  const [newCategoryType, setNewCategoryType] = useState<TxType>(
    () => initialDraft.activeCategoryType ?? "despesa",
  );
  const [newCategoryName, setNewCategoryName] = useState(() => initialDraft.newCategoryName ?? "");
  const [newCategoryIcon, setNewCategoryIcon] = useState(
    () => initialDraft.newCategoryIcon ?? "🏷️",
  );
  const [useDefaultCategories, setUseDefaultCategories] = useState(
    () => initialDraft.useDefaultCategories ?? false,
  );
  const [saving, setSaving] = useState(false);

  const hasExistingCategories = store.categories.length > 0;
  const progress = Math.min(100, Math.round((step / ONBOARDING_STEPS.length) * 100));
  const categoryCount = (type: TxType) =>
    selectedCategories.filter((key) =>
      CATEGORY_SUGGESTIONS.some((category) => category.key === key && category.type === type),
    ).length + customCategories.filter((category) => category.type === type).length;
  const categoriesForTab = useMemo(
    () => CATEGORY_SUGGESTIONS.filter((category) => category.type === activeCategoryType),
    [activeCategoryType],
  );

  useEffect(() => {
    if (hasExistingCategories && step === 2) setStep(3);
  }, [hasExistingCategories, step]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `${STORAGE_KEY}:${userId}`,
        JSON.stringify({
          step,
          selectedBanks,
          cards,
          selectedCategories,
          customCategories,
          activeCategoryType,
          newCategoryName,
          newCategoryIcon,
          useDefaultCategories,
        } satisfies OnboardingDraft),
      );
    } catch (error) {
      console.error("[Onboarding] Could not save the local setup draft.", error);
    }
  }, [
    activeCategoryType,
    cards,
    customCategories,
    newCategoryIcon,
    newCategoryName,
    selectedBanks,
    selectedCategories,
    step,
    useDefaultCategories,
    userId,
  ]);

  const toggleBank = (name: string) => {
    setSelectedBanks((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };
  const addCard = () =>
    setCards((current) => [
      ...current,
      { id: uid(), bank: selectedBanks[0] ?? "", brand: "Visa", limit: "", closing: "", due: "" },
    ]);
  const updateCard = (index: number, key: keyof DraftCard, value: string) =>
    setCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, [key]: value } : card)),
    );
  const removeCard = (index: number) =>
    setCards((current) => current.filter((_, cardIndex) => cardIndex !== index));

  const toggleSuggestion = (key: string) => {
    setUseDefaultCategories(false);
    setSelectedCategories((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const addCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Digite um nome para sua categoria.");
      return;
    }
    const existing = [...store.categories, ...CATEGORY_SUGGESTIONS, ...customCategories].find(
      (category) => category.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0,
    );
    if (existing) {
      if (existing.type !== newCategoryType) {
        toast.error(
          `“${name}” já existe como ${existing.type === "receita" ? "receita" : "despesa"}.`,
        );
        return;
      }
      if ("key" in existing && CATEGORY_SUGGESTIONS.some((item) => item.key === existing.key)) {
        setActiveCategoryType(newCategoryType);
        setSelectedCategories((current) =>
          current.includes(existing.key) ? current : [...current, existing.key],
        );
        toast.message("Essa sugestão já existe e foi selecionada.");
      } else {
        toast.error("Você já adicionou uma categoria com esse nome.");
      }
      return;
    }
    setCustomCategories((current) => [
      ...current,
      {
        key: `custom:${uid()}`,
        name,
        icon: newCategoryIcon,
        type: newCategoryType,
        color:
          CATEGORY_COLORS[(CATEGORY_SUGGESTIONS.length + current.length) % CATEGORY_COLORS.length]!,
      },
    ]);
    setActiveCategoryType(newCategoryType);
    setNewCategoryName("");
    setNewCategoryIcon("🏷️");
    setUseDefaultCategories(false);
    toast.success("Categoria adicionada.");
  };

  const categoriesToCreate = (): Omit<Category, "id">[] => {
    if (hasExistingCategories) return [];
    if (
      useDefaultCategories ||
      (selectedCategories.length === 0 && customCategories.length === 0)
    ) {
      return MINIMUM_DEFAULT_CATEGORIES;
    }
    const selected = CATEGORY_SUGGESTIONS.filter((category) =>
      selectedCategories.includes(category.key),
    ).map(({ name, icon, color, type }) => ({ name, icon, color, type }));
    return [
      ...selected,
      ...customCategories.map(({ name, icon, color, type }) => ({ name, icon, color, type })),
    ];
  };

  const continueFromCategories = () => {
    if (selectedCategories.length === 0 && customCategories.length === 0) {
      setUseDefaultCategories(true);
      toast.message("Vamos criar algumas categorias padrão para você começar.");
    } else {
      if (categoryCount("despesa") === 0)
        toast.message("Se quiser, inclua ao menos uma categoria de despesa.");
      else if (categoryCount("receita") === 0)
        toast.message("Se quiser, inclua ao menos uma categoria de receita.");
      setUseDefaultCategories(false);
    }
    setStep(3);
  };

  const finish = async () => {
    if (saving) return;
    if (!selectedBanks.length) {
      toast.error("Selecione pelo menos um banco.");
      setStep(1);
      return;
    }
    if (
      cards.some(
        (card) =>
          !card.bank ||
          !selectedBanks.includes(card.bank) ||
          !card.limit ||
          Number(card.limit) <= 0 ||
          !card.closing ||
          Number(card.closing) < 1 ||
          Number(card.closing) > 31 ||
          !card.due ||
          Number(card.due) < 1 ||
          Number(card.due) > 31,
      )
    ) {
      toast.error("Confira os dados dos cartões. Os dias devem ficar entre 1 e 31.");
      setStep(3);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user.");

      const existingBanks = selectedBanks.length
        ? await supabase
            .from("banks")
            .select("id,name")
            .eq("user_id", user.id)
            .in("name", selectedBanks)
        : { data: [], error: null };
      if (existingBanks.error) throw existingBanks.error;
      const existingBankIds = new Map(
        (existingBanks.data ?? []).map((bank) => [bank.name, bank.id]),
      );
      const banks: Bank[] = selectedBanks.flatMap((name) => {
        const catalogBank = BANK_CATALOG.find((item) => item.name === name);
        if (!catalogBank) return [];
        return [
          {
            id: existingBankIds.get(name) ?? uid(),
            name,
            color: catalogBank.color,
            logo: catalogBank.logo,
            kind: "Conta Corrente",
            initial: store.banks.find((bank) => bank.name === name)?.initial ?? 0,
          },
        ];
      });
      const newBanks = banks.filter((bank) => !existingBankIds.has(bank.name));
      if (newBanks.length) {
        const { error } = await supabase.from("banks").upsert(
          newBanks.map((bank) => ({
            id: bank.id,
            user_id: user.id,
            name: bank.name,
            color: bank.color,
            logo: bank.logo ?? "",
            kind: bank.kind,
            initial_cents: bank.initial,
          })),
        );
        if (error) throw error;
      }

      const cardRows: CardC[] = cards.map((card) => ({
        id: card.id,
        name: `${card.bank} • ${card.brand}`,
        bank: card.bank,
        brand: card.brand ?? "",
        color: "#64748b",
        limit: Math.round(Number(card.limit) * 100),
        closing: Number(card.closing),
        due: Number(card.due),
      }));
      if (cardRows.length) {
        const { error } = await supabase.from("cards").upsert(
          cardRows.map((card) => ({
            id: card.id,
            user_id: user.id,
            name: card.name,
            bank: card.bank,
            brand: card.brand ?? "",
            color: card.color,
            limit_cents: card.limit,
            closing_day: card.closing,
            due_day: card.due,
          })),
        );
        if (error) throw error;
      }

      const { data: categoryRows, error: categoryReadError } = await supabase
        .from("categories")
        .select("id,name,icon,color,type")
        .eq("user_id", user.id);
      if (categoryReadError) throw categoryReadError;
      const availableCategories = categoryRows ?? [];
      const desiredCategories = categoriesToCreate();
      const toInsert: Category[] = [];
      for (const category of desiredCategories) {
        const duplicate = availableCategories.find(
          (existing) =>
            existing.name.localeCompare(category.name, "pt-BR", { sensitivity: "base" }) === 0,
        );
        if (duplicate) {
          if (duplicate.type !== category.type) {
            throw new Error(`A categoria "${category.name}" já está cadastrada como outro tipo.`);
          }
          continue;
        }
        const row = { ...category, id: uid() };
        toInsert.push(row);
        availableCategories.push(row);
      }
      if (toInsert.length) {
        const { error } = await supabase.from("categories").upsert(
          toInsert.map((category) => ({
            id: category.id,
            user_id: user.id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            type: category.type,
          })),
        );
        if (error) throw error;
      }

      const { error: settingsError } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        onboarding_complete: true,
        selected_banks: selectedBanks,
      });
      if (settingsError) throw settingsError;

      const savedCategories: Category[] = availableCategories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type === "receita" ? "receita" : "despesa",
      }));
      setState((state) => ({
        ...state,
        banks: [
          ...state.banks.filter((bank) => !banks.some((item) => item.id === bank.id)),
          ...banks,
        ],
        cards: [
          ...state.cards.filter((card) => !cardRows.some((item) => item.id === card.id)),
          ...cardRows,
        ],
        categories: savedCategories,
      }));
      window.localStorage.removeItem(`${STORAGE_KEY}:${user.id}`);
      toast.success("Tudo pronto! Sua carteira foi criada.");
      navigate({ to: "/transacoes" });
    } catch (error) {
      console.error("[Onboarding] Failed to save the setup.", error);
      toast.error("Não foi possível salvar agora. Suas escolhas foram mantidas; tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const nextFromBanks = () => {
    if (!selectedBanks.length) {
      toast.error("Escolha pelo menos um banco para continuar.");
      return;
    }
    setStep(hasExistingCategories ? 3 : 2);
  };

  const next = () => setStep((current) => Math.min(4, current + 1));

  const changeTabByKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    event.preventDefault();
    const type: TxType =
      event.key === "Home"
        ? "despesa"
        : event.key === "End"
          ? "receita"
          : activeCategoryType === "despesa"
            ? "receita"
            : "despesa";
    setActiveCategoryType(type);
    document.getElementById(`category-tab-${type}`)?.focus();
  };

  const categoryGroups = [...new Set(categoriesForTab.map((category) => category.group))];
  const chosenNames = categoriesToCreate();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold leading-tight tracking-tight">BolsoFirme</div>
            <div className="text-xs text-muted-foreground">Sua vida financeira em equilíbrio</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Configuração segura
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-6xl items-center gap-8 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
        <section className="mx-auto w-full max-w-3xl">
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {step === 0 ? "SEJA BEM-VINDO" : `ETAPA ${step} DE ${ONBOARDING_STEPS.length}`}
              </span>
              <span>{progress}% concluído</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {step > 0 && (
              <div className="mt-4 flex items-center gap-2">
                {ONBOARDING_STEPS.map((title, index) => {
                  const stepNumber = index + 1;
                  return (
                    <div key={title} className="flex flex-1 items-center gap-2">
                      <div
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step > stepNumber ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                      >
                        {step > stepNumber ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                      </div>
                      <span
                        className={`hidden text-xs sm:inline ${step === stepNumber ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {title}
                      </span>
                      {index < ONBOARDING_STEPS.length - 1 && (
                        <div className="h-px flex-1 bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {step === 0 && (
            <div className="py-5 sm:py-10">
              <div className="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary">
                Vamos começar
              </p>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
                Organize seu dinheiro. <span className="text-primary">Conquiste seus planos.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Em poucos passos, vamos preparar seu espaço financeiro. Escolha seus bancos e, se
                quiser, cadastre categorias e cartões. Você pode ajustar tudo depois.
              </p>
              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: Building2,
                    title: "Seus bancos",
                    desc: "Reúna suas contas em um só lugar.",
                  },
                  {
                    icon: ShoppingBasket,
                    title: "Suas categorias",
                    desc: "Organize ganhos e gastos desde o início.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Seus dados",
                    desc: "Suas informações ficam privadas.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-card p-4">
                    <item.icon className="mb-3 h-5 w-5 text-primary" />
                    <div className="text-sm font-semibold">{item.title}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <Button
                className="mt-9 h-12 w-full rounded-xl text-sm sm:w-auto sm:min-w-52"
                onClick={next}
              >
                Configurar minha carteira <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="mb-6">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Building2 className="h-3.5 w-3.5" /> Etapa 1 · Bancos
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Quais bancos você usa?
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Selecione suas instituições. Não precisa conectar suas senhas.
                </p>
              </div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium">Instituições disponíveis</span>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  {selectedBanks.length} selecionado(s) · mínimo 1
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BANK_CATALOG.map(({ name, color, logo }) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => toggleBank(name)}
                    aria-pressed={selectedBanks.includes(name)}
                    className={`group flex min-h-[62px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all hover:border-primary/60 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedBanks.includes(name) ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-card"}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background">
                      <img
                        src={logo}
                        alt={`Logo ${name}`}
                        className="h-6 w-6 rounded object-contain"
                      />
                      <span
                        className="hidden h-2.5 w-2.5 rounded-full"
                        style={{ background: color }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    {selectedBanks.includes(name) && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Você poderá adicionar ou remover bancos depois.
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => setSelectedBanks(BANK_CATALOG.map(({ name }) => name))}
                >
                  Selecionar todos
                </button>
              </div>
              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  className="h-11 min-w-36 rounded-xl"
                  disabled={!selectedBanks.length}
                  onClick={nextFromBanks}
                >
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && !hasExistingCategories && (
            <div>
              <div className="mb-6">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <ShoppingBasket className="h-3.5 w-3.5" /> Etapa 2 · Categorias
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  O que faz parte do seu dia a dia?
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Isso ajuda a organizar seus gastos e ganhos desde o primeiro lançamento. Você pode
                  mudar depois.
                </p>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                <span className="text-sm font-medium">Escolha rápida</span>
                <span className="text-xs text-muted-foreground">
                  {categoryCount(activeCategoryType)} selecionada(s)
                </span>
              </div>
              <div
                role="tablist"
                aria-label="Tipo de categoria"
                onKeyDown={changeTabByKeyboard}
                className="mb-5 grid grid-cols-2 gap-2"
              >
                {(["despesa", "receita"] as const).map((type) => (
                  <button
                    id={`category-tab-${type}`}
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={activeCategoryType === type}
                    aria-controls="category-panel"
                    tabIndex={activeCategoryType === type ? 0 : -1}
                    onClick={() => {
                      setActiveCategoryType(type);
                      setNewCategoryType(type);
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCategoryType === type ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
                  >
                    {type === "despesa" ? "Despesas" : "Receitas"} ({categoryCount(type)})
                  </button>
                ))}
              </div>
              <div
                id="category-panel"
                role="tabpanel"
                aria-labelledby={`category-tab-${activeCategoryType}`}
              >
                <div className="max-h-[42vh] space-y-5 overflow-y-auto pr-1">
                  {categoryGroups.map((group) => (
                    <section key={group} aria-label={group}>
                      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group}
                      </h2>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {categoriesForTab
                          .filter((category) => category.group === group)
                          .map((category) => {
                            const selected = selectedCategories.includes(category.key);
                            return (
                              <button
                                key={category.key}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleSuggestion(category.key)}
                                className={`relative flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-card"}`}
                              >
                                {selected && (
                                  <CheckCircle2
                                    aria-hidden="true"
                                    className="absolute right-2 top-2 h-4 w-4 text-primary"
                                  />
                                )}
                                <span aria-hidden="true" className="text-3xl">
                                  {category.icon}
                                </span>
                                <span className="text-xs font-medium leading-tight">
                                  {category.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </section>
                  ))}
                  {customCategories.some((category) => category.type === activeCategoryType) && (
                    <section aria-label="Categorias próprias">
                      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Suas categorias
                      </h2>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {customCategories
                          .filter((category) => category.type === activeCategoryType)
                          .map((category) => (
                            <div
                              key={category.key}
                              className="relative flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-center"
                            >
                              <button
                                type="button"
                                aria-label={`Remover categoria ${category.name}`}
                                onClick={() =>
                                  setCustomCategories((items) =>
                                    items.filter((item) => item.key !== category.key),
                                  )
                                }
                                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <span aria-hidden="true" className="text-3xl">
                                {category.icon}
                              </span>
                              <span className="text-xs font-medium leading-tight">
                                {category.name}
                              </span>
                            </div>
                          ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Quer adicionar uma categoria?</h2>
                <div className="mb-3 flex gap-2">
                  {(["despesa", "receita"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={newCategoryType === type ? "default" : "outline"}
                      aria-pressed={newCategoryType === type}
                      onClick={() => setNewCategoryType(type)}
                    >
                      {type === "despesa" ? "Despesa" : "Receita"}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Input
                    aria-label="Nome da categoria própria"
                    placeholder="Nome da categoria"
                    value={newCategoryName}
                    maxLength={40}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addCustomCategory();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Escolher ícone, atual ${newCategoryIcon}`}
                    onClick={() => {
                      const current = CATEGORY_EMOJIS.indexOf(newCategoryIcon);
                      setNewCategoryIcon(CATEGORY_EMOJIS[(current + 1) % CATEGORY_EMOJIS.length]!);
                    }}
                  >
                    <span aria-hidden="true" className="mr-2 text-lg">
                      {newCategoryIcon}
                    </span>
                    Trocar ícone
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Escolha visual de ícone">
                  {CATEGORY_EMOJIS.slice(0, 12).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Selecionar ícone ${emoji}`}
                      aria-pressed={newCategoryIcon === emoji}
                      onClick={() => setNewCategoryIcon(emoji)}
                      className={`grid h-9 w-9 place-items-center rounded-lg border text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${newCategoryIcon === emoji ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <Button type="button" className="mt-3" onClick={addCustomCategory}>
                  Adicionar categoria
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setUseDefaultCategories(true);
                      setStep(3);
                    }}
                  >
                    Pular por enquanto
                  </Button>
                  <Button className="h-11 min-w-36 rounded-xl" onClick={continueFromCategories}>
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
              {useDefaultCategories && (
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Vamos criar categorias padrão de despesa e receita para você começar.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-6">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <CreditCard className="h-3.5 w-3.5" /> Etapa 3 · Cartões
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">E seus cartões?</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cadastre cartões para acompanhar limites e vencimentos. Esta etapa é opcional.
                </p>
              </div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Cartões de crédito</span>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={addCard}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar cartão
                </Button>
              </div>
              {cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">Nenhum cartão por enquanto</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Sem problemas! Você pode cadastrar seus cartões a qualquer momento.
                  </p>
                  <Button variant="outline" className="mt-5 rounded-xl" onClick={addCard}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar meu primeiro cartão
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {cards.map((card, index) => (
                    <div
                      key={card.id}
                      className="relative rounded-2xl border border-border bg-card p-4 sm:p-5"
                    >
                      <button
                        type="button"
                        onClick={() => removeCard(index)}
                        aria-label={`Remover cartão ${index + 1}`}
                        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Cartão {index + 1}</p>
                          <p className="text-xs text-muted-foreground">Informações do cartão</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                          Banco
                          <select
                            className={FIELD_CLASS}
                            value={card.bank}
                            onChange={(event) => updateCard(index, "bank", event.target.value)}
                          >
                            <option value="">Selecione o banco</option>
                            {selectedBanks.map((bank) => (
                              <option key={bank}>{bank}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                          Bandeira
                          <select
                            className={FIELD_CLASS}
                            value={card.brand}
                            onChange={(event) => updateCard(index, "brand", event.target.value)}
                          >
                            {BRANDS.map((brand) => (
                              <option key={brand}>{brand}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                          Limite (R$)
                          <Input
                            className="h-11 rounded-xl"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Ex.: 5000,00"
                            value={card.limit}
                            onChange={(event) => updateCard(index, "limit", event.target.value)}
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                            Fecha dia
                            <Input
                              className="h-11 rounded-xl"
                              type="number"
                              min="1"
                              max="31"
                              placeholder="Dia"
                              value={card.closing}
                              onChange={(event) => updateCard(index, "closing", event.target.value)}
                            />
                          </label>
                          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                            Vence dia
                            <Input
                              className="h-11 rounded-xl"
                              type="number"
                              min="1"
                              max="31"
                              placeholder="Dia"
                              value={card.due}
                              onChange={(event) => updateCard(index, "due", event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {hasExistingCategories && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Sua conta já tem categorias; elas foram mantidas.
                </p>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(hasExistingCategories ? 1 : 2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setStep(4)}>
                    Fazer depois
                  </Button>
                  <Button className="h-11 min-w-36 rounded-xl" onClick={next}>
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="py-4 sm:py-8">
              <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[.16em] text-emerald-500">
                Tudo pronto
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Sua carteira está quase pronta!
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Confira seu resumo. Ao concluir, você poderá começar a organizar suas finanças.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    Bancos selecionados
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedBanks.map((name) => (
                      <span key={name} className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedBanks.length} instituição(ões)
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShoppingBasket className="h-4 w-4 text-primary" />
                    Categorias escolhidas
                  </div>
                  <p className="text-3xl font-bold">
                    {hasExistingCategories ? store.categories.length : chosenNames.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasExistingCategories
                      ? "Categorias existentes mantidas."
                      : `${categoryCount("despesa")} despesas · ${categoryCount("receita")} receitas`}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 sm:col-span-2">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Cartões cadastrados
                  </div>
                  <p className="text-3xl font-bold">{cards.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cards.length === 0
                      ? "Você poderá adicionar depois."
                      : cards.length === 1
                        ? "Cartão de crédito"
                        : "Cartões de crédito"}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-primary/5 p-4 text-sm">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="leading-6 text-muted-foreground">
                  Seus dados financeiros são privados. Nada será compartilhado com outras pessoas
                  sem sua autorização.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  className="h-12 min-w-48 rounded-xl"
                  disabled={saving}
                  onClick={() => void finish()}
                >
                  {saving ? "Preparando sua carteira..." : "Concluir e entrar"}{" "}
                  <Check className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
        <aside className="hidden lg:block">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-7">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="text-lg font-bold leading-snug">Clareza hoje. Tranquilidade amanhã.</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tenha suas contas, categorias, cartões e investimentos organizados em um só lugar.
              </p>
              <div className="my-7 h-px bg-border" />
              <div className="grid gap-4">
                {[
                  "Acompanhe para onde seu dinheiro vai",
                  "Planeje seus próximos objetivos",
                  "Tenha controle sem complicação",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Leva menos de 2 minutos para configurar.
          </p>
        </aside>
      </main>
    </div>
  );
}
