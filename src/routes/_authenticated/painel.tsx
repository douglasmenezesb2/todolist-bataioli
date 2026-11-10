import { createFileRoute } from "@tanstack/react-router";
import Painel from "@/components/Painel";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Tarefas, Estoque e Mercado" },
      { name: "description", content: "Seu ambiente de trabalho e o estoque, mercado e afazeres compartilhados da casa." },
      { property: "og:title", content: "Painel — Tarefas, Estoque e Mercado" },
      { property: "og:description", content: "Seu ambiente de trabalho e o estoque, mercado e afazeres compartilhados da casa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});
