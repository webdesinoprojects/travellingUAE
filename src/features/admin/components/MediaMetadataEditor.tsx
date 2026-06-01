"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

type EditableMedia = {
  id: string;
  altText: string;
  folder: string;
  status: string;
};

type MediaMetadataEditorProps = {
  asset: EditableMedia;
  onClose: () => void;
};

const FOLDER_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,119}$/;

export function MediaMetadataEditor({
  asset,
  onClose,
}: MediaMetadataEditorProps) {
  const router = useRouter();
  const titleId = useId();
  const [altText, setAltText] = useState(asset.altText);
  const [folder, setFolder] = useState(asset.folder);
  const [status, setStatus] = useState<string>(asset.status);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && saveState !== "saving") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saveState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedAlt = altText.trim();
    if (trimmedAlt.length < 4) {
      setError("Alt text must be at least 4 characters.");
      return;
    }

    const trimmedFolder = folder.trim();
    if (trimmedFolder && !FOLDER_RE.test(trimmedFolder)) {
      setError("Folder name is invalid.");
      return;
    }

    setSaveState("saving");
    try {
      const response = await fetch(`/api/admin/resources/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altText: trimmedAlt,
          folder: trimmedFolder || undefined,
          status,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean }
        | null;

      if (!response.ok || payload?.ok !== true) {
        setSaveState("error");
        setError("Could not save. Please check the values and try again.");
        return;
      }

      setSaveState("saved");
      router.refresh();
      setTimeout(() => onClose(), 600);
    } catch {
      setSaveState("error");
      setError("An unexpected error occurred.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div className="relative grid w-full max-w-md gap-4 rounded-lg border border-[#d7c5ad] bg-white p-5 text-brand-navy shadow-2xl dark:border-white/10 dark:bg-[#0d0d0d] dark:text-white">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
              Media metadata
            </p>
            <h2 id={titleId} className="font-serif text-2xl font-black">
              Edit asset
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveState === "saving"}
            aria-label="Close editor"
            className="grid size-9 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="grid gap-1 text-xs font-extrabold uppercase tracking-widest text-brand-brown">
            Alt text *
            <input
              type="text"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={240}
              required
              className="min-h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60"
            />
          </label>

          <label className="grid gap-1 text-xs font-extrabold uppercase tracking-widest text-brand-brown">
            Folder
            <input
              type="text"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              maxLength={120}
              className="min-h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60"
            />
          </label>

          <label className="grid gap-1 text-xs font-extrabold uppercase tracking-widest text-brand-brown">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-bold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              <option value="published">Published</option>
              <option value="archived">Archived</option>
              <option value="draft">Draft</option>
            </select>
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saveState === "saving"}
              className="inline-flex min-h-10 items-center rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-brown disabled:opacity-50 dark:bg-white/10 dark:text-brand-sand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-black text-white hover:bg-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
            >
              {saveState === "saving" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : saveState === "saved" ? (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              ) : null}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
