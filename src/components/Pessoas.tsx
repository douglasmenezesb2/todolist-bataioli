import { useCallback, useEffect, useState } from "react";
import { Mail, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const OWNER = "douglasmenezesb1@gmail.com";
const panel = "rounded-2xl border border-zinc-800 bg-zinc-900";
const field = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-violet-500";

// Tela do dono: quem pode criar conta e ver estoque, mercado e afazeres.
export function Pessoas() {
  const [list, setList] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("allowed_emails").select("email").order("created_at");
    if (error) { toast.error("Não foi possível carregar a lista."); return; }
    setList((data ?? []).map((r) => r.email));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Digite um e-mail válido."); return; }
    if (list.includes(e)) { toast.info("Esse e-mail já está liberado."); return; }
    setBusy(true);
    const { error } = await supabase.from("allowed_emails").insert({ email: e });
    setBusy(false);
    if (error) { toast.error("Não foi possível liberar esse e-mail."); return; }
    setEmail("");
    toast.success("E-mail liberado. A pessoa já pode criar a conta.");
    void load();
  };

  const remove = async (e: string) => {
    if (!confirm(`Remover o acesso de ${e}?`)) return;
    const { error } = await supabase.from("allowed_emails").delete().eq("email", e);
    if (error) { toast.error("Não foi possível remover."); return; }
    void load();
  };

  return (
    <section className={`${panel} a-fade mx-auto max-w-2xl p-5`}>
      <h2 className="mb-1 flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-violet-400" /> E-mails liberados</h2>
      <p className="mb-4 border-b border-zinc-800 pb-4 text-sm text-zinc-400">
        Só esses e-mails conseguem criar conta. Todos veem o mesmo estoque, mercado e afazeres; o ambiente de trabalho é de cada um.
      </p>
      <form onSubmit={(ev) => { ev.preventDefault(); void add(); }} className="mb-4 flex gap-2">
        <input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="email@exemplo.com" className={field} aria-label="E-mail para liberar" />
        <button type="submit" disabled={busy} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Liberar
        </button>
      </form>
      <ul className="space-y-2">
        {list.map((e) => (
          <li key={e} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <span className="flex min-w-0 items-center gap-2 truncate text-sm">
              {e === OWNER ? <ShieldCheck className="h-4 w-4 shrink-0 text-violet-400" /> : <Mail className="h-4 w-4 shrink-0 text-zinc-400" />}
              <span className="truncate">{e}</span>
              {e === OWNER && <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">Dono</span>}
            </span>
            {e !== OWNER && (
              <button onClick={() => void remove(e)} aria-label={`Remover ${e}`} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
