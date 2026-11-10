import { Link, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BarChart3, Building2, CreditCard, Home, Menu, PanelLeft, PlusCircle, Settings, Upload, Wallet, X, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, UserRound, Settings2 } from "lucide-react";
import { TxDialog } from "@/components/TxDialog";
import type { Tx } from "@/lib/store";
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
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dlg, setDlg] = useState<{ open: boolean; tx?: Tx | null }>({ open: false });
  const [profile, setProfile] = useState<{ name: string; avatar: string; email: string }>({ name: "", avatar: "", email: "" });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const { data } = await supabase.from("user_profiles").select("display_name,avatar_url").eq("user_id", user.id).maybeSingle();
      if (alive) setProfile({ name: data?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Minha conta", avatar: data?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "", email: user.email || "" });
    };
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const initials = profile.name.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BF";
  const signOut = async () => { await supabase.auth.signOut(); window.location.assign("/auth"); };
  const all = [...main, { to: "/configuracoes", label: "Configurações", icon: Settings }];
  const current = all.find((i) => i.to === path)?.label ?? "";
  const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) => (
    <Link to={to as never} onClick={() => setMobile(false)} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent", path === to && "bg-sidebar-accent font-semibold")}>
      <Icon className="h-4 w-4 shrink-0" />{!collapsed && <span>{label}</span>}
    </Link>
  );
  const sidebar = <aside className={cn("flex h-full flex-col gap-6 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground", collapsed ? "w-16" : "w-56")}>
    <div className="flex items-center gap-2 px-1 pt-1"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Wallet className="h-5 w-5" /></div>{!collapsed && <div><div className="font-bold leading-tight">BolsoFirme</div><div className="text-xs text-muted-foreground">Gestão Financeira</div></div>}</div>
    <nav className="grid gap-1">{!collapsed && <p className="px-2 pb-1 text-xs text-muted-foreground">Principal</p>}{main.map((i) => <NavItem key={i.to} {...i} />)}</nav>
    <nav className="grid gap-1">{!collapsed && <p className="px-2 pb-1 text-xs text-muted-foreground">Conta</p>}<NavItem to="/configuracoes" label="Configurações" icon={Settings} /></nav>
  </aside>;
  return <Ctx.Provider value={(tx) => setDlg({ open: true, tx: tx ?? null })}><div className="flex min-h-screen">
    <div className="sticky top-0 hidden h-screen md:block">{sidebar}</div>
    {mobile && <div className="fixed inset-0 z-50 flex bg-background/70 md:hidden" onClick={() => setMobile(false)}><div onClick={(e) => e.stopPropagation()} className="relative">{sidebar}<button className="absolute right-2 top-3" onClick={() => setMobile(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div></div>}
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-14 items-center justify-between border-b border-border px-4"><div className="flex items-center gap-3"><button className="md:hidden" onClick={() => setMobile(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><button className="hidden md:block" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu"><PanelLeft className="h-4 w-4" /></button><h1 className="font-semibold">{current}</h1></div><div className="flex items-center gap-2"><Button size="sm" onClick={() => setDlg({ open: true, tx: null })}><PlusCircle className="h-4 w-4" />Nova transação</Button><DropdownMenu><DropdownMenuTrigger asChild><button aria-label="Abrir menu da conta" className="rounded-full outline-none ring-offset-background transition hover:ring-2 hover:ring-primary hover:ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><Avatar className="h-9 w-9 border border-border"><AvatarImage src={profile.avatar || undefined} alt="Foto do perfil" /><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback></Avatar></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel className="font-normal"><div className="flex flex-col gap-1"><span className="text-sm font-semibold">{profile.name}</span><span className="text-xs text-muted-foreground">{profile.email}</span></div></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => window.location.assign("/configuracoes")}><Settings2 className="h-4 w-4" />Configurações da conta</DropdownMenuItem><DropdownMenuItem onSelect={() => window.location.assign("/configuracoes#perfil")}><UserRound className="h-4 w-4" />Meu perfil e foto</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void signOut()} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4" />Sair da conta</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header><main className="flex-1 p-4 md:p-6">{children}</main></div>
  </div><TxDialog open={dlg.open} tx={dlg.tx} onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))} /></Ctx.Provider>;
}
export function MonthPicker({ date, onChange, prefix = "" }: { date: Date; onChange: (d: Date) => void; prefix?: string }) {
  const shift = (n: number) => onChange(new Date(date.getFullYear(), date.getMonth() + n, 1));
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return <div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Mês anterior">‹</Button><span className="text-lg font-bold capitalize">{prefix}{label}</span><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Próximo mês">›</Button></div>;
}
export function PageTitle({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-muted-foreground">{sub}</p></div>{action}</div>;
}
