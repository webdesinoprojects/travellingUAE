"use client";

import { Check, Eye, EyeOff, Loader2, Pencil, Star } from "lucide-react";
import { useState } from "react";

import type { AdminCountryItem } from "@/features/admin/esim/visibility-types";

import { CountryFlag, FeaturedBadge, VisibilityBadge } from "./EsimVisibilityBits";
import { useControlSave } from "./use-control-save";

export function EsimCountryRow({ country }: { country: AdminCountryItem }) {
  const { state, message, save } = useControlSave();
  const [open, setOpen] = useState(false);

  // Optimistic toggle state, reconciled with the server value after refresh via
  // the "adjust state during render" pattern (no effect, no cascading render).
  const [visible, setVisible] = useState(country.isVisible);
  const [featured, setFeatured] = useState(country.isFeatured);
  const [serverState, setServerState] = useState({
    visible: country.isVisible,
    featured: country.isFeatured,
  });
  if (serverState.visible !== country.isVisible || serverState.featured !== country.isFeatured) {
    setServerState({ visible: country.isVisible, featured: country.isFeatured });
    setVisible(country.isVisible);
    setFeatured(country.isFeatured);
  }

  const [override, setOverride] = useState(country.displayNameOverride ?? "");
  const [sortOrder, setSortOrder] = useState(String(country.sortOrder));

  const controlIsoCode = country.controlIsoCode || country.isoCode;
  const url = `/api/admin/esim/countries/${encodeURIComponent(controlIsoCode)}`;
  const busy = state === "saving";

  async function toggleVisible() {
    const next = !visible;
    setVisible(next);
    const ok = await save(url, { isVisible: next });
    if (!ok) setVisible(!next);
  }

  async function toggleFeatured() {
    const next = !featured;
    setFeatured(next);
    const ok = await save(url, { isFeatured: next });
    if (!ok) setFeatured(!next);
  }

  function cancelEdit() {
    setOverride(country.displayNameOverride ?? "");
    setSortOrder(String(country.sortOrder));
    setOpen(false);
  }

  async function saveDetails() {
    const ok = await save(url, {
      displayNameOverride: override.trim() || null,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    });
    if (ok) setOpen(false);
  }

  return (
    <li className="rounded-lg border border-[#e4d6bf] bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CountryFlag
            isoCode={country.isoCode}
            countryName={country.providerName}
            flagUrl={country.flagUrl}
          />
          <div className="min-w-0">
            <p className="truncate font-black">{country.displayName}</p>
            <p className="truncate text-xs text-brand-brown">
              {country.isoCode}
              {controlIsoCode !== country.isoCode ? ` / stored: ${controlIsoCode}` : ""}
              {country.displayNameOverride ? ` · provider: ${country.providerName}` : ""}
              {country.regionName ? ` · ${country.regionName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <VisibilityBadge isVisible={visible} />
              <FeaturedBadge isFeatured={featured} />
              <span className="text-xs font-bold text-brand-brown">Sort {country.sortOrder}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleVisible()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleFeatured()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            <Star className="size-4" />
            {featured ? "Unfeature" : "Feature"}
          </button>
          <button
            type="button"
            onClick={() => (open ? cancelEdit() : setOpen(true))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy dark:bg-white/10 dark:text-white"
            aria-expanded={open}
          >
            <Pencil className="size-4" />
            Edit
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-[#efe3cf] pt-4 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name override">
              <input
                value={override}
                onChange={(event) => setOverride(event.target.value)}
                maxLength={120}
                placeholder={country.providerName}
                className={inputClass}
              />
            </Field>
            <Field label="Sort order">
              <input
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDetails()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : state === "saved" ? (
                <Check className="size-4" />
              ) : null}
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-white px-5 text-sm font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
            >
              Cancel
            </button>
            {message ? (
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{message}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">{label}</span>
      {children}
    </label>
  );
}
