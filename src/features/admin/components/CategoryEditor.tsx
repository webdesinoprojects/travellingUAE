"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

export type CategoryEditorData = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  sortOrder?: number | null;
  status?: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

export function CategoryEditor({ initial = {} }: { initial?: CategoryEditorData }) {
  const router = useRouter();
  const isNew = !initial.id;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const body: Record<string, unknown> = {
      name: data.get("name") || undefined,
      slug: data.get("slug") || undefined,
      description: data.get("description") || undefined,
      status: data.get("status") || "draft",
    };

    const sortOrder = data.get("sortOrder");
    if (sortOrder) body.sortOrder = Number(sortOrder);

    try {
      const url = isNew
        ? "/api/admin/resources/categories"
        : `/api/admin/resources/categories/${initial.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { row?: { id?: string } };
      } | null;

      if (!res.ok || payload?.ok !== true) {
        setSaveState("error");
        setErrorMsg("The category could not be saved. Check required fields.");
        return;
      }

      setSaveState("success");

      if (isNew) {
        const newId = payload.data?.row?.id;
        router.push(newId ? `/admin/categories/${newId}` : "/admin/categories");
      } else {
        router.refresh();
      }
    } catch {
      setSaveState("error");
      setErrorMsg("An unexpected error occurred.");
    }
  }

  async function handleArchive() {
    if (!initial.id) return;

    setSaveState("saving");

    try {
      const res = await fetch(`/api/admin/resources/categories/${initial.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setSaveState("error");
        setErrorMsg("The category could not be archived.");
        return;
      }

      router.push("/admin/categories");
    } catch {
      setSaveState("error");
      setErrorMsg("An unexpected error occurred.");
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="mb-1 text-lg font-black">
        {isNew ? "New category" : "Edit category"}
      </h2>
      <p className="mb-5 text-sm font-semibold text-brand-brown">
        {isNew
          ? "Create a category or tag for grouping trips. Set status to draft until ready."
          : "Update this category. Published categories appear in public trip filters."}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={initial.name ?? ""}
              required
              maxLength={120}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="slug"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Slug
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              defaultValue={initial.slug ?? ""}
              maxLength={120}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
            />
            <p className="mt-1 text-xs font-semibold text-brand-brown">
              Auto-generated from name if left blank on create.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="description"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={initial.description ?? ""}
              rows={3}
              maxLength={800}
              className="w-full resize-y rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="sortOrder"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Sort order
            </label>
            <input
              type="number"
              id="sortOrder"
              name="sortOrder"
              defaultValue={initial.sortOrder ?? 0}
              min={0}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={initial.status ?? "draft"}
              className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy dark:bg-white/10 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saveState === "saving"}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
          >
            {saveState === "saving" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : saveState === "success" ? (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            ) : null}
            {isNew ? "Create category" : "Save changes"}
          </button>

          {!isNew && initial.status !== "archived" ? (
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={saveState === "saving"}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-brown hover:text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-brand-sand"
            >
              Archive
            </button>
          ) : null}

          {saveState === "error" ? (
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
