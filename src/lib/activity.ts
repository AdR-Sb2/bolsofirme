/**
 * O histórico de atividades é gravado por um trigger no banco. Entradas novas
 * já usam linguagem simples; este normalizador traduz entradas antigas
 * ("Criou transação: Padaria") para a mesma linguagem.
 */

export interface ActivityEntry {
  id: number;
  summary: string;
  action: string | null;
  created_at: string;
}

export type ActivityFilter = "all" | "created" | "updated" | "deleted";

const LEGACY_ENTITIES: Record<
  string,
  { created: (label: string) => string; updated: (label: string) => string; deleted: (label: string) => string }
> = {
  "transação": {
    created: (label) => `Você adicionou uma transação: ${label}`,
    updated: (label) => `Você editou a transação “${label}”`,
    deleted: (label) => `Você excluiu a transação “${label}”`,
  },
  "banco": {
    created: (label) => `Você cadastrou o banco ${label}`,
    updated: (label) => `Você editou o banco ${label}`,
    deleted: (label) => `Você excluiu o banco ${label}`,
  },
  "cartão": {
    created: (label) => `Você cadastrou o cartão ${label}`,
    updated: (label) => `Você editou o cartão ${label}`,
    deleted: (label) => `Você excluiu o cartão ${label}`,
  },
  "categoria": {
    created: (label) => `Você criou a categoria ${label}`,
    updated: (label) => `Você editou a categoria ${label}`,
    deleted: (label) => `Você excluiu a categoria ${label}`,
  },
  "investimento": {
    created: (label) => `Você cadastrou o investimento ${label}`,
    updated: (label) => `Você editou o investimento ${label}`,
    deleted: (label) => `Você excluiu o investimento ${label}`,
  },
  "provento": {
    created: (label) => `Você registrou um provento de ${label}`,
    updated: (label) => `Você editou o provento de ${label}`,
    deleted: (label) => `Você excluiu o provento de ${label}`,
  },
  "planejamento financeiro": {
    created: () => "Você configurou seus limites e metas",
    updated: () => "Você atualizou seus limites e metas",
    deleted: () => "Você removeu seus limites e metas",
  },
};

/** Converte o resumo de uma entrada antiga em linguagem simples. */
export function friendlySummary(raw: string): string {
  const match = /^(Criou|Atualizou|Excluiu)\s+([^:]+):\s*(.+)$/u.exec(raw.trim());
  if (!match) return raw;
  const verb = match[1];
  const style = LEGACY_ENTITIES[match[2]!.trim()];
  if (!style) return raw;
  const label = match[3]!.trim();
  if (verb === "Criou") return style.created(label);
  if (verb === "Atualizou") return style.updated(label);
  return style.deleted(label);
}

/** Rótulo amigável para um dia: Hoje, Ontem ou a data por extenso. */
export function activityDayLabel(iso: string, todayIso: string): string {
  const day = iso.slice(0, 10);
  if (day === todayIso) return "Hoje";
  const yesterday = new Date(`${todayIso}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (day === yesterdayIso) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00`));
}
