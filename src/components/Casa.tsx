import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Brush, CalendarDays, Check, Droplets, Home, Minus, Package,
  PawPrint, Pencil, Plus, Search, ShoppingCart, Sparkles, Trash2, TrendingDown, Utensils, X,
} from "lucide-react";

export type CatId = "m" | "c" | "l" | "h" | "p";
export type StockItem = { id: string; name: string; qty: number; note: string; expiry: string; cat: CatId };
export type ShopItem = { id: string; name: string; done: boolean; stockId?: string };
type Level = "out" | "low" | "mid" | "ok";
type Draft = Omit<StockItem, "id">;

export const CATS: Record<CatId, { name: string; Icon: LucideIcon; cls: string }> = {
  m: { name: "Mercearia", Icon: Utensils, cls: "bg-orange-600" },
  c: { name: "Casa", Icon: Home, cls: "bg-sky-600" },
  l: { name: "Limpeza", Icon: Brush, cls: "bg-cyan-600" },
  h: { name: "Higiene", Icon: Droplets, cls: "bg-pink-600" },
  p: { name: "Pet", Icon: PawPrint, cls: "bg-emerald-600" },
};
const ORDER: CatId[] = ["m", "c", "l", "h", "p"];
const NOTES = ["Fechado", "Aberto", "Cheio", "Metade", "3/4", "2/3", "1/3", "Acabando"];

// Estoque inicial (importado do seu PDF)
const RAW: [string, number, string, string, CatId][] = [
  ["Nescau lata", 1, "2/3", "2026-05-01", "m"], ["Leite em pó", 1, "Acabando", "2027-04-14", "m"],
  ["Leite condensado", 2, "1 Aberto", "", "m"], ["Creme de leite", 3, "", "", "m"],
  ["Batata palha", 2, "Fechado", "", "m"], ["Fermento pão", 2, "Fechado", "2027-01-23", "m"],
  ["Massa", 2, "", "", "m"], ["Chá preto", 4, "Fechado", "", "m"], ["Café", 2, "Fechado", "", "m"],
  ["Amido de milho", 1, "Acabando", "2027-07-02", "m"], ["Fermento", 2, "4 Fechado", "2027-06-01", "m"],
  ["Maionese", 0, "", "", "m"], ["Milho para pipoca", 1, "Fechado", "2027-02-06", "m"],
  ["Sal grosso", 2, "1 Fechado", "2027-11-01", "m"], ["Erva-mate", 1, "Fechado", "", "m"],
  ["Polenta", 1, "Fechado", "2026-11-01", "m"], ["Feijão", 1, "3/4", "", "m"], ["Arroz", 0, "", "", "m"],
  ["Óleo de soja", 1, "Cheio", "", "m"], ["Azeite", 1, "Cheio", "", "m"], ["Vinagre", 1, "1/3", "", "m"],
  ["Molho shoyu", 1, "Metade", "2027-01-01", "m"], ["Farinha", 1, "Fechado", "", "m"],
  ["Aveia", 1, "Metade", "", "m"], ["Magic Toast", 0, "", "", "m"], ["Sal", 1, "Metade", "", "m"],
  ["Pão", 1, "Acabando", "", "m"], ["Ketchup", 1, "Aberto", "", "m"], ["Iogurte", 0, "", "", "m"],
  ["Papel filme", 2, "1 Fechado", "", "c"], ["Papel alumínio", 1, "Aberto", "", "c"],
  ["Filtro de café", 1, "Acabando", "", "c"], ["Papel toalha", 2, "", "", "c"],
  ["Superbonder", 0, "", "", "c"], ["Lixo pia", 0, "", "", "c"], ["Lixo cozinha", 1, "", "", "c"],
  ["Tapete Polar", 1, "", "", "c"],
  ["Detergente", 1, "", "", "l"], ["Lava-roupas", 1, "", "", "l"], ["Álcool", 1, "", "", "l"],
  ["Desinfetante Veja", 1, "", "", "l"], ["Esponja Banho", 1, "", "", "l"],
  ["Sabonete", 2, "", "", "h"], ["Shampoo", 1, "", "", "h"], ["Condicionador", 1, "", "", "h"],
  ["Sachê cachorro", 2, "Fechado", "2028-01-01", "p"], ["Ração", 1, "", "", "p"],
];
const SEED: StockItem[] = RAW.map(([name, qty, note, expiry, cat], i) => ({ id: `s${i}`, name, qty, note, expiry, cat }));

