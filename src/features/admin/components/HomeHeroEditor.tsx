"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { CheckCircle2, ImageIcon, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AdminHomeHero } from "@/types/home";

type HomeHeroEditorProps = {
  initialHero: AdminHomeHero;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

export function HomeHeroEditor({ initialHero }: HomeHeroEditorProps) {
  const router = useRouter();
  const [hero, setHero] = useState(initialHero);
  const [form, setForm] = useState({
    backgroundImage: initialHero.backgroundImage,
    backgroundAlt: initialHero.backgroundAlt,
    status: initialHero.status === "published" ? "published" : "draft",
  });
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message:
      initialHero.source === "database"
        ? "Saved homepage media."
        : "No CMS hero saved yet.",
  });
  const saving = saveState.status === "saving";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ status: "saving", message: "Saving..." });

    try {
      const response = await fetch("/api/admin/home/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { hero?: AdminHomeHero } }
        | null;
      const savedHero = result?.data?.hero;

      if (!response.ok || result?.ok !== true || !savedHero) {
        throw new Error("save-failed");
      }

      setHero(savedHero);
      setForm({
        backgroundImage: savedHero.backgroundImage,
        backgroundAlt: savedHero.backgroundAlt,
        status: savedHero.status === "published" ? "published" : "draft",
      });
      setSaveState({
        status: "saved",
        message:
          savedHero.status === "published"
            ? "Hero published on the homepage."
            : "Draft saved. The public homepage keeps its fallback image.",
      });
      router.refresh();
    } catch {
      setSaveState({
        status: "error",
        message: "The hero could not be saved. Check the image URL and try again.",
      });
    }
  }

  return (
    <section className="grid gap-5 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] lg:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
      <figure className="relative min-h-[320px] overflow-hidden rounded-lg bg-brand-navy">
        <Image
          src={hero.backgroundImage}
          alt={hero.backgroundAlt}
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-brand-navy/75 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase text-brand-sand">
            <ImageIcon aria-hidden="true" className="size-4" />
            Homepage Hero
          </p>
          <p className="mt-2 text-sm font-semibold text-white/78">
            {hero.backgroundAlt}
          </p>
        </figcaption>
      </figure>

      <form onSubmit={onSubmit} className="grid content-start gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            Hero media
          </p>
          <h2 className="mt-2 text-xl font-black">Homepage background</h2>
        </div>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Public image URL
          <input
            required
            type="url"
            value={form.backgroundImage}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                backgroundImage: event.target.value,
              }))
            }
            placeholder="https://images.unsplash.com/..."
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Image description
          <input
            required
            minLength={4}
            maxLength={240}
            value={form.backgroundAlt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                backgroundAlt: event.target.value,
              }))
            }
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Visibility
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as "draft" | "published",
              }))
            }
            className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <div
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${
            saveState.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : saveState.status === "saved"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown dark:border-white/10 dark:bg-white/10 dark:text-brand-sand"
          }`}
          role="status"
        >
          {saveState.status === "saved" ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : (
            <ImageIcon aria-hidden="true" className="size-4" />
          )}
          {saveState.message}
        </div>

        <button
          disabled={saving}
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
        >
          {saving ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          Save Hero
        </button>
      </form>
    </section>
  );
}
