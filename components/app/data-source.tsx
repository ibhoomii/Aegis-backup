"use client";

// Client-side data-source switch.
//
// The whole console renders from one active `Dataset`. By default that's the
// built-in `demoDataset`; if the user has ingested their own logs (via
// /connect) we persist the resulting dataset to localStorage and swap it in.
//
// Hydration safety: server render and first client render both use the demo
// (matching markup), then a mount effect reads localStorage and swaps in the
// user dataset if one was selected. This is the same post-mount pattern
// next-themes uses, so there's no hydration mismatch. `hydrated` lets pages
// that care (e.g. the incident workspace) hold off on "not found" verdicts
// until the real dataset is in place.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoDataset, type Dataset } from "@/lib/dataset";

export const SOURCE_KEY = "aegis:source";
export const DATASET_KEY = "aegis:dataset";

type SourceKind = "demo" | "user";

type DataSourceValue = {
  dataset: Dataset;
  source: SourceKind;
  meta: Dataset["meta"];
  hydrated: boolean;
  loadUserDataset: (ds: Dataset) => void;
  useDemo: () => void;
  clearUser: () => void;
};

const DataSourceContext = createContext<DataSourceValue | null>(null);

// Cheap structural check before trusting a JSON blob from localStorage — it
// could be stale from an older schema or hand-edited. We don't validate deeply;
// the accessors in lib/dataset are all null-safe, so a shape with the core
// arrays present is enough to render.
function isDataset(v: unknown): v is Dataset {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.meta === "object" &&
    d.meta !== null &&
    Array.isArray(d.incidents) &&
    Array.isArray(d.kpis) &&
    Array.isArray(d.eventPool)
  );
}

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(demoDataset);
  const [source, setSource] = useState<SourceKind>("demo");
  const [hydrated, setHydrated] = useState(false);

  // Post-mount: restore a persisted user dataset if the user picked "your data".
  useEffect(() => {
    try {
      const storedSource = localStorage.getItem(SOURCE_KEY);
      if (storedSource === "user") {
        const raw = localStorage.getItem(DATASET_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isDataset(parsed)) {
            setDataset(parsed);
            setSource("user");
          }
        }
      }
    } catch {
      // Corrupt/oversized storage — fall back to the demo silently.
    }
    setHydrated(true);
  }, []);

  function loadUserDataset(ds: Dataset) {
    setDataset(ds);
    setSource("user");
    try {
      localStorage.setItem(SOURCE_KEY, "user");
      localStorage.setItem(DATASET_KEY, JSON.stringify(ds));
    } catch {
      // Over quota (large logs) — the dataset still lives in memory for this
      // session; it just won't survive a refresh.
    }
  }

  function useDemo() {
    setDataset(demoDataset);
    setSource("demo");
    try {
      localStorage.setItem(SOURCE_KEY, "demo");
    } catch {
      /* ignore */
    }
  }

  function clearUser() {
    setDataset(demoDataset);
    setSource("demo");
    try {
      localStorage.setItem(SOURCE_KEY, "demo");
      localStorage.removeItem(DATASET_KEY);
    } catch {
      /* ignore */
    }
  }

  const value = useMemo<DataSourceValue>(
    () => ({
      dataset,
      source,
      meta: dataset.meta,
      hydrated,
      loadUserDataset,
      useDemo,
      clearUser,
    }),
    [dataset, source, hydrated],
  );

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSourceValue {
  const ctx = useContext(DataSourceContext);
  if (!ctx) {
    throw new Error("useDataSource must be used within a DataSourceProvider");
  }
  return ctx;
}

// Convenience reader for pages that only need the data, not the controls.
export function useDataset(): Dataset {
  return useDataSource().dataset;
}

// Write the source preference from a page that lives OUTSIDE the provider
// (e.g. /start, which uses the site chrome, not the app shell). The provider
// picks this up on its next mount.
export function setSourcePreference(source: SourceKind) {
  try {
    localStorage.setItem(SOURCE_KEY, source);
    if (source === "demo") localStorage.removeItem(DATASET_KEY);
  } catch {
    /* ignore */
  }
}
