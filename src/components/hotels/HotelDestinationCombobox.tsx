"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { HotelDestinationSuggestion } from "@/types/hotels";

export type HotelDestinationSelection = HotelDestinationSuggestion;

type Props = {
  value: HotelDestinationSelection | null;
  onChange: (value: HotelDestinationSelection | null) => void;
};

type ApiEnvelope = {
  ok?: boolean;
  data?: HotelDestinationSuggestion[];
  message?: string;
};

const QUERY_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_QUERY_CACHE_ENTRIES = 100;
const queryCache = new Map<
  string,
  { data: HotelDestinationSuggestion[]; expiresAt: number }
>();

export function HotelDestinationCombobox({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<HotelDestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (value && query === value.name) return;
    const normalized = query.trim().toLowerCase();

    if (normalized.length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const cached = queryCache.get(normalized);
      if (cached && cached.expiresAt > Date.now()) {
        setSuggestions(cached.data);
        setActiveIndex(cached.data.length ? 0 : -1);
        setOpen(true);
        return;
      }
      if (cached) queryCache.delete(normalized);

      setLoading(true);
      try {
        const response = await fetch(
          `/api/public/hotels/suggest?q=${encodeURIComponent(normalized)}&language=en`,
          { signal: controller.signal, credentials: "same-origin" },
        );
        const payload = (await response.json()) as ApiEnvelope;
        if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error("Location search failed");
        }
        queryCache.set(normalized, {
          data: payload.data,
          expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
        });
        pruneQueryCache();
        setSuggestions(payload.data);
        setActiveIndex(payload.data.length ? 0 : -1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  function select(suggestion: HotelDestinationSuggestion) {
    onChange(suggestion);
    setQuery(suggestion.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
        <MapPin aria-hidden="true" className="size-5 shrink-0 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
            Destination
          </span>
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
            }
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              onChange(null);
              if (nextQuery.trim().length < 3) {
                setSuggestions([]);
                setOpen(false);
                setLoading(false);
                setActiveIndex(-1);
              }
            }}
            onFocus={() => suggestions.length && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search city or destination"
            autoComplete="off"
            className="block w-full bg-transparent text-sm font-extrabold outline-none placeholder:text-brand-blue/45"
          />
        </span>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-brand-blue" aria-label="Searching" />
        ) : (
          <Search className="size-4 text-brand-blue/55" aria-hidden="true" />
        )}
      </label>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 max-h-72 overflow-y-auto rounded-lg border border-brand-blue/15 bg-white p-2 text-brand-navy shadow-2xl"
        >
          {suggestions.length ? (
            suggestions.map((suggestion, index) => (
              <button
                id={`${listId}-${index}`}
                key={suggestion.regionId}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(suggestion)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-bold transition ${
                  index === activeIndex ? "bg-brand-sky" : "hover:bg-brand-sky/55"
                }`}
              >
                <span>{suggestion.name}</span>
                <span className="text-xs uppercase text-brand-blue/60">
                  {suggestion.countryCode ?? suggestion.type}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-brand-blue/65">No locations found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function pruneQueryCache() {
  const now = Date.now();
  for (const [key, entry] of queryCache) {
    if (entry.expiresAt <= now) queryCache.delete(key);
  }
  while (queryCache.size > MAX_QUERY_CACHE_ENTRIES) {
    const oldest = queryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    queryCache.delete(oldest);
  }
}
