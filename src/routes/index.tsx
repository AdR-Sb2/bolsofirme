import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BolsoFirme — Gestão Financeira" },
      { name: "description", content: "Controle suas finanças pessoais com o BolsoFirme." },
      { property: "og:title", content: "BolsoFirme — Gestão Financeira" },
      { property: "og:description", content: "Controle suas finanças pessoais com o BolsoFirme." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  beforeLoad: () => { throw redirect({ to: "/transacoes" }); },
});
