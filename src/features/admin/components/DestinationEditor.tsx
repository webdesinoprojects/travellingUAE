"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

export type DestinationEditorData = {
  id?: string;
  name?: string;
  slug?: string;
  country?: string;
  city?: string;
  resultTitle?: string;
  currency?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapZoom?: number | null;
  sortOrder?: number | null;
  status?: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

export function DestinationEditor({
  initial = {},
}: {
  initial?: DestinationEditorData;
}) {
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
      country: data.get("country") || undefined,
      city: data.get("city") || undefined,
      resultTitle: data.get("resultTitle") || undefined,
      currency: data.get("currency") || undefined,
      status: data.get("status") || "draft",
    };

    const lat = data.get("latitude");
    const lng = data.get("longitude");
    const zoom = data.get("mapZoom");

    if (lat) body.latitude = Number(lat);
    if (lng) body.longitude = Number(lng);
    if (zoom) body.mapZoom = Number(zoom);

    const sortOrder = data.get("sortOrder");
    if (sortOrder) body.sortOrder = Number(sortOrder);

    try {
      const url = isNew
        ? "/api/admin/resources/destinations"
        : `/api/admin/resources/destinations/${initial.id}`;
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
        setErrorMsg("The destination could not be saved. Check required fields.");
        return;
      }

      setSaveState("success");

      if (isNew) {
        const newId = payload.data?.row?.id;
        router.push(newId ? `/admin/destinations/${newId}` : "/admin/destinations");
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
      const res = await fetch(
        `/api/admin/resources/destinations/${initial.id}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        setSaveState("error");
        setErrorMsg("The destination could not be archived.");
        return;
      }

      router.push("/admin/destinations");
    } catch {
      setSaveState("error");
      setErrorMsg("An unexpected error occurred.");
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="mb-1 text-lg font-black">
        {isNew ? "New destination" : "Edit destination"}
      </h2>
      <p className="mb-5 text-sm font-semibold text-brand-brown">
        {isNew
          ? "Create a destination record. Set status to draft until ready to publish."
          : "Update destination details. Changes become public only when status is published."}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldText
            label="Name *"
            id="name"
            name="name"
            defaultValue={initial.name}
            required
            maxLength={120}
          />
          <FieldText
            label="Slug"
            id="slug"
            name="slug"
            defaultValue={initial.slug}
            maxLength={120}
            hint="Auto-generated from name if left blank on create."
          />
          <FieldText
            label="Country"
            id="country"
            name="country"
            defaultValue={initial.country}
            maxLength={120}
          />
          <FieldText
            label="City"
            id="city"
            name="city"
            defaultValue={initial.city}
            maxLength={120}
          />
          <FieldText
            label="Result page title"
            id="resultTitle"
            name="resultTitle"
            defaultValue={initial.resultTitle}
            maxLength={160}
          />
          <FieldText
            label="Currency code"
            id="currency"
            name="currency"
            defaultValue={initial.currency ?? "SAR"}
            maxLength={12}
          />
          <FieldNumber
            label="Latitude"
            id="latitude"
            name="latitude"
            defaultValue={initial.latitude ?? undefined}
            min={-90}
            max={90}
            step={0.000001}
          />
          <FieldNumber
            label="Longitude"
            id="longitude"
            name="longitude"
            defaultValue={initial.longitude ?? undefined}
            min={-180}
            max={180}
            step={0.000001}
          />
          <FieldNumber
            label="Map zoom"
            id="mapZoom"
            name="mapZoom"
            defaultValue={initial.mapZoom ?? 10}
            min={1}
            max={18}
          />
          <FieldNumber
            label="Sort order"
            id="sortOrder"
            name="sortOrder"
            defaultValue={initial.sortOrder ?? 0}
            min={0}
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
            className="w-full max-w-xs rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy dark:bg-white/10 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
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
            {isNew ? "Create destination" : "Save changes"}
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

function FieldText({
  label,
  id,
  name,
  defaultValue,
  required,
  maxLength,
  hint,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <input
        type="text"
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
      {hint ? (
        <p className="mt-1 text-xs font-semibold text-brand-brown">{hint}</p>
      ) : null}
    </div>
  );
}

function FieldNumber({
  label,
  id,
  name,
  defaultValue,
  min,
  max,
  step,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <input
        type="number"
        id={id}
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
    </div>
  );
}
