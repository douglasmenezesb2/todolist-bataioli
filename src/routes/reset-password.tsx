import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Painel de Tarefas e Casa" },
      { name: "description", content: "Crie uma nova senha para acessar o seu painel." },
      { property: "og:title", content: "Nova senha — Painel de Tarefas e Casa" },
      { property: "og:description", content: "Crie uma nova senha para acessar o seu painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError("Não foi possível trocar a senha. Abra o link do e-mail de novo."); return; }
    navigate({ to: "/painel", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "#09090b", color: "#f4f4f5", colorScheme: "dark" }}>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="flex items-center gap-2 text-xl font-bold"><KeyRound className="h-5 w-5 text-violet-400" /> Nova senha</h1>
        <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres" aria-label="Nova senha" className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-500" />
        {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-sm text-rose-300">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">Salvar nova senha</button>
      </form>
    </div>
  );
}
