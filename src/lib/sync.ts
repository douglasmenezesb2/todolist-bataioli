// Keeps a list in React state and mirrors every change to a Lovable Cloud table.
// Callers keep using setItems(prev => next) as before; the diff is written in order.
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
type Row = Record<string, unknown>;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

function isDuplicate(e: { code?: string } | null) {
  return e?.code === "23505";
}

function useLiveRefetch(table: string, refetch: () => void) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer);
        timer = setTimeout(refetch, 250);
      })
      .subscribe();
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      db.removeChannel(channel);
    };
  }, [table, refetch]);
}

export function useSyncedTable<T extends { id: string }>(table: string, toRow: (t: T) => Row, fromRow: (r: Row) => T) {
  const [items, setState] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  // Counts edits made on this device (not ones arriving from other people).
  const [localVersion, setLocalVersion] = useState(0);
  const ref = useRef<T[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const stale = useRef(false);
  const conv = useRef({ toRow, fromRow });
  conv.current = { toRow, fromRow };

  const refetch = useCallback(async () => {
    if (pending.current > 0) { stale.current = true; return; }
    const { data, error } = await db.from(table).select("*").order("created_at").order("id");
    if (error) { toast.error("Não foi possível carregar os dados. Verifique sua conexão."); return; }
    if (pending.current > 0) { stale.current = true; return; }
    const next = (data ?? []).map((r: Row) => conv.current.fromRow(r));
    ref.current = next;
    setState(next);
    setReady(true);
  }, [table]);

  useEffect(() => { void refetch(); }, [refetch]);
  useLiveRefetch(table, refetch);

  const setItems = useCallback((upd: SetStateAction<T[]>) => {
    const prev = ref.current;
    const next = typeof upd === "function" ? (upd as (p: T[]) => T[])(prev) : upd;
    if (next === prev) return;
    ref.current = next;
    setState(next);
    setLocalVersion((v) => v + 1);
    const before = new Map(prev.map((x) => [x.id, x]));
    const ids = new Set(next.map((x) => x.id));
    const changed = next.filter((x) => before.get(x.id) !== x).map((x) => conv.current.toRow(x));
    const removed = prev.filter((x) => !ids.has(x.id)).map((x) => x.id);
    if (!changed.length && !removed.length) return;
    pending.current++;
    queue.current = queue.current.then(async () => {
      let failed = false;
      if (removed.length) {
        const { error } = await db.from(table).delete().in("id", removed);
        if (error) failed = true;
      }
      if (changed.length) {
        const { error } = await db.from(table).upsert(changed, { onConflict: "id" });
        if (error) { failed = true; if (!isDuplicate(error)) toast.error("Não foi possível salvar. Tente de novo."); }
      }
      pending.current--;
      if (pending.current === 0 && (failed || stale.current)) { stale.current = false; await refetch(); }
    });
  }, [table, refetch]);

  return { items, setItems, ready, localVersion };
}

export type HouseSettings = { auto: boolean; skip: string[] };

export function useHouseSettings() {
  const [s, setS] = useState<HouseSettings>({ auto: true, skip: [] });
  const [ready, setReady] = useState(false);
  const ref = useRef(s);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const refetch = useCallback(async () => {
    if (pending.current > 0) return;
    const { data, error } = await db.from("house_settings").select("auto, skip").eq("id", 1).maybeSingle();
    if (error || !data || pending.current > 0) return;
    const next = { auto: !!data.auto, skip: (data.skip as string[]) ?? [] };
    ref.current = next;
    setS(next);
    setReady(true);
  }, []);
  useEffect(() => { void refetch(); }, [refetch]);
  useLiveRefetch("house_settings", refetch);

  const update = useCallback((patch: (p: HouseSettings) => Partial<HouseSettings>) => {
    const p = patch(ref.current);
    const next = { ...ref.current, ...p };
    ref.current = next;
    setS(next);
    pending.current++;
    queue.current = queue.current.then(async () => {
      const { error } = await db.from("house_settings").update(p).eq("id", 1);
      if (error) toast.error("Não foi possível salvar. Tente de novo.");
      pending.current--;
    });
  }, []);

  const setAuto = useCallback((v: SetStateAction<boolean>) =>
    update((p) => ({ auto: typeof v === "function" ? v(p.auto) : v })), [update]);
  const setSkip = useCallback((v: SetStateAction<string[]>) =>
    update((p) => ({ skip: typeof v === "function" ? v(p.skip) : v })), [update]);

  return { auto: s.auto, skip: s.skip, setAuto, setSkip, ready };
}
