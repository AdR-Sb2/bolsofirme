import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  activityDayLabel,
  friendlySummary,
  type ActivityEntry,
  type ActivityFilter,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/atividade")({
  head: () => ({
    meta: [
      { title: "Atividade — BolsoFirme" },
      {
        name: "description",
        content: "O que aconteceu na sua conta, em linguagem simples.",
      },
      { property: "og:title", content: "Atividade — BolsoFirme" },
      {
        property: "og:description",
        content: "O que aconteceu na sua conta, em linguagem simples.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AtividadePage,
});

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "created", label: "Criações" },
  { value: "updated", label: "Edições" },
  { value: "deleted", label: "Exclusões" },
];

function AtividadePage() {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityReady, setActivityReady] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_log")
          .select("id,summary,action,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
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

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const visible = useMemo(
    () =>
      activity
        .filter((item) => (filter === "all" ? true : item.action === filter))
        .filter((item) =>
          query ? friendlySummary(item.summary).toLocaleLowerCase("pt-BR").includes(query) : true,
        ),
    [activity, filter, query],
  );
  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const item of visible) {
      const key = item.created_at.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="max-w-3xl space-y-5">
      <PageTitle
        title="Atividade"
        sub="Tudo que aconteceu na sua conta, em linguagem simples"
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              aria-label="Buscar no histórico de atividades"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar atividade"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por tipo">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? "default" : "outline"}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(filter !== option.value && "text-muted-foreground")}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        {activityError ? (
          <p role="status" className="text-sm text-muted-foreground">
            Histórico indisponível no momento. Tente novamente em alguns minutos.
          </p>
        ) : !activityReady ? (
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">
              {query || filter !== "all"
                ? "Nenhuma atividade encontrada."
                : "Nada por aqui ainda"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query || filter !== "all"
                ? "Tente outra busca ou mude o filtro."
                : "Suas próximas alterações financeiras aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([day, items]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {activityDayLabel(items[0]!.created_at, todayIso)}
                </h3>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 border-b border-border py-2.5 last:border-0"
                    >
                      <span className="min-w-0 flex-1 text-sm">
                        {friendlySummary(item.summary)}
                      </span>
                      <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.created_at))}
                      </time>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