function load<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const fmt = (k: string) => k.split("-").reverse().join("/");

// ---- Leitura automática: interpreta quantidade + observação ----
export function level(s: StockItem): Level {
  if (s.qty <= 0) return "out";
  if (s.qty >= 2) return "ok";
  const n = s.note.toLowerCase();
  if (/acabando|pouco|quase/.test(n)) return "low";
  const f = n.match(/(\d+)\s*\/\s*(\d+)/);
  if (f) { const r = +f[1] / +f[2]; return r <= 0.34 ? "low" : r <= 0.67 ? "mid" : "ok"; }
  if (/metade/.test(n)) return "mid";
  return "ok";
}
const needsBuy = (s: StockItem) => level(s) === "out" || level(s) === "low";
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const expDays = (s: StockItem) => (s.expiry ? Math.round((new Date(`${s.expiry}T00:00`).getTime() - today0()) / 86400e3) : null);
const LV: Record<Level, { t: string; cls: string }> = {
  out: { t: "Acabou", cls: "bg-rose-600 text-white" },
  low: { t: "Acabando", cls: "bg-amber-500 text-zinc-950" },
  mid: { t: "Metade", cls: "bg-sky-600 text-white" },
  ok: { t: "OK", cls: "bg-emerald-700 text-white" },
};
const expChip = (s: StockItem) => {
  const d = expDays(s);
  if (d === null) return null;
  if (d < 0) return { t: `Vencido há ${-d}d`, cls: "bg-rose-600 text-white" };
  if (d <= 30) return { t: d === 0 ? "Vence hoje" : `Vence em ${d}d`, cls: "bg-amber-500 text-zinc-950" };
  return { t: fmt(s.expiry), cls: "bg-zinc-900 text-zinc-300" };
};

const panel = "rounded-2xl border border-zinc-800 bg-zinc-900";
const field = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-violet-500 [color-scheme:dark]";
const lbl = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400";

export function useCasa() {
  const [stock, setStock] = useState<StockItem[]>(() => load("stock-v1", SEED));
  const [shop, setShop] = useState<ShopItem[]>(() => load("shop-v1", []));
  const [auto, setAuto] = useState<boolean>(() => load("shop-auto", true));
  const [skip, setSkip] = useState<string[]>(() => load("shop-skip", []));
  const [modal, setModal] = useState<{ id: string | null; f: Draft } | null>(null);

  useEffect(() => save("stock-v1", stock), [stock]);
  useEffect(() => save("shop-v1", shop), [shop]);
  useEffect(() => save("shop-auto", auto), [auto]);
  useEffect(() => save("shop-skip", skip), [skip]);

  // A leitura roda sempre que o estoque muda: o que acabou/está acabando entra na lista
  useEffect(() => {
    const still = skip.filter((id) => { const s = stock.find((x) => x.id === id); return !!s && needsBuy(s); });
    if (still.length !== skip.length) setSkip(still);
    if (!auto) return;
    const add = stock.filter((s) => needsBuy(s) && !shop.some((x) => x.stockId === s.id) && !skip.includes(s.id));
    if (add.length) setShop((p) => [...p, ...add.map((s) => ({ id: uid(), name: s.name, done: false, stockId: s.id }))]);
  }, [stock, shop, auto, skip]);

  const suggestions = stock.filter((s) => needsBuy(s) && !shop.some((x) => x.stockId === s.id));

  const addShop = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const st = stock.find((s) => norm(s.name) === norm(n));
    if (shop.some((x) => norm(x.name) === norm(st ? st.name : n))) return;
    if (st) setSkip((k) => k.filter((i) => i !== st.id));
    setShop((p) => [...p, { id: uid(), name: st ? st.name : n, done: false, stockId: st?.id }]);
  };
  const toggleShop = (id: string) => setShop((p) => p.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const removeShop = (id: string) => {
    const it = shop.find((x) => x.id === id);
    const s = it?.stockId ? stock.find((x) => x.id === it.stockId) : undefined;
    if (s && needsBuy(s)) setSkip((k) => [...k, s.id]);
    setShop((p) => p.filter((x) => x.id !== id));
  };
  const finishBuy = () => {
    const bought = shop.filter((s) => s.done);
    setStock((st) => st.map((it) => {
      if (!bought.some((b) => b.stockId === it.id)) return it;
      return { ...it, qty: it.qty + 1, note: it.qty <= 0 || /acabando/i.test(it.note) ? "Fechado" : it.note };
    }));
    setShop((p) => p.filter((x) => !x.done));
  };
  const setQty = (id: string, d: number) => setStock((st) => st.map((x) => (x.id === id ? { ...x, qty: Math.max(0, x.qty + d) } : x)));
  const removeItem = (id: string) => {
    if (!confirm("Remover este item do estoque?")) return;
    setStock((st) => st.filter((x) => x.id !== id));
    setShop((p) => p.filter((x) => x.stockId !== id));
  };
  const openItem = (s?: StockItem) =>
    setModal({ id: s?.id ?? null, f: s ? { name: s.name, qty: s.qty, note: s.note, expiry: s.expiry, cat: s.cat } : { name: "", qty: 1, note: "Fechado", expiry: "", cat: "m" } });
  const saveItem = () => {
    if (!modal || !modal.f.name.trim()) return;
    const f = { ...modal.f, name: modal.f.name.trim() };
    setStock((st) => (modal.id ? st.map((x) => (x.id === modal.id ? { ...f, id: x.id } : x)) : [...st, { ...f, id: uid() }]));
    setModal(null);
  };

  return { stock, shop, auto, setAuto, suggestions, modal, setModal, addShop, toggleShop, removeShop, finishBuy, setQty, removeItem, openItem, saveItem };
}
export type Casa = ReturnType<typeof useCasa>;

