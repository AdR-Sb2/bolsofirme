import { Link, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  Home,
  Menu,
  PanelLeft,
  PlusCircle,
  Settings,
  Upload,
  Wallet,
  X,
  TrendingUp,
  Users,
  Search,
  Landmark,
  CreditCard as CardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, UserRound, Settings2 } from "lucide-react";
import { TxDialog } from "@/components/TxDialog";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { applyThemePreference, getThemePreference } from "@/lib/theme";
import { brl, fmtDate, type Tx, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const main = [
  { to: "/transacoes", label: "Transações", icon: Home },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/bancos", label: "Bancos", icon: Building2 },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { to: "/conexoes", label: "Se conectar", icon: Users },
  { to: "/importar", label: "Importar Excel", icon: Upload },
] as const;
const Ctx = createContext<(tx?: Tx | null) => void>(() => {});
export const useTxDialog = () => useContext(Ctx);

export function AppShell({ children }: { children: ReactNode }) {
  const store = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dlg, setDlg] = useState<{ open: boolean; tx?: Tx | null }>({ open: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profile, setProfile] = useState<{ name: string; avatar: string; email: string }>({
    name: "",
    avatar: "",
    email: "",
  });
  const [pendingInvites, setPendingInvites] = useState(0);
  const [invitePreviews, setInvitePreviews] = useState<
    { id: string; name: string; avatar: string }[]
  >([]);
  useEffect(() => {
    applyThemePreference(getThemePreference());
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("display_name,avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (alive)
        setProfile({
          name:
            data?.display_name ||
            user.user_metadata?.["full_name"] ||
            user.user_metadata?.["name"] ||
            user.email?.split("@")[0] ||
            "Minha conta",
          avatar:
            data?.avatar_url ||
            user.user_metadata?.["avatar_url"] ||
            user.user_metadata?.["picture"] ||
            "",
          email: user.email || "",
        });
    };
    void load();
    window.addEventListener("profile-updated", load);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      alive = false;
      window.removeEventListener("profile-updated", load);
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    const refreshInvites = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setPendingInvites(0);
        setInvitePreviews([]);
        return;
      }
      const {
        data: invites,
        count,
        error,
      } = await supabase
        .from("connection_requests")
        .select("id,sender_id", { count: "exact" })
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) {
        console.error("[Invites] Failed to load pending connection invites.", error);
        return;
      }
      const senders = [...new Set((invites ?? []).map((invite) => invite.sender_id))];
      const { data: profiles, error: profilesError } = senders.length
        ? await supabase
            .from("user_profiles")
            .select("user_id,display_name,avatar_url")
            .in("user_id", senders)
        : { data: [], error: null };
      if (profilesError) {
        console.error("[Invites] Failed to load connection invite profiles.", profilesError);
      }
      if (alive) {
        const profileById = new Map((profiles ?? []).map((item) => [item.user_id, item]));
        setPendingInvites(count ?? 0);
        setInvitePreviews(
          (invites ?? []).map((invite) => {
            const sender = profileById.get(invite.sender_id);
            return {
              id: invite.id,
              name: sender?.display_name || "Pessoa usuária",
              avatar: sender?.avatar_url ?? "",
            };
          }),
        );
      }
    };
    void refreshInvites();
    const onFocus = () => {
      void refreshInvites();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("connection-invites-updated", onFocus);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(onFocus);
    const channel = supabase
      .channel("profile-incoming-invites")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        () => {
          void refreshInvites();
        },
      )
      .subscribe();
    const poll = window.setInterval(() => {
      void refreshInvites();
    }, 30000);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("connection-invites-updated", onFocus);
      subscription.unsubscribe();
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, []);
  const initials =
    profile.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BF";
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/auth");
  };
  const all = [...main, { to: "/configuracoes", label: "Configurações", icon: Settings }];
  const current = all.find((i) => i.to === path)?.label ?? "";
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("pt-BR");
  const searchTransactions = normalizedSearch
    ? store.txs
        .filter((transaction) => {
          const category = store.categories.find((item) => item.id === transaction.categoryId)?.name ?? "";
          const institution = transaction.bankId
            ? store.banks.find((item) => item.id === transaction.bankId)?.name ?? ""
            : store.cards.find((item) => item.id === transaction.cardId)?.name ?? "";
          return `${transaction.description} ${category} ${institution} ${transaction.date}`
            .toLocaleLowerCase("pt-BR")
            .includes(normalizedSearch);
        })
        .slice(0, 30)
    : [];
  const searchBanks = normalizedSearch
    ? store.banks.filter((bank) => bank.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    : [];
  const searchCards = normalizedSearch
    ? store.cards.filter((card) =>
        `${card.name} ${card.bank} ${card.brand ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
      )
    : [];
  const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) => (
    <Link
      to={to as never}
      onClick={() => setMobile(false)}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent",
        path === to && "bg-sidebar-accent font-semibold",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col gap-6 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex items-center gap-2 px-1 pt-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold leading-tight">BolsoFirme</div>
            <div className="text-xs text-muted-foreground">Gestão Financeira</div>
          </div>
        )}
      </div>
      <nav className="grid gap-1">
        {!collapsed && <p className="px-2 pb-1 text-xs text-muted-foreground">Principal</p>}
        {main.map((i) => (
          <NavItem key={i.to} {...i} />
        ))}
      </nav>
      <nav className="grid gap-1">
        {!collapsed && <p className="px-2 pb-1 text-xs text-muted-foreground">Conta</p>}
        <NavItem to="/configuracoes" label="Configurações" icon={Settings} />
      </nav>
    </aside>
  );
  return (
    <Ctx.Provider value={(tx) => setDlg({ open: true, tx: tx ?? null })}>
      <div className="flex min-h-screen">
        <div className="sticky top-0 hidden h-screen md:block">{sidebar}</div>
        {mobile && (
          <div
            className="fixed inset-0 z-50 flex bg-background/70 md:hidden"
            onClick={() => setMobile(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="relative">
              {sidebar}
              <button
                className="absolute right-2 top-3"
                onClick={() => setMobile(false)}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-3">
              <button className="md:hidden" onClick={() => setMobile(true)} aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </button>
              <button
                className="hidden md:block"
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Recolher menu"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <h1 className="font-semibold">{current}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="max-w-40 justify-start text-muted-foreground sm:max-w-56"
                onClick={() => setSearchOpen(true)}
                aria-label="Pesquisar em transações, bancos e cartões"
              >
                <Search className="h-4 w-4" />
                <span className="hidden truncate sm:inline">Pesquisar</span>
                <kbd className="ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
                  Ctrl K
                </kbd>
              </Button>
              <Button size="sm" onClick={() => setDlg({ open: true, tx: null })}>
                <PlusCircle className="h-4 w-4" />
                Nova transação
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={
                      pendingInvites
                        ? `Abrir perfil. ${pendingInvites} convites pendentes`
                        : "Abrir menu da conta"
                    }
                    className="relative rounded-full outline-none ring-offset-background transition hover:ring-2 hover:ring-primary hover:ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={profile.avatar || undefined} alt="Foto do perfil" />
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {pendingInvites > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                        {pendingInvites > 9 ? "9+" : pendingInvites}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">{profile.name}</span>
                      <span className="text-xs text-muted-foreground">{profile.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {pendingInvites > 0 && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {pendingInvites === 1
                          ? "Novo convite recebido"
                          : `${pendingInvites} convites recebidos`}
                      </DropdownMenuLabel>
                      {invitePreviews.map((invite) => (
                        <DropdownMenuItem
                          key={invite.id}
                          onSelect={() => window.location.assign("/conexoes#recebidos")}
                          className="gap-2"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={invite.avatar || undefined} alt="" />
                            <AvatarFallback className="text-xs">
                              {invite.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate">{invite.name}</span>
                          <span className="text-xs text-muted-foreground">Convidou você</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        onSelect={() => window.location.assign("/conexoes#recebidos")}
                        className="font-semibold text-primary"
                      >
                        <Users className="h-4 w-4" />
                        Verificar convite{pendingInvites > 1 ? `s (${pendingInvites})` : ""}
                        <span className="ml-auto" aria-hidden="true">
                          →
                        </span>
                      </DropdownMenuItem>
                    </>
                  )}
                  {pendingInvites > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={() => window.location.assign("/configuracoes")}>
                    <Settings2 className="h-4 w-4" />
                    Configurações da conta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => window.location.assign("/configuracoes#perfil")}
                  >
                    <UserRound className="h-4 w-4" />
                    Meu perfil e foto
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair da conta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
      <TxDialog
        open={dlg.open}
        tx={dlg.tx}
        onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))}
      />
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Buscar transações, bancos e cartões..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {normalizedSearch ? "Nenhum resultado encontrado." : "Digite para pesquisar em toda a sua conta."}
          </CommandEmpty>
          <CommandGroup heading="Transações">
            {searchTransactions.map((transaction) => {
              const category = store.categories.find((item) => item.id === transaction.categoryId)?.name ?? "";
              const institution = transaction.bankId
                ? store.banks.find((item) => item.id === transaction.bankId)?.name ?? ""
                : store.cards.find((item) => item.id === transaction.cardId)?.name ?? "";
              return (
                <CommandItem
                  key={`tx-${transaction.id}`}
                  value={`transação ${transaction.description} ${category} ${institution} ${transaction.date}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    setDlg({ open: true, tx: transaction });
                  }}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{transaction.description}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(transaction.date)}</span>
                  <span className="text-xs font-medium">{brl(transaction.amount)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading="Bancos">
            {searchBanks.map((bank) => (
              <CommandItem
                key={`bank-${bank.id}`}
                value={`banco ${bank.name}`}
                onSelect={() => {
                  setSearchOpen(false);
                  window.location.assign("/bancos");
                }}
              >
                <Landmark className="h-4 w-4 text-muted-foreground" />
                {bank.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Cartões">
            {searchCards.map((card) => (
              <CommandItem
                key={`card-${card.id}`}
                value={`cartão ${card.name} ${card.bank} ${card.brand ?? ""}`}
                onSelect={() => {
                  setSearchOpen(false);
                  window.location.assign("/cartoes");
                }}
              >
                <CardIcon className="h-4 w-4 text-muted-foreground" />
                <span>{card.name}</span>
                <span className="text-xs text-muted-foreground">{card.bank}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </Ctx.Provider>
  );
}
export function MonthPicker({
  date,
  onChange,
  prefix = "",
}: {
  date: Date;
  onChange: (d: Date) => void;
  prefix?: string;
}) {
  const shift = (n: number) => onChange(new Date(date.getFullYear(), date.getMonth() + n, 1));
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => shift(-1)}
        aria-label="Mês anterior"
      >
        ‹
      </Button>
      <span className="text-lg font-bold capitalize">
        {prefix}
        {label}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => shift(1)}
        aria-label="Próximo mês"
      >
        ›
      </Button>
    </div>
  );
}
export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
      {action}
    </div>
  );
}
