import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Entrada: quem já entrou vai para o painel; quem não entrou vai para o login.
export const Route = createFileRoute("/")({
  ssr: false,
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
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/painel" : "/auth", replace: true });
  },
  component: () => <div className="min-h-screen bg-background" />,
});