/* ===================== MERCADO ===================== */
export function Mercado({ casa }: { casa: Casa }) {
  const { shop, stock, auto, setAuto, suggestions, addShop, toggleShop, removeShop, finishBuy } = casa;
  const [txt, setTxt] = useState("");
  const out = stock.filter((s) => level(s) === "out").length;
  const low = stock.filter((s) => level(s) === "low").length;
  const cart = shop.filter((s) => s.done).length;
  const sorted = [...shop].sort((a, b) => Number(a.done) - Number(b.done));
  const add = () => { addShop(txt); setTxt(""); };

  return (
    <div className="a-fade mx-auto max-w-3xl space-y-5">
      <section className={`${panel} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-violet-600 p-2.5 text-white"><Sparkles className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold">Leitura automática do estoque</h2>
              <p className="mt-0.5 text-sm text-zinc-400">
                {out + low === 0 ? "Tudo certo: nada acabando." : `Li seu estoque: ${out} ${out === 1 ? "item acabou" : "itens acabaram"} e ${low} ${low === 1 ? "está" : "estão"} acabando.`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button role="switch" aria-checked={auto} aria-label="Adicionar automaticamente" onClick={() => setAuto(!auto)} className={`relative h-6 w-11 rounded-full transition ${auto ? "bg-violet-600" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${auto ? "left-[22px]" : "left-0.5"}`} />
            </button>
            <span className="text-[11px] text-zinc-500">Adicionar sozinho</span>
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Sugestões do estoque</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s.id} onClick={() => addShop(s.name)} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm transition hover:border-violet-500">
                  <Plus className="h-3.5 w-3.5" />{s.name}
                  <span className={`rounded px-1.5 text-[10px] font-bold ${LV[level(s)].cls}`}>{LV[level(s)].t}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={`${panel} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ShoppingCart className="h-4 w-4 text-violet-400" /> Lista de supermercado
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">{shop.length}</span>
          </div>
          {cart > 0 && (
            <button onClick={finishBuy} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-95">
              <Check className="h-4 w-4" /> Concluir compra ({cart})
            </button>
          )}
        </div>
        <div className="mb-4 flex gap-2">
          <input id="shop-input" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Adicionar item…" className={field} />
          <button onClick={add} aria-label="Adicionar" className="rounded-xl bg-violet-600 px-4 text-white transition hover:bg-violet-500 active:scale-95"><Plus className="h-5 w-5" /></button>
        </div>
        {shop.length === 0 ? (
          <div className="py-8 text-center text-zinc-400"><ShoppingCart className="mx-auto mb-2 h-8 w-8 text-zinc-600" />Lista vazia.</div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((s, i) => {
              const st = stock.find((x) => x.id === s.stockId);
              const lv = st ? level(st) : null;
              const cat = st ? CATS[st.cat] : null;
              return (
                <li key={s.id} className="a-up flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  <button aria-label="Marcar no carrinho" onClick={() => toggleShop(s.id)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-500 hover:border-emerald-400"}`}>
                    {s.done && <Check className="a-pop h-3.5 w-3.5" strokeWidth={3} />}
                  </button>
                  {cat && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${cat.cls}`}><cat.Icon className="h-4 w-4" /></span>}
                  <span className={`min-w-0 flex-1 break-words font-medium ${s.done ? "text-zinc-500 line-through" : ""}`}>{s.name}</span>
                  {lv && (lv === "out" || lv === "low") && !s.done && <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${LV[lv].cls}`}>{LV[lv].t}</span>}
                  <button aria-label="Remover" onClick={() => removeShop(s.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-950 hover:text-rose-400"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
        {cart > 0 && <p className="mt-3 text-xs text-zinc-500">Ao concluir, os itens marcados saem da lista e o estoque é atualizado.</p>}
      </section>
    </div>
  );
}

/* ===================== ESTOQUE ===================== */
export function Estoque({ casa }: { casa: Casa }) {
  const { stock, modal, setModal, setQty, removeItem, openItem, saveItem } = casa;
  const [q, setQ] = useState("");
  const [fl, setFl] = useState<"all" | "attn" | "exp" | CatId>("all");
  const out = stock.filter((s) => level(s) === "out").length;
  const low = stock.filter((s) => level(s) === "low").length;
  const exp = stock.filter((s) => { const d = expDays(s); return d !== null && d <= 30; }).length;
  const rank = (s: StockItem) => ({ out: 0, low: 1, mid: 2, ok: 3 })[level(s)];
  const list = stock
    .filter((s) => norm(s.name).includes(norm(q)) && (fl === "all" || (fl === "attn" && needsBuy(s)) || (fl === "exp" && (expDays(s) ?? 99) <= 30) || fl === s.cat))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const set = (p: Partial<Draft>) => setModal((m) => (m ? { ...m, f: { ...m.f, ...p } } : m));

  const stats: { t: string; n: number; Icon: LucideIcon; cls: string; to: "all" | "attn" | "exp" }[] = [
    { t: "Acabou", n: out, Icon: AlertTriangle, cls: "text-rose-400", to: "attn" },
    { t: "Acabando", n: low, Icon: TrendingDown, cls: "text-amber-400", to: "attn" },
    { t: "Validade", n: exp, Icon: CalendarDays, cls: "text-orange-400", to: "exp" },
    { t: "Itens", n: stock.length, Icon: Package, cls: "text-violet-400", to: "all" },
  ];

  const card = (s: StockItem, i: number) => {
    const cat = CATS[s.cat]; const lv = LV[level(s)]; const ec = expChip(s);
    return (
      <article key={s.id} className="a-up flex gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${cat.cls}`}><cat.Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate font-semibold">{s.name}</h4>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${lv.cls}`}>{lv.t}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {s.note && <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-zinc-300">{s.note}</span>}
            {ec && <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${ec.cls}`}><CalendarDays className="h-3 w-3" />{ec.t}</span>}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900">
              <button aria-label="Diminuir" onClick={() => setQty(s.id, -1)} className="p-1.5 text-zinc-300 hover:text-white active:scale-90"><Minus className="h-4 w-4" /></button>
              <span className="min-w-8 text-center text-sm font-semibold">{s.qty}</span>
              <button aria-label="Aumentar" onClick={() => setQty(s.id, 1)} className="p-1.5 text-zinc-300 hover:text-white active:scale-90"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="flex">
              <button aria-label="Editar" onClick={() => openItem(s)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Pencil className="h-4 w-4" /></button>
              <button aria-label="Excluir" onClick={() => removeItem(s.id)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const chip = (on: boolean) => `flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`;
  const grouped = fl === "all" || fl === "exp" || fl === "attn";

  return (
    <div className="a-fade mx-auto max-w-5xl space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <button key={s.t} onClick={() => setFl(s.to)} className={`${panel} flex items-center gap-3 p-4 text-left transition hover:border-zinc-600 active:scale-[0.98]`}>
            <s.Icon className={`h-6 w-6 ${s.cls}`} />
            <div><div className="text-2xl font-bold leading-none">{s.n}</div><div className="mt-1 text-xs text-zinc-400">{s.t}</div></div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no estoque…" className={`${field} pl-10`} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFl("all")} className={chip(fl === "all")}>Todos</button>
        <button onClick={() => setFl("attn")} className={chip(fl === "attn")}><AlertTriangle className="h-3.5 w-3.5" />Atenção</button>
        <button onClick={() => setFl("exp")} className={chip(fl === "exp")}><CalendarDays className="h-3.5 w-3.5" />Validade</button>
        {ORDER.map((c) => <button key={c} onClick={() => setFl(c)} className={chip(fl === c)}>{(() => { const I = CATS[c].Icon; return <I className="h-3.5 w-3.5" />; })()}{CATS[c].name}</button>)}
      </div>

      {list.length === 0 ? (
        <div className={`${panel} py-12 text-center text-zinc-400`}><Package className="mx-auto mb-2 h-8 w-8 text-zinc-600" />Nenhum item encontrado.</div>
      ) : grouped && fl === "all" && !q ? (
        ORDER.map((c) => {
          const items = list.filter((s) => s.cat === c);
          if (!items.length) return null;
          const C = CATS[c];
          return (
            <section key={c}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><span className={`flex h-6 w-6 items-center justify-center rounded-md text-white ${C.cls}`}><C.Icon className="h-3.5 w-3.5" /></span>{C.name}<span className="text-xs font-normal text-zinc-500">{items.length}</span></h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div>
            </section>
          );
        })
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(card)}</div>
      )}

      {modal && (
        <div className="a-fade fixed inset-0 z-50 flex items-end justify-center bg-black/80 md:items-center" onClick={() => setModal(null)}>
          <div className="a-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 md:max-w-lg md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-bold">{modal.id ? "Editar item" : "Novo item no estoque"}</h3>
              <button aria-label="Fechar" onClick={() => setModal(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className={lbl}>Produto</label><input autoFocus value={modal.f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex: Arroz" className={field} /></div>
              <div>
                <label className={lbl}>Quantidade</label>
                <div className="flex w-40 items-center rounded-xl border border-zinc-700 bg-zinc-800">
                  <button aria-label="Diminuir" onClick={() => set({ qty: Math.max(0, modal.f.qty - 1) })} className="p-3 text-zinc-300 hover:text-white"><Minus className="h-4 w-4" /></button>
                  <span className="flex-1 text-center font-semibold">{modal.f.qty} un.</span>
                  <button aria-label="Aumentar" onClick={() => set({ qty: modal.f.qty + 1 })} className="p-3 text-zinc-300 hover:text-white"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <label className={lbl}>Estado / observação</label>
                <input value={modal.f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ex: Aberto, 1/3, Acabando" className={field} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {NOTES.map((n) => <button key={n} onClick={() => set({ note: n })} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${modal.f.note === n ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`}>{n}</button>)}
                </div>
              </div>
              <div>
                <label className={lbl}>Validade (opcional)</label>
                <input type="date" value={modal.f.expiry} onChange={(e) => set({ expiry: e.target.value })} className={field} />
                {modal.f.expiry && <button onClick={() => set({ expiry: "" })} className="mt-1 text-xs text-zinc-400 hover:text-violet-300">Remover validade</button>}
              </div>
              <div>
                <label className={lbl}>Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER.map((c) => { const C = CATS[c]; return (
                    <button key={c} onClick={() => set({ cat: c })} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${C.cls} ${modal.f.cat === c ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"}`}><C.Icon className="h-4 w-4" />{C.name}</button>
                  ); })}
                </div>
              </div>
              <button onClick={saveItem} disabled={!modal.f.name.trim()} className="w-full rounded-xl bg-violet-600 py-3.5 font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-40">
                {modal.id ? "Salvar alterações" : "Adicionar ao estoque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== VALIDADES (aba Lembretes) ===================== */
export function Validades({ casa }: { casa: Casa }) {
  const list = casa.stock
    .filter((s) => { const d = expDays(s); return d !== null && d <= 30; })
    .sort((a, b) => (expDays(a) ?? 0) - (expDays(b) ?? 0));
  if (!list.length) return null;
  return (
    <section className={`${panel} a-fade mx-auto mt-5 max-w-2xl p-5`}>
      <h2 className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-4 font-bold"><CalendarDays className="h-5 w-5 text-orange-400" /> Validade do estoque</h2>
      <ul className="space-y-2">
        {list.map((s) => { const c = expChip(s); const C = CATS[s.cat]; return (
          <li key={s.id} className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${C.cls}`}><C.Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
            {c && <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${c.cls}`}>{c.t}</span>}
          </li>
        ); })}
      </ul>
    </section>
  );
}
