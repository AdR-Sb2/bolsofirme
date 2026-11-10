import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Wallet, Mail, Lock, Eye, EyeOff, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — BolsoFirme" }, { name: "description", content: "Acesse ou crie sua conta do BolsoFirme." }, { property: "og:title", content: "Entrar — BolsoFirme" }, { property: "og:description", content: "Acesse ou crie sua conta do BolsoFirme." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/transacoes" }); });
  }, [nav]);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) { toast.error("Informe seu e-mail e sua senha."); return; }
    if (mode === "signup") {
      if (name.trim().length < 2) { toast.error("Informe seu nome."); return; }
      if (password.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
      if (password !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim(), name: name.trim() },
          },
        });
        if (error) throw error;
        if (data.session) nav({ to: "/transacoes" });
        else toast.success("Cadastro iniciado! Confira seu e-mail para confirmar a conta.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        nav({ to: "/transacoes" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir o acesso.";
      toast.error(message.includes("already registered") ? "Este e-mail já possui cadastro. Entre na sua conta." : message);
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Supabase redirects the browser to Google and returns to /auth.
      // The auth client exchanges the callback code and restores the session.
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar com o Google.";
      toast.error(message);
      setBusy(false);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-background p-4">
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-xl shadow-black/10 sm:p-8">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet className="h-7 w-7" /></div>
      <h1 className="text-2xl font-extrabold">BolsoFirme</h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">Sua vida financeira sob controle.</p>

      <div className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1">
        <button type="button" onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Entrar</button>
        <button type="button" onClick={() => setMode("signup")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Criar conta</button>
      </div>

      <form onSubmit={submitEmail} className="space-y-4 text-left">
        {mode === "signup" && <div className="space-y-2"><Label htmlFor="name">Nome completo</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="name" autoComplete="name" className="pl-9" placeholder="Como podemos te chamar?" value={name} onChange={e => setName(e.target.value)} required /></div></div>}
        <div className="space-y-2"><Label htmlFor="email">E-mail</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="email" type="email" autoComplete="email" className="pl-9" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div></div>
        <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="pl-9 pr-10" placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "Sua senha"} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : 1}/><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3 text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>
        {mode === "signup" && <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite a senha novamente" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8}/></div>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : "Entrar com e-mail"}</Button>
      </form>

      <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border"/><span className="text-xs text-muted-foreground">ou</span><div className="h-px flex-1 bg-border"/></div>
      <Button variant="outline" className="h-11 w-full" onClick={signInGoogle} disabled={busy}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.2c1.6-4.7 6-8.1 11.2-8.1z"/></svg>
        Continuar com Google
      </Button>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">{mode === "signup" ? "Ao criar sua conta, você concorda em usar o BolsoFirme para organizar suas finanças." : "Entre para acessar sua carteira financeira com segurança."}</p>
    </section>
  </main>;
}
