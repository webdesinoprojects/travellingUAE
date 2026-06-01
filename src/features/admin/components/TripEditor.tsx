"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

export type TripEditorDestination = {
  id: string;
  name: string;
  status: string;
};

export type TripEditorData = {
  id?: string;
  destinationId?: string;
  slug?: string;
  title?: string;
  city?: string;
  summary?: string;
  overview?: string;
  badge?: string;
  durationDays?: number | null;
  durationLabel?: string;
  nights?: number | null;
  hasFlights?: boolean;
  hotelStar?: number | null;
  priceAmount?: number | null;
  currency?: string;
  startDate?: string;
  travelersLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapZoom?: number | null;
  sortOrder?: number | null;
  status?: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

export function TripEditor({
  initial = {},
  destinations,
}: {
  initial?: TripEditorData;
  destinations: TripEditorDestination[];
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const body: Record<string, unknown> = {
      destinationId: stringOrUndefined(data, "destinationId"),
      title: stringOrUndefined(data, "title"),
      slug: stringOrUndefined(data, "slug"),
      city: stringOrUndefined(data, "city"),
      summary: stringOrUndefined(data, "summary"),
      overview: stringOrUndefined(data, "overview"),
      badge: stringOrUndefined(data, "badge"),
      durationLabel: stringOrUndefined(data, "durationLabel"),
      currency: stringOrUndefined(data, "currency"),
      startDate: stringOrUndefined(data, "startDate"),
      travelersLabel: stringOrUndefined(data, "travelersLabel"),
      status: stringOrUndefined(data, "status") ?? "draft",
      hasFlights: data.get("hasFlights") === "on",
    };

    const durationDays = numberOrUndefined(data, "durationDays");
    if (durationDays !== undefined) body.durationDays = durationDays;
    const nights = numberOrUndefined(data, "nights");
    if (nights !== undefined) body.nights = nights;
    const hotelStar = numberOrUndefined(data, "hotelStar");
    if (hotelStar !== undefined) body.hotelStar = hotelStar;
    const priceAmount = numberOrUndefined(data, "priceAmount");
    if (priceAmount !== undefined) body.priceAmount = priceAmount;
    const latitude = numberOrUndefined(data, "latitude");
    if (latitude !== undefined) body.latitude = latitude;
    const longitude = numberOrUndefined(data, "longitude");
    if (longitude !== undefined) body.longitude = longitude;
    const mapZoom = numberOrUndefined(data, "mapZoom");
    if (mapZoom !== undefined) body.mapZoom = mapZoom;
    const sortOrder = numberOrUndefined(data, "sortOrder");
    if (sortOrder !== undefined) body.sortOrder = sortOrder;

    try {
      const url = isNew
        ? "/api/admin/resources/trips"
        : `/api/admin/resources/trips/${initial.id}`;
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
        setErrorMsg(
          "The trip could not be saved. Check required fields (destination, title, duration, price).",
        );
        return;
      }

      setSaveState("success");

      if (isNew) {
        const newId = payload.data?.row?.id;
        if (newId) {
          router.push(`/admin/trips/${newId}`);
        } else {
          setFormKey((value) => value + 1);
          router.push("/admin/trips");
        }
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
    if (
      !window.confirm(
        "Archive this trip? It will no longer be visible publicly until restored.",
      )
    ) {
      return;
    }

    setSaveState("saving");

    try {
      const res = await fetch(`/api/admin/resources/trips/${initial.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setSaveState("error");
        setErrorMsg("The trip could not be archived.");
        return;
      }

      router.push("/admin/trips");
    } catch {
      setSaveState("error");
      setErrorMsg("An unexpected error occurred.");
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
      <h2 className="mb-1 text-lg font-black">
        {isNew ? "New trip" : "Edit trip"}
      </h2>
      <p className="mb-5 text-sm font-semibold text-brand-brown">
        {isNew
          ? "Create a trip record. Drafts stay hidden from the public website until you publish."
          : "Update trip details. Changes become public only when status is published."}
      </p>

      <form
        key={formKey}
        onSubmit={(e) => void handleSubmit(e)}
        className="grid min-w-0 gap-4"
      >
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <FieldSelect
            label="Destination *"
            id="destinationId"
            name="destinationId"
            defaultValue={initial.destinationId ?? ""}
            required
          >
            <option value="">Select destination...</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
                {destination.status !== "published" ? ` (${destination.status})` : ""}
              </option>
            ))}
          </FieldSelect>
          <FieldText
            label="Title *"
            id="title"
            name="title"
            defaultValue={initial.title}
            required
            maxLength={160}
          />
          <FieldText
            label="Slug"
            id="slug"
            name="slug"
            defaultValue={initial.slug}
            maxLength={160}
            hint="Auto-generated from title if left blank on create."
          />
          <FieldText
            label="City / location"
            id="city"
            name="city"
            defaultValue={initial.city}
            maxLength={120}
          />
          <FieldNumber
            label="Price amount *"
            id="priceAmount"
            name="priceAmount"
            defaultValue={initial.priceAmount ?? undefined}
            min={0}
            step={0.01}
            required={isNew}
          />
          <FieldText
            label="Currency"
            id="currency"
            name="currency"
            defaultValue={initial.currency ?? "SAR"}
            maxLength={12}
          />
          <FieldNumber
            label="Duration days *"
            id="durationDays"
            name="durationDays"
            defaultValue={initial.durationDays ?? undefined}
            min={1}
            max={90}
            step={1}
            required={isNew}
          />
          <FieldText
            label="Duration label"
            id="durationLabel"
            name="durationLabel"
            defaultValue={initial.durationLabel}
            maxLength={80}
            hint="Optional. Defaults to e.g. '5 Days'."
          />
          <FieldNumber
            label="Nights"
            id="nights"
            name="nights"
            defaultValue={initial.nights ?? undefined}
            min={0}
            max={90}
            step={1}
          />
          <FieldNumber
            label="Hotel star (1-5)"
            id="hotelStar"
            name="hotelStar"
            defaultValue={initial.hotelStar ?? undefined}
            min={1}
            max={5}
            step={1}
          />
          <FieldText
            label="Travelers label"
            id="travelersLabel"
            name="travelersLabel"
            defaultValue={initial.travelersLabel}
            maxLength={80}
          />
          <FieldText
            label="Badge"
            id="badge"
            name="badge"
            defaultValue={initial.badge}
            maxLength={80}
            hint="Optional eyebrow such as 'Recommended'."
          />
          <FieldDate
            label="Start date"
            id="startDate"
            name="startDate"
            defaultValue={initial.startDate}
          />
          <FieldFlag
            label="Includes flights"
            id="hasFlights"
            name="hasFlights"
            defaultChecked={initial.hasFlights ?? true}
          />
        </div>

        <FieldTextArea
          label="Summary"
          id="summary"
          name="summary"
          defaultValue={initial.summary}
          maxLength={320}
          rows={2}
          hint="Short summary used on cards and SEO meta description."
        />

        <FieldTextArea
          label="Overview"
          id="overview"
          name="overview"
          defaultValue={initial.overview}
          maxLength={3000}
          rows={5}
          hint="Long overview shown at the top of the trip detail page."
        />

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            defaultValue={initial.mapZoom ?? 12}
            min={1}
            max={18}
            step={1}
          />
          <FieldNumber
            label="Sort order"
            id="sortOrder"
            name="sortOrder"
            defaultValue={initial.sortOrder ?? 0}
            min={0}
            step={1}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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

          {!isNew && initial.id ? (
            <Link
              href={`/admin/trips/${initial.id}/preview`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 self-end rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy hover:text-brand-blue dark:bg-white/10 dark:text-brand-sand"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Open preview
            </Link>
          ) : null}
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
            {isNew ? "Create trip" : "Save changes"}
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

function stringOrUndefined(form: FormData, key: string) {
  const value = form.get(key);
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function numberOrUndefined(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
    <div className="min-w-0">
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
  required,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
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
        required={required}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
    </div>
  );
}

function FieldDate({
  label,
  id,
  name,
  defaultValue,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <input
        type="date"
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
    </div>
  );
}

function FieldSelect({
  label,
  id,
  name,
  defaultValue,
  required,
  children,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      >
        {children}
      </select>
    </div>
  );
}

function FieldFlag({
  label,
  id,
  name,
  defaultChecked,
}: {
  label: string;
  id: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-end">
      <label
        htmlFor={id}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-brand-navy dark:text-white"
      >
        <input
          type="checkbox"
          id={id}
          name={name}
          defaultChecked={defaultChecked}
          className="size-4 rounded border border-border-soft accent-brand-navy"
        />
        {label}
      </label>
    </div>
  );
}

function FieldTextArea({
  label,
  id,
  name,
  defaultValue,
  maxLength,
  rows,
  hint,
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: string;
  maxLength?: number;
  rows: number;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-brown"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
        rows={rows}
        className="w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2.5 text-sm font-bold text-brand-navy outline-none dark:bg-white/10 dark:text-white"
      />
      {hint ? (
        <p className="mt-1 text-xs font-semibold text-brand-brown">{hint}</p>
      ) : null}
    </div>
  );
}
