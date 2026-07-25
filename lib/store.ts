"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCandidate, Position } from "./types";

// Серверное хранилище позиций (per-user). Загружается по /api/positions,
// изменения пишутся на сервер (PUT/DELETE). Локальное состояние обновляется
// оптимистично; ref держит актуальный список, чтобы последовательные
// async-мутации не затирали друг друга.

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newPosition(title = "Новая позиция"): Position {
  const now = Date.now();
  return {
    id: uid(),
    title,
    company: "",
    role: "",
    brief: "",
    analyze: null,
    sourced: null,
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function savePosition(p: Position) {
  try {
    await fetch("/api/positions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: p }),
    });
  } catch {
    /* оффлайн — локальное состояние сохраняется, синхронизируется позже */
  }
}

async function deletePositionReq(id: string) {
  try {
    await fetch(`/api/positions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* noop */
  }
}

export function usePositions(authed: boolean) {
  const [positions, setPositions] = useState<Position[]>([]);
  const ref = useRef<Position[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const setLocal = useCallback((next: Position[]) => {
    ref.current = next;
    setPositions(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!authed) {
      setLocal([]);
      setCurrentId(null);
      setReady(false);
      return;
    }
    setReady(false);
    fetch("/api/positions")
      .then((r) => (r.ok ? r.json() : { positions: [] }))
      .then((d) => {
        if (cancelled) return;
        setLocal(d.positions || []);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLocal([]);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authed, setLocal]);

  // Применить изменение к позиции id, сохранить локально и на сервере.
  const patchAndSave = useCallback(
    (id: string, fn: (p: Position) => Position) => {
      let changed: Position | null = null;
      const next = ref.current.map((p) => {
        if (p.id !== id) return p;
        changed = { ...fn(p), updatedAt: Date.now() };
        return changed;
      });
      setLocal(next);
      if (changed) savePosition(changed);
    },
    [setLocal],
  );

  const create = useCallback(() => {
    const p = newPosition();
    setLocal([p, ...ref.current]);
    setCurrentId(p.id);
    savePosition(p);
    return p;
  }, [setLocal]);

  const remove = useCallback(
    (id: string) => {
      setLocal(ref.current.filter((p) => p.id !== id));
      setCurrentId((c) => (c === id ? null : c));
      deletePositionReq(id);
    },
    [setLocal],
  );

  const update = useCallback(
    (id: string, patch: Partial<Position>) => patchAndSave(id, (p) => ({ ...p, ...patch })),
    [patchAndSave],
  );

  const addCandidates = useCallback(
    (id: string, cands: BoardCandidate[]) =>
      patchAndSave(id, (p) => {
        const seen = new Set(p.candidates.map((c) => (c.name + c.source).toLowerCase()));
        const fresh = cands.filter((c) => !seen.has((c.name + c.source).toLowerCase()));
        return { ...p, candidates: [...p.candidates, ...fresh] };
      }),
    [patchAndSave],
  );

  const updateCandidate = useCallback(
    (id: string, candId: string, patch: Partial<BoardCandidate>) =>
      patchAndSave(id, (p) => ({
        ...p,
        candidates: p.candidates.map((c) => (c.id === candId ? { ...c, ...patch } : c)),
      })),
    [patchAndSave],
  );

  const removeCandidate = useCallback(
    (id: string, candId: string) =>
      patchAndSave(id, (p) => ({
        ...p,
        candidates: p.candidates.filter((c) => c.id !== candId),
      })),
    [patchAndSave],
  );

  const current = positions.find((p) => p.id === currentId) || null;

  return {
    ready,
    positions,
    current,
    setCurrentId,
    create,
    remove,
    update,
    addCandidates,
    updateCandidate,
    removeCandidate,
  };
}
