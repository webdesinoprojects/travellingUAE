"use client";

import { Loader2, MapPinned, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { getCountryFlagDisplay } from "@/components/esim/country-flag";
import type { AirhubPublicCountry } from "@/server/providers/airhub/contracts";

import {
  HERO_ESIM_SUGGESTION_LIMIT,
  buildHeroEsimCountryHref,
  filterHeroEsimCountries,
  readHeroEsimCountriesResponse,
} from "./hero-esim-search";

type LoadState = "idle" | "loading" | "ready" | "error";

export function HeroEsimSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const validationId = useId();
  const [countries, setCountries] = useState<AirhubPublicCountry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] =
    useState<AirhubPublicCountry | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [validation, setValidation] = useState("");
  const [failedFlags, setFailedFlags] = useState<Record<string, true>>({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadCountries() {
      setLoadState("loading");

      try {
        const response = await fetch("/api/public/esim/countries?limit=250", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load eSIM countries.");
        }

        const payload: unknown = await response.json();
        setCountries(readHeroEsimCountriesResponse(payload));
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCountries([]);
        setLoadState("error");
      }
    }

    void loadCountries();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const suggestions = useMemo(
    () =>
      filterHeroEsimCountries(
        countries,
        query,
        HERO_ESIM_SUGGESTION_LIMIT,
      ),
    [countries, query],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCountry) {
      setValidation(getMissingSelectionMessage(loadState, countries.length));
      setIsOpen(true);
      return;
    }

    router.push(buildHeroEsimCountryHref(selectedCountry.isoCode));
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedCountry(null);
    setValidation("");
    setIsOpen(true);
  }

  function handleSelect(country: AirhubPublicCountry) {
    setSelectedCountry(country);
    setQuery(country.name);
    setValidation("");
    setIsOpen(false);
  }

  function handleFlagError(countryCode: string) {
    setFailedFlags((current) =>
      current[countryCode] ? current : { ...current, [countryCode]: true },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search eSIM countries"
      className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div ref={containerRef} className="relative min-w-0">
        <label className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
          <MapPinned aria-hidden="true" className="size-5 text-brand-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
              Coverage
            </span>
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={isOpen}
              aria-invalid={validation ? true : undefined}
              aria-describedby={validation ? validationId : undefined}
              autoComplete="off"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search country"
              className="block w-full bg-transparent text-sm font-extrabold outline-none placeholder:text-brand-blue/50"
            />
          </span>
        </label>

        {isOpen ? (
          <CountrySuggestions
            id={listboxId}
            loadState={loadState}
            countriesCount={countries.length}
            suggestions={suggestions}
            failedFlags={failedFlags}
            onSelect={handleSelect}
            onFlagError={handleFlagError}
          />
        ) : null}

        {validation ? (
          <p
            id={validationId}
            className="mt-2 text-sm font-bold text-rose-100"
            aria-live="polite"
          >
            {validation}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
      >
        <Search aria-hidden="true" className="size-4" />
        Find eSIM plans
      </button>
    </form>
  );
}

function CountrySuggestions({
  id,
  loadState,
  countriesCount,
  suggestions,
  failedFlags,
  onSelect,
  onFlagError,
}: {
  id: string;
  loadState: LoadState;
  countriesCount: number;
  suggestions: AirhubPublicCountry[];
  failedFlags: Record<string, true>;
  onSelect: (country: AirhubPublicCountry) => void;
  onFlagError: (countryCode: string) => void;
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="eSIM country suggestions"
      className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-[min(70vh,360px)] overflow-y-auto rounded-lg border border-brand-blue/10 bg-white p-2 text-brand-navy shadow-2xl"
    >
      {loadState === "loading" || loadState === "idle" ? (
        <SuggestionMessage>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Loading eSIM countries...
        </SuggestionMessage>
      ) : loadState === "error" ? (
        <SuggestionMessage>
          Could not load eSIM countries. Please try again.
        </SuggestionMessage>
      ) : countriesCount === 0 ? (
        <SuggestionMessage>
          eSIM countries are syncing. Please try again shortly.
        </SuggestionMessage>
      ) : suggestions.length === 0 ? (
        <SuggestionMessage>No eSIM countries match your search.</SuggestionMessage>
      ) : (
        suggestions.map((country) => (
          <CountrySuggestion
            key={country.isoCode}
            country={country}
            flagFailed={Boolean(failedFlags[country.isoCode])}
            onSelect={() => onSelect(country)}
            onFlagError={() => onFlagError(country.isoCode)}
          />
        ))
      )}
    </div>
  );
}

function CountrySuggestion({
  country,
  flagFailed,
  onSelect,
  onFlagError,
}: {
  country: AirhubPublicCountry;
  flagFailed: boolean;
  onSelect: () => void;
  onFlagError: () => void;
}) {
  const flagDisplay = getCountryFlagDisplay({
    isoCode: country.isoCode,
    countryName: country.name,
    flagUrl: country.flagUrl,
    imageFailed: flagFailed,
  });

  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onSelect}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left transition hover:bg-brand-sky/70 focus:bg-brand-sky/70 focus:outline-none"
    >
      <CountryFlag display={flagDisplay} onImageError={onFlagError} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">
          {country.name}
        </span>
        <span className="block text-xs font-bold uppercase text-brand-blue/65">
          {country.isoCode}
        </span>
      </span>
    </button>
  );
}

function CountryFlag({
  display,
  onImageError,
}: {
  display: ReturnType<typeof getCountryFlagDisplay>;
  onImageError: () => void;
}) {
  if (display.kind === "image") {
    return (
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-soft bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- Airhub returns remote SVG flag URLs; use img to avoid next/image remote SVG config. */}
        <img
          src={display.src}
          alt={display.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={onImageError}
        />
      </span>
    );
  }

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-sky text-xs font-black text-brand-navy">
      {display.label}
    </span>
  );
}

function SuggestionMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-bold text-brand-navy/65">
      {children}
    </div>
  );
}

function getMissingSelectionMessage(loadState: LoadState, countriesCount: number) {
  if (loadState === "loading" || loadState === "idle") {
    return "eSIM countries are still loading.";
  }

  if (loadState === "error") {
    return "Could not load eSIM countries. Please try again.";
  }

  if (countriesCount === 0) {
    return "eSIM countries are syncing. Please try again shortly.";
  }

  return "Please select a country.";
}
