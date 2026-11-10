import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListChecks, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel de Tarefas e Casa" },
      { name: "description", content: "Entre com seu e-mail para acessar suas tarefas e o estoque, mercado e afazeres da casa." },
      { property: "og:title", content: "Entrar — Painel de Tarefas e Casa" },
      { property: "og:description", content: "Entre com seu e-mail para acessar suas tarefas e o estoque, mercado e afazeres da casa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "entrar" | "criar" | "esqueci";

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("email_not_allowed") || m.includes("database error")) return "Este e-mail ainda não foi liberado. Peça para o dono do app liberar o seu acesso.";
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("already registered")) return "Esse e-mail já tem conta. Use Entrar.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere um pouco e tente de novo.";
  return "Não deu certo. Tente de novo.";
}

const field = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-violet-500";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/painel", replace: true }); });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    const mail = email.trim().toLowerCase();
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
        navigate({ to: "/painel", replace: true });
      } else if (mode === "criar") {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel", replace: true });
        else { setInfo("Conta criada! Enviamos um link para o seu e-mail. Clique nele para confirmar e depois entre."); setMode("entrar"); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setInfo("Se esse e-mail tiver conta, enviamos um link para criar uma nova senha.");
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Recuperar senha";

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "#09090b", color: "#f4f4f5", colorScheme: "dark" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 text-white"><ListChecks className="h-6 w-6" /></span>
          <div><div className="text-lg font-bold leading-tight">Minhas tarefas</div><div className="text-xs text-zinc-400">Trabalho, casa e estoque</div></div>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          {mode === "criar" && <p className="text-xs text-zinc-400">Só e-mails liberados pelo dono do app conseguem criar conta.</p>}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">E-mail</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="voce@exemplo.com" />
          </div>
          {mode !== "esqueci" && (
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">Senha</label>
              <input id="password" type="password" required minLength={6} autoComplete={mode === "criar" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </div>
          )}
          {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-sm text-rose-300">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">{info}</p>}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
          </button>
          <div className="flex flex-col gap-2 pt-1 text-center text-sm">
            {mode === "entrar" ? (
              <>
                <button type="button" onClick={() => { setMode("criar"); setError(""); setInfo(""); }} className="text-violet-400 hover:text-violet-300">Primeira vez? Criar conta</button>
                <button type="button" onClick={() => { setMode("esqueci"); setError(""); setInfo(""); }} className="text-zinc-400 hover:text-zinc-200">Esqueci minha senha</button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode("entrar"); setError(""); setInfo(""); }} className="text-violet-400 hover:text-violet-300">Já tenho conta — Entrar</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
