"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Loader2, Search, Trash2, X } from "lucide-react";

/**
 * Image field with a "Select from Media" library picker + URL fallback + live
 * preview + clear. Validates against the same safe hosts the public page allows
 * (local path or ik.imagekit.io / images.unsplash.com / res.cloudinary.com), so
 * a bad URL is flagged in the admin instead of breaking the public page.
 */

const SAFE_HOSTS = new Set(["ik.imagekit.io", "images.unsplash.com", "res.cloudinary.com"]);

function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true; // empty is allowed (optional field)
  if (v.startsWith("/")) return true;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && SAFE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

type MediaAsset = { id: string; url: string; altText?: string | null; filename?: string | null };

export function VisaMediaField({
  label,
  value,
  altValue,
  onChange,
  onAltChange,
}: {
  label: string;
  value: string;
  altValue: string;
  onChange: (url: string) => void;
  onAltChange: (alt: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const safe = isSafeImageUrl(value);
  const showPreview = value.trim() !== "" && safe && !broken;

  return (
    <div className="grid gap-2 rounded-lg border border-border-soft bg-surface-muted/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-brand-brown">{label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-brand-navy px-2.5 text-xs font-black text-white dark:bg-brand-sand dark:text-brand-navy"
          >
            <ImageIcon className="size-3.5" aria-hidden="true" />
            Select
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setBroken(false);
              }}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-2.5 text-xs font-black text-brand-navy dark:bg-white/10 dark:text-white"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Preview */}
        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg border border-border-soft bg-white sm:w-36 dark:bg-white/[0.04]">
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary media URL
            <img
              src={value}
              alt={altValue || label}
              className="h-full w-full object-cover"
              onLoad={() => setBroken(false)}
              onError={() => setBroken(true)}
            />
          ) : (
            <div className="grid h-full place-items-center text-center text-[11px] font-bold text-brand-brown/70">
              {value && !safe ? "Unsafe host" : value && broken ? "Image not loading" : "No image"}
            </div>
          )}
        </div>

        <div className="grid flex-1 gap-2">
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setBroken(false);
            }}
            placeholder="/local.png or https://ik.imagekit.io/…"
            className="min-h-10 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
          />
          {!safe ? (
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              Use a local path or ik.imagekit.io / images.unsplash.com / res.cloudinary.com.
            </span>
          ) : null}
          <input
            value={altValue}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="Alt text (describe the image)"
            className="min-h-10 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
          />
        </div>
      </div>

      {pickerOpen ? (
        <MediaPickerModal
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            onChange(url);
            setBroken(false);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MediaPickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (url: string) => void }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: "published", limit: "48" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: { media?: MediaAsset[] } } | null;
      if (!res.ok || data?.ok !== true || !data.data?.media) throw new Error("load-failed");
      setAssets(data.data.media.filter((a) => isSafeImageUrl(a.url)));
    } catch {
      setError("Media could not be loaded. You can still paste a URL.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the media library once when the picker opens (fetch-on-mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void load("");
  }, [load]);

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Select image">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border-soft bg-background shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-soft p-4">
          <h3 className="text-base font-black">Select from Media</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="border-b border-border-soft p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(query);
            }}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 dark:bg-surface-muted"
          >
            <Search className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search media"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </form>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-12 text-brand-brown">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm font-bold text-brand-brown">{error}</p>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-brand-brown">
              No media found. Upload images from the Media admin, then select here — or paste a URL.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset.url)}
                  className="group overflow-hidden rounded-lg border border-border-soft bg-white transition hover:border-brand-blue dark:bg-white/[0.04]"
                >
                  <span className="block aspect-[4/3] overflow-hidden bg-surface-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- media library thumbnail */}
                    <img src={asset.url} alt={asset.altText ?? ""} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
