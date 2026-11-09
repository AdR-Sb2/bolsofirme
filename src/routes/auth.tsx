import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — BolsoFirme" }, { name: "description", content: "Acesse sua conta do BolsoFirme." }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/transacoes" }); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (session) nav({ to: "/transacoes" }); });
    return () => data.subscription.unsubscribe();
  }, [nav]);
  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { toast.error("Não foi possível entrar com o Google."); setBusy(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-background p-4">
    <section className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet className="h-7 w-7" /></div>
      <h1 className="text-2xl font-extrabold">BolsoFirme</h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">Sua vida financeira sob controle.</p>
      <Button className="h-11 w-full" onClick={signIn} disabled={busy}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.2c1.6-4.7 6-8.1 11.2-8.1z"/></svg>
        {busy ? "Conectando..." : "Continuar com Google"}
      </Button>
      <p className="mt-5 text-xs text-muted-foreground">Ao continuar, você concorda em usar o BolsoFirme para organizar suas finanças.</p>
    </section>
  </main>;
}
