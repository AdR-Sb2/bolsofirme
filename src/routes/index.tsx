import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BolsoFirme — Gestão Financeira" },
      { name: "description", content: "Controle suas finanças pessoais com o BolsoFirme." },
      { property: "og:title", content: "BolsoFirme — Gestão Financeira" },
      { property: "og:description", content: "Controle suas finanças pessoais com o BolsoFirme." },
    ],
  }),
  beforeLoad: () => { throw redirect({ to: "/transacoes" }); },
});
