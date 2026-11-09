import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { loadUserData, useLoaded } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: Layout,
});

function Layout() {
  const { userId } = Route.useRouteContext();
  const loaded = useLoaded();
  const [error, setError] = useState(false);
  const load = () => { setError(false); loadUserData(userId).catch(() => setError(true)); };
  useEffect(load, [userId]);

  return (
    <AppShell>
      {error ? (
        <div className="py-20 text-center"><p className="mb-3 text-muted-foreground">Não foi possível carregar seus dados.</p><Button onClick={load}>Tentar novamente</Button></div>
      ) : !loaded ? (
        <div className="py-20 text-center text-muted-foreground">Carregando seus dados…</div>
      ) : <Outlet />}
    </AppShell>
  );
}
