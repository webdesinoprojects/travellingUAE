"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArchiveRestore,
  ChevronRight,
  Folder,
  ImageOff,
  Inbox,
  Loader2,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";

import { MediaUploader } from "@/features/admin/components/MediaUploader";
import { MediaMetadataEditor } from "@/features/admin/components/MediaMetadataEditor";
import type { AdminResourceConfig, AdminResourceRow } from "@/features/admin/types";

type MediaLibraryProps = {
  config: AdminResourceConfig;
  uploadsEnabled: boolean;
};

type MediaAsset = {
  id: string;
  name: string;
  altText: string;
  folder: string;
  provider: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  url: string;
  thumbnailUrl: string;
  status: string;
};

export function MediaLibrary({ config, uploadsEnabled }: MediaLibraryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assets = useMemo<MediaAsset[]>(
    () => config.rows.map(toAsset).filter(Boolean) as MediaAsset[],
    [config.rows],
  );
  const editingAsset = assets.find((asset) => asset.id === editingId) ?? null;

  function buildUrl(next: URLSearchParams) {
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = new URLSearchParams();
    const q = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    const status = (form.elements.namedItem("status") as HTMLSelectElement).value;
    const folder = (form.elements.namedItem("folder") as HTMLInputElement).value.trim();

    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (folder) next.set("folder", folder);
    router.push(buildUrl(next));
  }

  function resetFilters() {
    router.push(pathname);
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this media asset? The provider file is kept; public pages stop using it.")) {
      return;
    }
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/admin/resources/media/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean }
        | null;
      if (!response.ok || payload?.ok !== true) {
        throw new Error("archive-failed");
      }
      router.refresh();
    } catch {
      setError("Could not archive this asset. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function restore(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/admin/media/${id}/restore`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean }
        | null;
      if (!response.ok || payload?.ok !== true) {
        throw new Error("restore-failed");
      }
      router.refresh();
    } catch {
      setError("Could not restore this asset. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const currentQ = params.get("q") ?? "";
  const currentStatus = params.get("status") ?? "";
  const currentFolder = params.get("folder") ?? "";
  const hasCursor = params.has("cursor");
  const nextCursor = config.pageInfo?.nextCursor ?? null;
  const hasMore = config.pageInfo?.hasMore ?? false;
  const nextUrl = (() => {
    if (!nextCursor) return null;
    const next = new URLSearchParams(params.toString());
    next.set("cursor", nextCursor);
    return buildUrl(next);
  })();

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-[#d7c5ad] bg-brand-navy p-5 text-white shadow-[0_22px_70px_rgb(7_23_57/0.16)] dark:border-white/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-widest text-brand-sand">
              Media library
            </p>
            <h1 className="mt-3 font-serif text-3xl font-black tracking-tight sm:text-4xl">
              {config.title || "Media"}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#c2e8ff] sm:text-base">
              Upload, search and manage approved images. Archive removes assets
              from public surfaces without deleting the provider file.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              disabled={!uploadsEnabled}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-sand px-4 text-sm font-black text-brand-navy shadow-[0_12px_30px_rgb(0_0_0/0.2)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload aria-hidden="true" className="size-4" />
              Upload media
            </button>
          </div>
        </div>
        {!uploadsEnabled ? (
          <p className="mt-4 inline-flex items-start gap-2 rounded-lg border border-amber-200/40 bg-amber-50/10 px-3 py-2 text-xs font-bold text-amber-200">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ImageKit upload is not configured. Set IMAGEKIT_PUBLIC_KEY,
            IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT to enable uploads.
          </p>
        ) : null}
      </section>

      <form
        onSubmit={applyFilters}
        role="search"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-3 shadow-[0_4px_20px_rgb(7_23_57/0.05)] dark:border-white/10 dark:bg-white/[0.06]"
      >
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10">
          <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            name="q"
            type="search"
            defaultValue={currentQ}
            placeholder="Search alt text, file id, folder"
            aria-label="Search media"
            className="flex-1 bg-transparent text-sm text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10">
          <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <select
            name="status"
            defaultValue={currentStatus}
            aria-label="Filter by status"
            className="bg-transparent text-sm font-bold text-brand-navy outline-none dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10">
          <Folder aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            name="folder"
            type="text"
            defaultValue={currentFolder}
            placeholder="Folder"
            aria-label="Filter by folder"
            className="w-32 bg-transparent text-sm font-bold text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
        >
          Apply
        </button>
        {currentQ || currentStatus || currentFolder || hasCursor ? (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-9 items-center rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-brand-sand"
          >
            Reset
          </button>
        ) : null}
      </form>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              pending={pendingId === asset.id}
              onEdit={() => setEditingId(asset.id)}
              onArchive={() => archive(asset.id)}
              onRestore={() => restore(asset.id)}
            />
          ))}
        </ul>
      )}

      <nav className="flex flex-wrap items-center justify-end gap-2">
        {hasCursor ? (
          <Link
            href={pathname}
            className="inline-flex min-h-9 items-center rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-brand-sand"
          >
            ← First page
          </Link>
        ) : null}
        {hasMore && nextUrl ? (
          <Link
            href={nextUrl}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-brown hover:text-brand-navy dark:bg-white/10 dark:text-brand-sand"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </nav>

      {uploadOpen ? (
        <MediaUploader onClose={() => setUploadOpen(false)} />
      ) : null}

      {editingAsset ? (
        <MediaMetadataEditor
          asset={{
            id: editingAsset.id,
            altText: editingAsset.altText,
            folder: editingAsset.folder,
            status: editingAsset.status,
          }}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </div>
  );
}

function MediaCard({
  asset,
  pending,
  onEdit,
  onArchive,
  onRestore,
}: {
  asset: MediaAsset;
  pending: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const archived = asset.status === "archived";
  const titleId = useId();
  const altText = asset.altText || asset.name;
  const showImage = Boolean(asset.thumbnailUrl);

  return (
    <li
      aria-labelledby={titleId}
      className="grid min-w-0 gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-3 shadow-[0_8px_24px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#f2e7d3] dark:bg-white/[0.08]">
        {showImage ? (
          <Image
            src={asset.thumbnailUrl}
            alt={altText}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="grid h-full place-items-center text-brand-brown">
            <ImageOff aria-hidden="true" className="size-8" />
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
            archived
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {archived ? "Archived" : asset.status}
        </span>
      </div>

      <div className="min-w-0">
        <p
          id={titleId}
          className="truncate text-sm font-extrabold text-brand-navy dark:text-white"
        >
          {asset.name}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-brand-brown">
          {asset.altText || "No alt text"}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-semibold text-brand-brown">
          <div>
            <dt className="uppercase tracking-widest">Provider</dt>
            <dd className="truncate font-bold text-brand-navy dark:text-white">
              {asset.provider}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-widest">Folder</dt>
            <dd className="truncate font-bold text-brand-navy dark:text-white">
              {asset.folder || "—"}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-widest">Size</dt>
            <dd className="truncate font-bold text-brand-navy dark:text-white">
              {asset.bytes > 0 ? formatBytes(asset.bytes) : "—"}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-widest">Dimensions</dt>
            <dd className="truncate font-bold text-brand-navy dark:text-white">
              {asset.width > 0 && asset.height > 0
                ? `${asset.width} × ${asset.height}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy hover:text-brand-blue disabled:opacity-50 dark:bg-white/10 dark:text-brand-sand"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Edit
        </button>
        {archived ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-blue px-3 text-xs font-black text-white hover:bg-brand-blue-strong disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <ArchiveRestore aria-hidden="true" className="size-3.5" />
            )}
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
            Archive
          </button>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-[#d7c5ad] bg-white/78 p-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
      <Inbox aria-hidden="true" className="mb-3 size-8 text-brand-brown" />
      <p className="text-sm font-black text-brand-brown">No media assets.</p>
      <p className="mt-1 max-w-md text-xs font-semibold text-brand-brown">
        Upload approved images through the Upload button. Filters can also be
        adjusted above.
      </p>
    </div>
  );
}

function toAsset(row: AdminResourceRow): MediaAsset | null {
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "Asset",
    altText: typeof row.altText === "string" ? row.altText : "",
    folder: typeof row.folder === "string" ? row.folder : "",
    provider: typeof row.provider === "string" ? row.provider : "",
    width: typeof row.width === "number" ? row.width : 0,
    height: typeof row.height === "number" ? row.height : 0,
    bytes: typeof row.bytes === "number" ? row.bytes : 0,
    format: typeof row.format === "string" ? row.format : "",
    url: typeof row.url === "string" ? row.url : "",
    thumbnailUrl: typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : "",
    status: typeof row.status === "string" ? row.status : "published",
  };
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
