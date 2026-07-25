"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCandidate, Position } from "./types";

// Персистентное хранилище позиций в localStorage. Бэкенд не нужен —
// это делает приложение системным (позиция сохраняется и к ней можно вернуться),
// оставаясь чистым фронтендом. Мутаторы читают актуальный список из ref,
// поэтому последовательные async-обновления (анализ → кандидаты) не затирают
// друг друга из-за устаревших замыканий.

const KEY = "recruiter.positions.v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadRaw(): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Position[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const ref = useRef<Position[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadRaw();
    ref.current = loaded;
    setPositions(loaded);
    setReady(true);
  }, []);

  const persist = useCallback((next: Position[]) => {
    ref.current = next;
    setPositions(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const create = useCallback(() => {
    const p = newPosition();
    persist([p, ...ref.current]);
    setCurrentId(p.id);
    return p;
  }, [persist]);

  const remove = useCallback(
    (id: string) => {
      persist(ref.current.filter((p) => p.id !== id));
      setCurrentId((c) => (c === id ? null : c));
    },
    [persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Position>) => {
      persist(
        ref.current.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
      );
    },
    [persist],
  );

  const addCandidates = useCallback(
    (id: string, cands: BoardCandidate[]) => {
      persist(
        ref.current.map((p) => {
          if (p.id !== id) return p;
          const seen = new Set(p.candidates.map((c) => (c.name + c.source).toLowerCase()));
          const fresh = cands.filter((c) => !seen.has((c.name + c.source).toLowerCase()));
          return { ...p, candidates: [...p.candidates, ...fresh], updatedAt: Date.now() };
        }),
      );
    },
    [persist],
  );

  const updateCandidate = useCallback(
    (id: string, candId: string, patch: Partial<BoardCandidate>) => {
      persist(
        ref.current.map((p) =>
          p.id === id
            ? {
                ...p,
                candidates: p.candidates.map((c) => (c.id === candId ? { ...c, ...patch } : c)),
                updatedAt: Date.now(),
              }
            : p,
        ),
      );
    },
    [persist],
  );

  const removeCandidate = useCallback(
    (id: string, candId: string) => {
      persist(
        ref.current.map((p) =>
          p.id === id
            ? { ...p, candidates: p.candidates.filter((c) => c.id !== candId), updatedAt: Date.now() }
            : p,
        ),
      );
    },
    [persist],
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
