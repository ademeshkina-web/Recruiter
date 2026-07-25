"use client";

import { useCallback, useEffect, useState } from "react";
import { BoardCandidate, Position } from "./types";

// Персистентное хранилище позиций в localStorage. Бэкенд не нужен —
// это делает приложение системным (позиция сохраняется и к ней можно вернуться),
// оставаясь чистым фронтендом. При появлении БД слой заменяется точечно.

const KEY = "recruiter.positions.v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function load(): Position[] {
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

function save(positions: Position[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(positions));
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
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPositions(load());
    setReady(true);
  }, []);

  const persist = useCallback((next: Position[]) => {
    setPositions(next);
    save(next);
  }, []);

  const create = useCallback(() => {
    const p = newPosition();
    persist([p, ...positions]);
    setCurrentId(p.id);
    return p;
  }, [positions, persist]);

  const remove = useCallback(
    (id: string) => {
      persist(positions.filter((p) => p.id !== id));
      setCurrentId((c) => (c === id ? null : c));
    },
    [positions, persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Position>) => {
      persist(
        positions.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
        ),
      );
    },
    [positions, persist],
  );

  const addCandidates = useCallback(
    (id: string, cands: BoardCandidate[]) => {
      persist(
        positions.map((p) => {
          if (p.id !== id) return p;
          const existing = new Set(
            p.candidates.map((c) => (c.name + c.source).toLowerCase()),
          );
          const fresh = cands.filter(
            (c) => !existing.has((c.name + c.source).toLowerCase()),
          );
          return { ...p, candidates: [...p.candidates, ...fresh], updatedAt: Date.now() };
        }),
      );
    },
    [positions, persist],
  );

  const updateCandidate = useCallback(
    (id: string, candId: string, patch: Partial<BoardCandidate>) => {
      persist(
        positions.map((p) =>
          p.id === id
            ? {
                ...p,
                candidates: p.candidates.map((c) =>
                  c.id === candId ? { ...c, ...patch } : c,
                ),
                updatedAt: Date.now(),
              }
            : p,
        ),
      );
    },
    [positions, persist],
  );

  const removeCandidate = useCallback(
    (id: string, candId: string) => {
      persist(
        positions.map((p) =>
          p.id === id
            ? {
                ...p,
                candidates: p.candidates.filter((c) => c.id !== candId),
                updatedAt: Date.now(),
              }
            : p,
        ),
      );
    },
    [positions, persist],
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
