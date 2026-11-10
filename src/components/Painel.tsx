import { useEffect, useMemo, useState } from "react";
import {
  Bell, BellRing, CalendarDays, Check, ChevronLeft, ChevronRight,
  LayoutDashboard, ListChecks, Pencil, Plus, Trash2, X, Clock,
  ClipboardList, ShoppingCart, Package, Hammer, Inbox, Flag, Folder,
  Palette, Compass, Globe, Star, Code, Users, Briefcase, Home, ArrowRight, Sparkles, Sun, Moon, AlertTriangle,
} from "lucide-react";
import { Estoque, Mercado, Validades, useCasa, level, CATS } from "@/components/Casa";

type Priority = "baixa" | "media" | "alta";
type Status = "todo" | "doing" | "review" | "done";
type CheckItem = { id: string; text: string; done: boolean };
type Task = {
  id: string; title: string; project: string; notes: string;
  date: string; time: string; priority: Priority; status: Status;
  labels: string[]; checklist: CheckItem[]; reminders: string[];
  kind?: "card" | "afazer";
};
type Alert = { key: string; text: string };
type Tab = "home" | "hoje" | "quadro" | "afazeres" | "mercado" | "estoque" | "lembretes";

const COLS: { id: Status; name: string; dot: string }[] = [
  { id: "todo", name: "Backlog", dot: "bg-zinc-400" },
  { id: "doing", name: "Em andamento", dot: "bg-sky-400" },
  { id: "review", name: "Revisão", dot: "bg-amber-400" },
  { id: "done", name: "Concluído", dot: "bg-emerald-400" },
];
const LABELS = [
  { id: "ui", name: "UI", cls: "bg-violet-600", Icon: Palette },
  { id: "ux", name: "UX", cls: "bg-sky-600", Icon: Compass },
  { id: "web", name: "Web", cls: "bg-emerald-600", Icon: Globe },
  { id: "brand", name: "Branding", cls: "bg-amber-600", Icon: Star },
  { id: "dev", name: "Dev", cls: "bg-orange-600", Icon: Code },
  { id: "cliente", name: "Cliente", cls: "bg-rose-600", Icon: Users },
];
const REMINDERS = [
  { id: "12h", label: "12h", full: "12 horas antes", ms: 12 * 3600e3 },
  { id: "1d", label: "1 dia", full: "1 dia antes", ms: 86400e3 },
  { id: "3d", label: "3 dias", full: "3 dias antes", ms: 3 * 86400e3 },
  { id: "5d", label: "5 dias", full: "5 dias antes", ms: 5 * 86400e3 },
  { id: "7d", label: "7 dias", full: "7 dias antes", ms: 7 * 86400e3 },
  { id: "15d", label: "15 dias", full: "15 dias antes", ms: 15 * 86400e3 },
];
const PRIO: Record<Priority, { label: string; text: string; bar: string }> = {
  baixa: { label: "Baixa", text: "text-emerald-400", bar: "bg-emerald-500" },
  media: { label: "Média", text: "text-amber-400", bar: "bg-amber-500" },
  alta: { label: "Alta", text: "text-rose-400", bar: "bg-rose-500" },
};
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const due = (t: Task) => (t.date ? new Date(`${t.date}T${t.time || "09:00"}`) : null);
const fmtDT = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtD = (k: string) => k.split("-").reverse().slice(0, 2).join("/");
const fireKey = (t: Task, rid: string) => `${t.id}|${rid}|${t.date}|${t.time}`;
const uid = () => Math.random().toString(36).slice(2, 10);
const daysTo = (k: string) => Math.round((new Date(`${k}T00:00`).getTime() - new Date(`${toKey(new Date())}T00:00`).getTime()) / 86400e3);
const rel = (k: string) => { const d = daysTo(k); return d < 0 ? `${-d}d atrasada` : d === 0 ? "Hoje" : d === 1 ? "Amanhã" : `em ${d} dias`; };
const pastKeys = (t: Task) => {
  const dd = due(t);
  return dd ? REMINDERS.filter((r) => t.reminders.includes(r.id) && dd.getTime() - r.ms <= Date.now()).map((r) => fireKey(t, r.id)) : [];
};

function load<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
const emptyForm = (date: string, status: Status = "todo", kind: "card" | "afazer" = "card"): Omit<Task, "id"> => ({
  title: "", project: "", notes: "", date: kind === "afazer" ? "" : date, time: "09:00", priority: "media",
  status, labels: [], checklist: [], reminders: ["1d"], kind,
});
const TABS = [
  ["hoje", "Hoje", CalendarDays], ["quadro", "Quadro", LayoutDashboard], ["afazeres", "Afazeres", ClipboardList],
  ["mercado", "Mercado", ShoppingCart], ["estoque", "Estoque", Package],
] as const;
const AREAS = [
  { id: "trabalho", name: "Ambiente de trabalho", short: "Trabalho", desc: "Calendário, tarefas do dia e quadro estilo Trello para seus projetos de design e web design.", tabs: ["hoje", "quadro"], Icon: Briefcase, bg: "bg-violet-600", hover: "hover:border-violet-500" },
  { id: "afazeres", name: "Afazeres", short: "Afazeres", desc: "Lista de coisas para fazer em casa e na vida, com ou sem data marcada.", tabs: ["afazeres"], Icon: ClipboardList, bg: "bg-sky-600", hover: "hover:border-sky-500" },
  { id: "casa", name: "Estoque e mercado", short: "Casa", desc: "O que você tem em casa e o que precisa comprar, com leitura automática do que está acabando.", tabs: ["estoque", "mercado"], Icon: ShoppingCart, bg: "bg-emerald-600", hover: "hover:border-emerald-500" },
];
const PAGE: Record<string, { desc: string; action: string }> = {
  hoje: { desc: "Suas tarefas do dia e o calendário do mês.", action: "Nova tarefa" },
  quadro: { desc: "Cartões de design e web design organizados por etapa.", action: "Novo cartão" },
  afazeres: { desc: "Coisas para fazer, com ou sem data marcada.", action: "Novo afazer" },
  estoque: { desc: "O que você tem em casa e o que está acabando.", action: "Novo item" },
  mercado: { desc: "Sua lista de compras, alimentada pelo estoque.", action: "Adicionar item" },
  lembretes: { desc: "Avisos programados para as suas tarefas.", action: "" },
};

