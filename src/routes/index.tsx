import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import Painel from "@/components/Painel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Tarefas, Estoque e Mercado" },
      { name: "description", content: "Organize tarefas, lembretes, estoque da casa, validades e lista de mercado em um só lugar." },
      { property: "og:title", content: "Painel — Tarefas, Estoque e Mercado" },
      { property: "og:description", content: "Organize tarefas, lembretes, estoque da casa, validades e lista de mercado em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// Os dados ficam salvos no navegador, então a tela só é montada no cliente.
function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-background" />}>
      <Painel />
    </ClientOnly>
  );
}