const CSS = `
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes sheet{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(.5)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes toast{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
.a-up{animation:up .4s ease both}
.a-fade{animation:fade .25s ease both}
.a-sheet{animation:sheet .35s cubic-bezier(.2,.8,.2,1) both}
.a-pop{animation:pop .3s ease both}
.a-toast{animation:toast .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.a-grow{animation:grow .7s cubic-bezier(.2,.8,.2,1) both;transform-origin:bottom}
.theme-light .bg-zinc-950,.theme-light .bg-zinc-900{background-color:#fff}
.theme-light .bg-zinc-900{box-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 30px -14px rgba(15,23,42,.14)}
.theme-light .bg-zinc-800,.theme-light [class~="bg-zinc-800/60"]{background-color:#f1f5f9}
.theme-light .bg-zinc-700{background-color:#e2e8f0}
.theme-light [class~="hover:bg-zinc-800"]:hover{background-color:#f1f5f9}
.theme-light [class~="hover:bg-zinc-700"]:hover{background-color:#e2e8f0}
.theme-light .bg-rose-950,.theme-light [class~="hover:bg-rose-950"]:hover{background-color:#ffe4e6}
.theme-light .bg-amber-950{background-color:#fef3c7}
.theme-light .border-zinc-800{border-color:#e2e8f0}
.theme-light .border-zinc-700{border-color:#cbd5e1}
.theme-light .border-zinc-600,.theme-light .border-zinc-500,.theme-light [class~="hover:border-zinc-600"]:hover,.theme-light [class~="hover:border-zinc-500"]:hover{border-color:#94a3b8}
.theme-light .text-zinc-100{color:#0f172a}
.theme-light .text-zinc-200{color:#1e293b}
.theme-light .text-zinc-300{color:#334155}
.theme-light .text-zinc-400{color:#64748b}
.theme-light .text-zinc-500,.theme-light .text-zinc-600{color:#94a3b8}
.theme-light [class~="hover:text-white"]:hover,.theme-light [class~="hover:text-zinc-300"]:hover{color:#0f172a}
.theme-light .text-violet-300,.theme-light .text-violet-400{color:#6d28d9}
.theme-light .text-emerald-400{color:#059669}
.theme-light .text-amber-300,.theme-light .text-amber-400{color:#b45309}
.theme-light .text-rose-400{color:#e11d48}
.theme-light .text-orange-400{color:#ea580c}
.theme-light [class~="placeholder:text-zinc-500"]::placeholder{color:#94a3b8}
.theme-light .ring-white{--tw-ring-color:#0f172a}
.theme-light [class*="color-scheme"]{color-scheme:light}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const panel = "rounded-2xl border border-zinc-800 bg-zinc-900";
const field = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-violet-500";
const lbl = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400";

export default function Painel() {
  const today = new Date();
  const [tasks, setTasks] = useState<Task[]>(() => load("tasks-v2", []));
  const [fired, setFired] = useState<string[]>(() => load("tasks-v2-fired", []));
  const [selected, setSelected] = useState(toKey(today));
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tab, setTab] = useState<Tab>("home");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm(selected));
  const [newCheck, setNewCheck] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const casa = useCasa();
  const [qaTitle, setQaTitle] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  const area = AREAS.find((a) => a.tabs.includes(tab));
  const [theme, setTheme] = useState<"dark" | "light">(() => load("theme-v1", "dark"));
  useEffect(() => {
    save("theme-v1", theme);
    document.body.style.background = theme === "light" ? "#f1f5f9" : "#09090b";
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const curName = tab === "home" ? "Visão geral" : tab === "lembretes" ? "Lembretes" : TABS.find((t) => t[0] === tab)?.[1];
  const navBtn = (id: Tab, name: string, Icon: typeof Home, badge = 0) => (
    <button key={id} onClick={() => setTab(id)} className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${tab === id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-slate-100"}`}>
      <Icon className={`h-[18px] w-[18px] ${tab === id ? "text-[#c4b5fd]" : ""}`} />
      <span className="flex-1 text-left">{name}</span>
      {badge > 0 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
      {tab === id && <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />}
    </button>
  );

  useEffect(() => save("tasks-v2", tasks), [tasks]);
  useEffect(() => save("tasks-v2-fired", fired), [fired]);

  // Lembretes
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const nf: string[] = [];
      const na: Alert[] = [];
      tasks.forEach((t) => {
        const dd = due(t);
        if (!dd || t.status === "done") return;
        REMINDERS.filter((r) => t.reminders.includes(r.id)).forEach((r) => {
          const k = fireKey(t, r.id);
          if (now >= dd.getTime() - r.ms && now < dd.getTime() && !fired.includes(k) && !nf.includes(k)) {
            nf.push(k);
            const text = `${t.title} — ${r.full} (${fmtDT(dd)})`;
            na.push({ key: k, text });
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("Lembrete de tarefa", { body: text });
            }
          }
        });
      });
      if (nf.length) { setFired((f) => [...f, ...nf]); setAlerts((a) => [...a, ...na]); }
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, [tasks, fired]);

  const byDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((t) => t.date && (m[t.date] ||= []).push(t));
    return m;
  }, [tasks]);

  const dayTasks = (byDate[selected] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const doneCount = dayTasks.filter((t) => t.status === "done").length;
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const selDate = new Date(`${selected}T00:00`);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const list: { t: Task; label: string; at: Date }[] = [];
    tasks.forEach((t) => {
      const dd = due(t);
      if (!dd || t.status === "done") return;
      REMINDERS.filter((r) => t.reminders.includes(r.id)).forEach((r) => {
        const at = new Date(dd.getTime() - r.ms);
        if (at.getTime() > now) list.push({ t, label: r.full, at });
      });
    });
    return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 40);
  }, [tasks]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const openNew = (status: Status = "todo", kind: "card" | "afazer" = "card") => {
    setEditing(null); setForm(emptyForm(selected, status, kind)); setNewCheck(""); setOpen(true);
  };
  const newAction = () => {
    if (tab === "afazeres") openNew("todo", "afazer");
    else if (tab === "estoque") casa.openItem();
    else if (tab === "mercado") document.getElementById("shop-input")?.focus();
    else openNew();
  };
  const quickAdd = () => {
    if (!qaTitle.trim()) return;
    const t: Task = { ...emptyForm(qaDate, "todo", "afazer"), id: uid(), title: qaTitle.trim(), date: qaDate };
    setFired((f) => Array.from(new Set([...f, ...pastKeys(t)])));
    setTasks((ts) => [...ts, t]);
    setQaTitle(""); setQaDate("");
  };
  const setDate = (id: string, date: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const n = { ...t, date };
    setFired((f) => Array.from(new Set([...f, ...pastKeys(n)])));
    setTasks((ts) => ts.map((x) => (x.id === id ? n : x)));
  };
  const openEdit = (t: Task) => {
    const { id, ...rest } = t;
    setEditing(id); setForm(rest); setNewCheck(""); setOpen(true);
  };
  const submit = () => {
    if (!form.title.trim()) return;
    const base: Task = { ...form, id: editing || uid(), title: form.title.trim() };
    const dd = due(base);
    const past = dd
      ? REMINDERS.filter((r) => base.reminders.includes(r.id) && dd.getTime() - r.ms <= Date.now()).map((r) => fireKey(base, r.id))
      : [];
    setFired((f) => Array.from(new Set([...f, ...past])));
    setTasks((ts) => (editing ? ts.map((t) => (t.id === editing ? base : t)) : [...ts, base]));
    if (base.date) {
      setSelected(base.date);
      const d = new Date(`${base.date}T00:00`);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setOpen(false);
  };
  const move = (id: string, status: Status) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  const remove = (id: string) => confirm("Excluir esta tarefa?") && setTasks((ts) => ts.filter((x) => x.id !== id));
  const toggleCheck = (tid: string, cid: string) =>
    setTasks((ts) => ts.map((t) => (t.id === tid ? { ...t, checklist: t.checklist.map((c) => (c.id === cid ? { ...c, done: !c.done } : c)) } : t)));
  const toggleIn = (key: "labels" | "reminders", id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  const askPerm = async () => { if (typeof Notification !== "undefined") setPerm(await Notification.requestPermission()); };

  const isLate = (t: Task) => { const d = due(t); return !!d && t.status !== "done" && d.getTime() < Date.now(); };

  const LabelBars = ({ t }: { t: Task }) => t.labels.length ? (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {t.labels.map((l) => {
        const lb = LABELS.find((x) => x.id === l);
        return lb ? <span key={l} className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white ${lb.cls}`}><lb.Icon className="h-3 w-3" />{lb.name}</span> : null;
      })}
    </div>
  ) : null;

  return (
    <div className={`fixed inset-0 flex text-left antialiased ${theme === "light" ? "theme-light" : "theme-dark"}`} style={{ background: theme === "light" ? "#f1f5f9" : "#09090b", color: theme === "light" ? "#0f172a" : "#f4f4f5", colorScheme: theme }}>
      <style>{CSS}</style>

      {/* Alertas */}
      <div className="fixed inset-x-4 top-4 z-[70] space-y-2 md:left-auto md:w-96">
        {alerts.map((a) => (
          <div key={a.key} className="a-toast flex items-start gap-3 rounded-xl border border-violet-500 bg-zinc-900 p-4 shadow-2xl">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
            <p className="flex-1 text-sm text-zinc-100">{a.text}</p>
            <button aria-label="Fechar" onClick={() => setAlerts((x) => x.filter((y) => y.key !== a.key))} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {/* Menu lateral */}
      <aside className="hidden w-[17rem] shrink-0 flex-col overflow-y-auto md:flex" style={{ background: "#0f1c2e" }}>
        <div className="flex items-center gap-3 px-6 pb-5 pt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 text-white shadow-lg shadow-violet-900/40"><ListChecks className="h-6 w-6" /></span>
          <div><div className="text-lg font-bold leading-tight text-white">Minhas tarefas</div><div className="text-xs text-slate-400">Trabalho, casa e estoque</div></div>
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-4">
          <div className="px-3 pb-1.5 pt-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500">MENU PRINCIPAL</div>
          {navBtn("home", "Visão geral", Home)}
          {AREAS.map((a) => (
            <div key={a.id} className="space-y-1">
              <div className="px-3 pb-1.5 pt-5 text-[11px] font-semibold tracking-[0.18em] text-slate-500">{a.name.toUpperCase()}</div>
              {TABS.filter((t) => a.tabs.includes(t[0])).map(([id, name, Icon]) => navBtn(id, name, Icon))}
            </div>
          ))}
          <div className="px-3 pb-1.5 pt-5 text-[11px] font-semibold tracking-[0.18em] text-slate-500">SISTEMA</div>
          {navBtn("lembretes", "Lembretes", Bell, upcoming.length)}
        </nav>
        <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-100"><Sparkles className="h-4 w-4 text-[#c4b5fd]" /> Leitura automática</div>
          <p className="text-xs leading-relaxed text-slate-400">O que acabar no estoque entra sozinho na lista de compras. Seus dados ficam salvos neste navegador.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 text-white md:hidden"><ListChecks className="h-5 w-5" /></span>
            <div className="flex min-w-0 items-center gap-2 truncate text-sm text-zinc-400">
              <span className="hidden sm:inline">Minhas tarefas</span><span className="hidden sm:inline">/</span>
              <span className="truncate font-bold text-zinc-100">{curName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {perm === "default" && (
              <button onClick={askPerm} className="hidden items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:border-violet-500 sm:flex"><BellRing className="h-3.5 w-3.5" /> Ativar avisos</button>
            )}
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema" title={theme === "dark" ? "Tema claro" : "Tema escuro"} className="rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 text-zinc-300 transition hover:border-violet-500 active:scale-90">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => setTab("lembretes")} aria-label="Lembretes" className={`relative rounded-xl border p-2.5 transition active:scale-90 ${tab === "lembretes" ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-500"}`}>
              <Bell className="h-4 w-4" />
              {upcoming.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{Math.min(upcoming.length, 9)}</span>}
            </button>
            <div className="ml-1 hidden items-center gap-3 border-l border-zinc-800 pl-4 sm:flex">
              <div className="text-right leading-tight"><div className="text-sm font-bold">Meu espaço</div><div className="text-xs text-zinc-400">Dados neste aparelho</div></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-sm font-bold text-amber-900">EU</span>
            </div>
          </div>
        </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
        {tab !== "home" && (() => {
          const cur = tab === "lembretes" ? (["lembretes", "Lembretes", Bell] as const) : TABS.find((t) => t[0] === tab);
          if (!cur) return null;
          const CurIcon = cur[2];
          const pg = PAGE[tab];
          return (
            <div className="a-up mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-900/30"><CurIcon className="h-6 w-6" /></span>
                <div><h1 className="text-2xl font-bold tracking-tight">{cur[1]}</h1><p className="text-sm text-zinc-400">{pg?.desc}</p></div>
              </div>
              {pg?.action && (
                <button onClick={newAction} className="hidden shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 active:scale-95 md:flex"><Plus className="h-4 w-4" /> {pg.action}</button>
              )}
            </div>
          );
        })()}
        {tab === "home" && (() => {
          const hr = today.getHours();
          const tk = toKey(today);
          const afz = tasks.filter((t) => t.kind === "afazer");
          const cards = tasks.filter((t) => t.kind !== "afazer");
          const todayAll = tasks.filter((t) => t.date === tk);
          const todayDone = todayAll.filter((t) => t.status === "done").length;
          const doing = cards.filter((t) => t.status === "doing").length;
          const review = cards.filter((t) => t.status === "review").length;
          const afzOpen = afz.filter((t) => t.status !== "done");
          const lowItems = casa.stock.filter((s) => { const l = level(s); return l === "out" || l === "low"; }).sort((a, b) => a.qty - b.qty);
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            const list = byDate[toKey(d)] || [];
            return { k: toKey(d), d, done: list.filter((t) => t.status === "done").length, pend: list.filter((t) => t.status !== "done").length };
          });
          const max = Math.max(4, ...days.map((x) => x.done + x.pend));
          const nextTasks = tasks.filter((t) => t.date && t.status !== "done").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
          const pill = (t: Task): [string, string] =>
            isLate(t) ? ["Atrasada", "bg-rose-600 text-white"] : t.status === "doing" ? ["Em andamento", "bg-sky-600 text-white"] : t.status === "review" ? ["Em revisão", "bg-amber-500 text-zinc-950"] : ["A fazer", "bg-zinc-800 text-zinc-300"];
          const goTo = (t: Task) => {
            if (t.kind === "afazer") { setTab("afazeres"); return; }
            const d = new Date(`${t.date}T00:00`);
            setSelected(t.date); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setTab("hoje");
          };
          const stats: [string, number, string, typeof Clock, string, string, Tab][] = [
            ["Tarefas de hoje", todayAll.length - todayDone, todayAll.length ? `${todayDone} de ${todayAll.length} concluídas` : "Nenhuma tarefa hoje", CalendarDays, "bg-violet-600 text-white", "text-emerald-400", "hoje"],
            ["Em andamento", doing, `${review} em revisão`, LayoutDashboard, "bg-sky-600 text-white", "text-zinc-400", "quadro"],
            ["Afazeres pendentes", afzOpen.length, `${afzOpen.filter((t) => t.date).length} com data marcada`, ClipboardList, "bg-emerald-600 text-white", "text-zinc-400", "afazeres"],
            ["Itens acabando", lowItems.length, lowItems.length ? "Precisam de reposição" : "Estoque em dia", AlertTriangle, "bg-amber-500 text-zinc-950", "text-amber-400", "estoque"],
          ];
          const quick: [string, typeof Clock, () => void][] = [
            ["Nova tarefa", Plus, () => openNew()],
            ["Novo afazer", Hammer, () => openNew("todo", "afazer")],
            ["Item no estoque", Package, () => { setTab("estoque"); casa.openItem(); }],
            ["Lista de compras", ShoppingCart, () => setTab("mercado")],
          ];
          return (
            <div className="a-fade">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"}! 👋</h1>
                  <p className="mt-1 text-zinc-400">Aqui está o resumo do seu dia.</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300">
                  <Clock className="h-4 w-4 text-zinc-500" />{SEMANA[today.getDay()]}{today.getDay() > 0 && today.getDay() < 6 ? "-feira" : ""}, {today.getDate()} de {MESES[today.getMonth()].toLowerCase()} de {today.getFullYear()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map(([t, n, sub, Icon, chip, subCls, to], i) => (
                  <button key={t} onClick={() => setTab(to)} className="a-up flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-zinc-600 active:scale-[0.98]" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-400">{t}</span>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chip}`}><Icon className="h-5 w-5" /></span>
                    </div>
                    <div className="mt-5 text-4xl font-bold tracking-tight">{n}</div>
                    <div className={`mt-2 text-sm ${subCls}`}>{sub}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
                <div className="space-y-5">
                  <section className={`${panel} p-6`}>
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div><h3 className="text-lg font-bold">Visão da semana</h3><p className="text-sm text-zinc-400">Tarefas dos próximos 7 dias</p></div>
                      <span className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">Próximos 7 dias</span>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[170px] flex-col justify-between">{[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-zinc-800" />)}</div>
                      <div className="relative flex items-end justify-between gap-2 sm:gap-4">
                        {days.map((x, i) => {
                          const tot = x.done + x.pend;
                          return (
                            <div key={x.k} className="flex flex-1 flex-col items-center">
                              <div className="flex h-[170px] w-full flex-col items-center justify-end">
                                {tot > 0 && <span className="mb-1 text-xs font-semibold text-zinc-300">{tot}</span>}
                                <div className="a-grow flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-t-lg" style={{ height: tot ? Math.max(10, (tot / max) * 140) : 4, animationDelay: `${i * 70}ms`, background: tot ? undefined : "rgba(113,113,122,.35)" }}>
                                  {x.pend > 0 && <div className="bg-violet-500" style={{ flex: x.pend }} />}
                                  {x.done > 0 && <div className="bg-emerald-500" style={{ flex: x.done }} />}
                                </div>
                              </div>
                              <div className={`mt-2 text-[11px] font-semibold tracking-wider ${i === 0 ? "text-violet-400" : "text-zinc-500"}`}>{SEMANA[x.d.getDay()].slice(0, 3).toUpperCase()} {x.d.getDate()}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-5 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" /> Pendentes</span>
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Concluídas</span>
                    </div>
                  </section>

                  <section className={`${panel} p-6`}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div><h3 className="text-lg font-bold">Próximas tarefas</h3><p className="text-sm text-zinc-400">Tarefas e afazeres com data marcada</p></div>
                      <button onClick={() => setTab("hoje")} className="flex items-center gap-1 text-sm font-semibold text-violet-400 hover:text-violet-300">Ver todas <ArrowRight className="h-4 w-4" /></button>
                    </div>
                    {nextTasks.length === 0 ? (
                      <div className="py-8 text-center text-zinc-400"><CalendarDays className="mx-auto mb-2 h-8 w-8 text-zinc-600" />Nenhuma tarefa com data marcada.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="min-w-[560px]">
                          <div className="grid grid-cols-[2.2fr_1fr_1.2fr_1.2fr] gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-400"><span>Tarefa</span><span>Tipo</span><span>Data</span><span>Status</span></div>
                          {nextTasks.map((t) => {
                            const [pl, pc] = pill(t);
                            return (
                              <button key={t.id} onClick={() => goTo(t)} className="grid w-full grid-cols-[2.2fr_1fr_1.2fr_1.2fr] items-center gap-3 border-b border-zinc-800 px-3 py-3.5 text-left text-sm transition last:border-0 hover:bg-zinc-800">
                                <span className="min-w-0"><span className="block truncate font-semibold">{t.title}</span>{t.project && <span className="block truncate text-xs text-zinc-400">{t.project}</span>}</span>
                                <span className="flex items-center gap-1.5 text-zinc-300">{t.kind === "afazer" ? <><Hammer className="h-3.5 w-3.5" />Afazer</> : <><LayoutDashboard className="h-3.5 w-3.5" />Cartão</>}</span>
                                <span className="text-zinc-300">{fmtD(t.date)} <span className="text-xs text-zinc-500">· {rel(t.date)}</span></span>
                                <span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pc}`}>{pl}</span></span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-5">
                  <section className={`${panel} p-6`}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div><h3 className="text-lg font-bold">Estoque em atenção</h3><p className="text-sm text-zinc-400">Itens acabando ou zerados</p></div>
                      <button onClick={() => setTab("estoque")} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-violet-400 hover:text-violet-300">Ver estoque <ArrowRight className="h-4 w-4" /></button>
                    </div>
                    {lowItems.length === 0 ? (
                      <div className="py-6 text-center text-zinc-400"><Check className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tudo em dia por aqui.</div>
                    ) : (
                      <ul className="space-y-4">
                        {lowItems.slice(0, 5).map((s) => {
                          const out = level(s) === "out";
                          const C = CATS[s.cat];
                          return (
                            <li key={s.id} className="flex items-start gap-3">
                              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${C.cls}`}><C.Icon className="h-5 w-5" /></span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{s.name}</span><span className={`text-sm font-bold ${out ? "text-rose-400" : "text-amber-400"}`}>{s.qty}</span></div>
                                <div className="text-xs text-zinc-400">Estoque: {s.qty} un.{s.note ? ` · ${s.note}` : ""}</div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full ${out ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: out ? "6%" : "30%" }} /></div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section className={`${panel} p-6`}>
                    <h3 className="text-lg font-bold">Ações rápidas</h3>
                    <p className="mb-4 text-sm text-zinc-400">Acesse as tarefas mais utilizadas</p>
                    <div className="grid grid-cols-2 gap-3">
                      {quick.map(([label, Icon, fn]) => (
                        <button key={label} onClick={fn} className="flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-500 active:scale-95">
                          <Icon className="h-5 w-5 text-violet-400" /><span className="text-sm font-semibold">{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className={`${panel} p-6`}>
                    <h3 className="text-lg font-bold">Seus ambientes</h3>
                    <p className="mb-4 text-sm text-zinc-400">Escolha onde quer entrar</p>
                    <div className="space-y-2.5">
                      {AREAS.map((a) => (
                        <button key={a.id} onClick={() => setTab(a.tabs[0] as Tab)} className="group flex w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-left transition hover:border-violet-500">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${a.bg}`}><a.Icon className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{a.name}</span><span className="block truncate text-xs text-zinc-400">{a.desc}</span></span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </section>

                  {upcoming.length > 0 && (
                    <section className={`${panel} p-6`}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-bold"><Bell className="h-4 w-4 text-violet-400" /> Lembretes</h3>
                        <button onClick={() => setTab("lembretes")} className="text-sm font-semibold text-violet-400 hover:text-violet-300">Ver todos</button>
                      </div>
                      <ul className="space-y-2">
                        {upcoming.slice(0, 3).map((u, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
                            <div className="min-w-0"><div className="truncate text-sm font-semibold">{u.t.title}</div><div className="text-xs text-zinc-400">{u.label}</div></div>
                            <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-violet-400">{fmtDT(u.at)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
              <p className="mt-8 text-center text-xs text-zinc-500">Minhas tarefas • seus dados ficam salvos neste navegador</p>
            </div>
          );
        })()}

        {/* HOJE */}
        {tab === "hoje" && (
          <div className="a-fade grid items-start gap-5 lg:grid-cols-[1fr_380px]">
            {/* Tarefas do dia (primeiro) */}
            <section className={`${panel} p-5`}>
              <div className="mb-4 flex items-end justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-400">Tarefas do dia</h2>
                  <p className="mt-1 text-2xl font-bold">
                    {selected === toKey(today) ? "Hoje" : SEMANA[selDate.getDay()]}
                    <span className="ml-2 text-base font-medium text-zinc-400">{selDate.getDate()} de {MESES[selDate.getMonth()].toLowerCase()}</span>
                  </p>
                </div>
                {dayTasks.length > 0 && <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300">{doneCount}/{dayTasks.length}</span>}
              </div>
              {dayTasks.length > 0 && (
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              )}
              {dayTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-zinc-400">Nenhuma tarefa neste dia.</p>
                  <button onClick={() => openNew()} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">+ Adicionar tarefa</button>
                </div>
              ) : (
                <ul key={selected} className="space-y-3">
                  {dayTasks.map((t, i) => (
                    <li key={t.id} className="a-up relative flex gap-3 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 p-4 pl-5" style={{ animationDelay: `${i * 50}ms` }}>
                      <span className={`absolute inset-y-0 left-0 w-1.5 ${PRIO[t.priority].bar}`} />
                      <button aria-label="Concluir" onClick={() => move(t.id, t.status === "done" ? "todo" : "done")}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${t.status === "done" ? "border-violet-500 bg-violet-500 text-white" : "border-zinc-500 hover:border-violet-400"}`}>
                        {t.status === "done" && <Check className="a-pop h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        {t.project && <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Folder className="h-3 w-3" />{t.project}</div>}
                        <div className={`break-words font-semibold ${t.status === "done" ? "text-zinc-500 line-through" : ""}`}>{t.title}</div>
                        {t.notes && <p className="mt-1 break-words text-sm text-zinc-400">{t.notes}</p>}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-zinc-300"><Clock className="h-3 w-3" />{t.time}</span>
                          {t.kind !== "afazer" && <span className={`flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 font-medium ${PRIO[t.priority].text}`}><Flag className="h-3 w-3" />{PRIO[t.priority].label}</span>}
                          <span className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-zinc-300">{t.kind === "afazer" ? <><Hammer className="h-3 w-3" />Afazer</> : <><LayoutDashboard className="h-3 w-3" />{COLS.find((c) => c.id === t.status)?.name}</>}</span>
                          {t.labels.map((l) => { const lb = LABELS.find((x) => x.id === l); return lb ? <span key={l} className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-white ${lb.cls}`}><lb.Icon className="h-3 w-3" />{lb.name}</span> : null; })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button aria-label="Editar" onClick={() => openEdit(t)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Pencil className="h-4 w-4" /></button>
                        <button aria-label="Excluir" onClick={() => remove(t.id)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Calendário */}
            <section className={`${panel} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <button aria-label="Mês anterior" className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-200 hover:bg-zinc-700 active:scale-90" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5" /></button>
                <div className="text-center">
                  <div className="font-bold">{MESES[month.getMonth()]}</div>
                  <div className="text-xs text-zinc-400">{month.getFullYear()}</div>
                </div>
                <button aria-label="Próximo mês" className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-200 hover:bg-zinc-700 active:scale-90" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-zinc-500">{DIAS.map((d, i) => <div key={i}>{d}</div>)}</div>
              <div key={`${month.getFullYear()}-${month.getMonth()}`} className="a-fade grid grid-cols-7 gap-1.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(day)}`;
                  const list = byDate[key] || [];
                  const pending = list.some((t) => t.status !== "done");
                  const isSel = key === selected;
                  const isToday = key === toKey(today);
                  return (
                    <button key={i} onClick={() => setSelected(key)}
                      className={`relative flex aspect-square items-center justify-center rounded-xl border text-sm font-medium transition active:scale-90
                        ${isSel ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-800 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600"}
                        ${isToday && !isSel ? "!border-violet-400 text-violet-300" : ""}`}>
                      {day}
                      {list.length > 0 && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${isSel ? "bg-white" : pending ? "bg-violet-400" : "bg-emerald-400"}`} />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-400" /> Pendentes</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" /> Concluídas</span>
              </div>
            </section>
          </div>
        )}

        {/* QUADRO (Trello) */}
        {tab === "quadro" && (
          <div className="a-fade flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible">
            {COLS.map((col) => {
              const list = tasks.filter((t) => t.kind !== "afazer" && t.status === col.id);
              return (
                <section key={col.id}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
                  onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                  onDrop={() => { if (dragId) move(dragId, col.id); setDragId(null); setOverCol(null); }}
                  className={`min-w-[84%] snap-center rounded-2xl border bg-zinc-900 p-3 transition md:min-w-0 ${overCol === col.id ? "border-violet-500" : "border-zinc-800"}`}>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="flex items-center gap-2 text-sm font-bold"><i className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />{col.name}</h3>
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">{list.length}</span>
                  </div>
                  <div className="space-y-3">
                    {list.map((t, i) => {
                      const dd = due(t);
                      const ci = col.id === "todo" ? null : COLS[COLS.findIndex((c) => c.id === col.id) - 1];
                      const ni = col.id === "done" ? null : COLS[COLS.findIndex((c) => c.id === col.id) + 1];
                      const cdone = t.checklist.filter((c) => c.done).length;
                      return (
                        <article key={t.id} draggable onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                          className={`a-up cursor-grab rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-md transition hover:border-zinc-500 active:cursor-grabbing ${dragId === t.id ? "opacity-40" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                          <LabelBars t={t} />
                          {t.project && <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Folder className="h-3 w-3" />{t.project}</div>}
                          <div className={`break-words text-sm font-semibold ${t.status === "done" ? "text-zinc-500 line-through" : ""}`}>{t.title}</div>
                          {t.notes && <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-400">{t.notes}</p>}
                          {t.checklist.length > 0 && (
                            <div className="mt-2.5">
                              <div className="mb-1.5 flex items-center gap-2 text-xs text-zinc-400">
                                <ListChecks className="h-3.5 w-3.5" />{cdone}/{t.checklist.length}
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-700"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(cdone / t.checklist.length) * 100}%` }} /></div>
                              </div>
                              <ul className="space-y-1">
                                {t.checklist.map((c) => (
                                  <li key={c.id}>
                                    <button onClick={() => toggleCheck(t.id, c.id)} className="flex w-full items-center gap-2 text-left text-xs text-zinc-300 hover:text-white">
                                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${c.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-500"}`}>{c.done && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                                      <span className={c.done ? "text-zinc-500 line-through" : ""}>{c.text}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-between border-t border-zinc-700 pt-2.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {dd && <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${isLate(t) ? "bg-rose-600 text-white" : "bg-zinc-900 text-zinc-300"}`}><Clock className="h-3 w-3" />{fmtD(t.date)}</span>}
                              <span className={`font-semibold ${PRIO[t.priority].text}`}>●</span>
                              {t.reminders.length > 0 && dd && <Bell className="h-3 w-3 text-zinc-500" />}
                            </div>
                            <div className="flex items-center">
                              <button aria-label="Mover para trás" disabled={!ci} onClick={() => ci && move(t.id, ci.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-20"><ChevronLeft className="h-4 w-4" /></button>
                              <button aria-label="Mover para frente" disabled={!ni} onClick={() => ni && move(t.id, ni.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-20"><ChevronRight className="h-4 w-4" /></button>
                              <button aria-label="Editar" onClick={() => openEdit(t)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                              <button aria-label="Excluir" onClick={() => remove(t.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-950 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    <button onClick={() => openNew(col.id)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:border-violet-500 hover:text-violet-300">
                      <Plus className="h-4 w-4" /> Adicionar cartão
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {tab === "afazeres" && (() => {
          const afz = tasks.filter((t) => t.kind === "afazer");
          const sem = afz.filter((t) => !t.date && t.status !== "done");
          const ag = afz.filter((t) => t.date && t.status !== "done").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          const ok = afz.filter((t) => t.status === "done");
          const Head = ({ Icon, text, n }: { Icon: typeof Inbox; text: string; n: number }) => (
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-violet-400" />{text}<span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">{n}</span></div>
          );
          const row = (t: Task, i: number) => {
            const done = t.status === "done";
            const late = isLate(t);
            return (
              <li key={t.id} className="a-up flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                <button aria-label="Concluir" onClick={() => move(t.id, done ? "todo" : "done")}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${done ? "border-violet-500 bg-violet-500 text-white" : "border-zinc-500 hover:border-violet-400"}`}>
                  {done && <Check className="a-pop h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`break-words font-medium ${done ? "text-zinc-500 line-through" : ""}`}>{t.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {t.project && <span className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-zinc-300"><Folder className="h-3 w-3" />{t.project}</span>}
                    {!done && (
                      <label className={`relative flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 font-medium ${t.date ? (late ? "bg-rose-600 text-white" : "bg-violet-600 text-white") : "border border-dashed border-zinc-600 text-zinc-400 hover:border-violet-500 hover:text-violet-300"}`}>
                        <CalendarDays className="h-3 w-3" />{t.date ? `${fmtD(t.date)} · ${rel(t.date)}` : "Definir data"}
                        <input type="date" value={t.date} onChange={(e) => setDate(t.id, e.target.value)}
                          onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:dark]" />
                      </label>
                    )}
                  </div>
                </div>
                <button aria-label="Editar" onClick={() => openEdit(t)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Pencil className="h-4 w-4" /></button>
                <button aria-label="Excluir" onClick={() => remove(t.id)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          };
          return (
            <div className="a-fade mx-auto max-w-3xl space-y-5">
              <section className={`${panel} p-4`}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Hammer className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input value={qaTitle} onChange={(e) => setQaTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} placeholder="Ex: Colocar rejunte no banheiro" className={`${field} pl-10`} />
                  </div>
                  <label className="relative flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-sm text-zinc-300 hover:border-violet-500">
                    <CalendarDays className="h-4 w-4" />{qaDate ? `${fmtD(qaDate)} · ${rel(qaDate)}` : "Sem data"}
                    <input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)}
                      onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:dark]" />
                  </label>
                  <button onClick={quickAdd} disabled={!qaTitle.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 active:scale-95 disabled:opacity-40"><Plus className="h-4 w-4" /> Adicionar</button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Sem data: fica só na lista. Com data: entra no calendário e recebe os lembretes.</p>
              </section>
              <section className={`${panel} p-5`}>
                <Head Icon={Inbox} text="Sem data" n={sem.length} />
                {sem.length ? <ul className="space-y-2">{sem.map(row)}</ul> : <p className="py-4 text-center text-sm text-zinc-500">Nada pendente sem data.</p>}
              </section>
              <section className={`${panel} p-5`}>
                <Head Icon={CalendarDays} text="Agendadas" n={ag.length} />
                {ag.length ? <ul className="space-y-2">{ag.map(row)}</ul> : <p className="py-4 text-center text-sm text-zinc-500">Nenhum afazer com data.</p>}
              </section>
              {ok.length > 0 && (
                <section className={`${panel} p-5`}>
                  <button onClick={() => setShowDone(!showDone)} className="flex w-full items-center justify-between">
                    <Head Icon={Check} text="Concluídos" n={ok.length} />
                    <span className="mb-3 text-xs text-zinc-500">{showDone ? "Ocultar" : "Mostrar"}</span>
                  </button>
                  {showDone && (
                    <>
                      <ul className="space-y-2">{ok.map(row)}</ul>
                      <button onClick={() => setTasks((ts) => ts.filter((t) => !(t.kind === "afazer" && t.status === "done")))} className="mt-3 text-xs text-rose-400 hover:text-rose-300">Limpar concluídos</button>
                    </>
                  )}
                </section>
              )}
            </div>
          );
        })()}
        {tab === "mercado" && <Mercado casa={casa} />}
        {tab === "estoque" && <Estoque casa={casa} />}

        {/* LEMBRETES */}
        {tab === "lembretes" && (
          <section className={`${panel} a-fade mx-auto max-w-2xl p-5`}>
            <h2 className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-4 font-bold"><Bell className="h-5 w-5 text-violet-400" /> Próximos lembretes</h2>
            {perm === "denied" && <p className="mb-3 rounded-lg bg-amber-950 p-3 text-xs text-amber-300">Notificações bloqueadas no navegador. Os avisos aparecerão só dentro do app.</p>}
            {upcoming.length === 0 ? (
              <p className="py-8 text-center text-zinc-400">Nenhum lembrete agendado.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{u.t.title}</div>
                      <div className="text-xs text-zinc-400">{u.label}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-violet-300">{fmtDT(u.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {tab === "lembretes" && <Validades casa={casa} />}
      </div></main></div>

      {tab !== "lembretes" && (
        <button onClick={newAction} aria-label="Novo" className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl shadow-black/60 transition active:scale-90 md:hidden"><Plus className="h-6 w-6" /></button>
      )}
      {/* Navegação mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-6">
          {([["home", "Início", Home], ["hoje", "Hoje", CalendarDays], ["quadro", "Quadro", LayoutDashboard], ["afazeres", "Afazeres", ClipboardList], ["estoque", "Estoque", Package], ["mercado", "Mercado", ShoppingCart]] as const).map(([id, name, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${tab === id ? "text-violet-400" : "text-zinc-500"}`}>
              <Icon className="h-5 w-5" /> {name}
            </button>
          ))}
        </div>
      </nav>

      {/* Formulário */}
      {open && (
        <div className="a-fade fixed inset-0 z-50 flex items-end justify-center bg-black/80 md:items-center" onClick={() => setOpen(false)}>
          <div className="a-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 md:max-w-lg md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-bold">{editing ? "Editar" : "Novo"} {form.kind === "afazer" ? "afazer" : "cartão"}</h3>
              <button aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {!editing && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-700 bg-zinc-800 p-1">
                  {([["card", "Cartão do quadro", LayoutDashboard], ["afazer", "Afazer da lista", Hammer]] as const).map(([k, name, Icon]) => (
                    <button key={k} onClick={() => setForm((f) => ({ ...f, kind: k, status: "todo", date: k === "afazer" ? "" : f.date || selected }))}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${(form.kind || "card") === k ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                      <Icon className="h-4 w-4" /> {name}
                    </button>
                  ))}
                </div>
              )}
              <div><label className={lbl}>Título</label><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.kind === "afazer" ? "Ex: Colocar rejunte no banheiro" : "Ex: Criar wireframe da home"} className={field} /></div>
              <div><label className={lbl}>{form.kind === "afazer" ? "Local / Cômodo" : "Projeto / Cliente"}</label><input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder={form.kind === "afazer" ? "Ex: Banheiro" : "Ex: Site Studio Aurora"} className={field} /></div>
              <div><label className={lbl}>Observações</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Detalhes, links, referências…" className={field} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Data{form.kind === "afazer" && " (opcional)"}</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />{form.kind === "afazer" && form.date && <button onClick={() => setForm({ ...form, date: "" })} className="mt-1 text-xs text-zinc-400 hover:text-violet-300">Remover data</button>}</div>
                <div><label className={lbl}>Hora</label><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={field} /></div>
              </div>

              {form.kind !== "afazer" && (<>
              <div>
                <label className={lbl}>Coluna</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {COLS.map((c) => (
                    <button key={c.id} onClick={() => setForm({ ...form, status: c.id })} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${form.status === c.id ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`}>{c.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRIO) as Priority[]).map((p) => (
                    <button key={p} onClick={() => setForm({ ...form, priority: p })} className={`rounded-lg border py-2 text-sm font-medium transition ${form.priority === p ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`}>{PRIO[p].label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {LABELS.map((l) => (
                    <button key={l.id} onClick={() => toggleIn("labels", l.id)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${l.cls} ${form.labels.includes(l.id) ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"}`}><l.Icon className="h-3.5 w-3.5" />{l.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Checklist</label>
                <ul className="mb-2 space-y-1.5">
                  {form.checklist.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm">
                      <span className="break-words">{c.text}</span>
                      <button aria-label="Remover" onClick={() => setForm({ ...form, checklist: form.checklist.filter((x) => x.id !== c.id) })} className="ml-2 text-zinc-400 hover:text-rose-400"><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newCheck.trim()) { setForm({ ...form, checklist: [...form.checklist, { id: uid(), text: newCheck.trim(), done: false }] }); setNewCheck(""); } }} placeholder="Novo item…" className={field} />
                  <button onClick={() => { if (newCheck.trim()) { setForm({ ...form, checklist: [...form.checklist, { id: uid(), text: newCheck.trim(), done: false }] }); setNewCheck(""); } }} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 text-zinc-200 hover:border-violet-500"><Plus className="h-5 w-5" /></button>
                </div>
              </div>

              </>)}
              <div>
                <label className={lbl}>Lembrar antes {!form.date && <span className="normal-case text-zinc-500">(defina uma data)</span>}</label>
                <div className="flex flex-wrap gap-2">
                  {REMINDERS.map((r) => (
                    <button key={r.id} disabled={!form.date} onClick={() => toggleIn("reminders", r.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-30 ${form.reminders.includes(r.id) ? "border-violet-500 bg-violet-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"}`}>{r.label}</button>
                  ))}
                </div>
              </div>

              <button onClick={submit} disabled={!form.title.trim()} className="w-full rounded-xl bg-violet-600 py-3.5 font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-40">
                {editing ? "Salvar alterações" : form.kind === "afazer" ? "Adicionar afazer" : "Adicionar cartão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
