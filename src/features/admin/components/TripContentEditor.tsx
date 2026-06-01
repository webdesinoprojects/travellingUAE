"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  FileText,
  Images,
  ListChecks,
  Loader2,
  MapPinned,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import type {
  AdminTripContentWorkspace,
  AdminTripGalleryItem,
  AdminTripInclusion,
  AdminTripItineraryItem,
  AdminTripTextItem,
} from "@/types/admin-trip-content";

type TripContentEditorProps = {
  initialWorkspace: AdminTripContentWorkspace;
  hideTripSelector?: boolean;
};

type TextContentType = "inclusions" | "highlights" | "exclusions" | "terms";
type ContentType = TextContentType | "gallery" | "itinerary";

type MutationState = {
  state: "idle" | "loading" | "saved" | "error";
  message: string;
  target?: string;
};

export function TripContentEditor({
  initialWorkspace,
  hideTripSelector = false,
}: TripContentEditorProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [mutation, setMutation] = useState<MutationState>({
    state: "idle",
    message:
      initialWorkspace.source === "database"
        ? hideTripSelector
          ? "Manage the detail sections that render on the public trip page."
          : "Select a trip and manage the detail sections shown publicly."
        : "The database must be configured before trip content can be edited.",
  });
  const selectedTrip = workspace.trips.find(
    (trip) => trip.id === workspace.selectedTripId,
  );
  const disabled = mutation.state === "loading" || !workspace.selectedTripId;

  async function loadTrip(tripId: string) {
    if (!tripId) {
      return;
    }

    setMutation({
      state: "loading",
      message: "Loading trip content...",
      target: "trip-select",
    });

    try {
      const [inclusions, highlights, exclusions, terms, gallery, itinerary] =
        await Promise.all([
          fetchContent<AdminTripInclusion>(tripId, "inclusions", mapTextItem),
          fetchContent<AdminTripTextItem>(tripId, "highlights", mapTextItem),
          fetchContent<AdminTripTextItem>(tripId, "exclusions", mapTextItem),
          fetchContent<AdminTripTextItem>(tripId, "terms", mapTextItem),
          fetchContent<AdminTripGalleryItem>(tripId, "gallery", mapGallery),
          fetchContent<AdminTripItineraryItem>(tripId, "itinerary", mapItinerary),
        ]);

      setWorkspace((current) => ({
        ...current,
        selectedTripId: tripId,
        inclusions,
        highlights,
        exclusions,
        terms,
        gallery,
        itinerary,
      }));
      setRefreshKey((value) => value + 1);
      setMutation({
        state: "idle",
      message:
        "Trip content loaded. Changes to published trips are public after save.",
      });
    } catch {
      setMutation({
        state: "error",
        message: "Trip content could not be loaded. Please try again.",
      });
    }
  }

  async function mutate(
    type: ContentType,
    target: string,
    method: "POST" | "PATCH" | "DELETE",
    payload?: Record<string, unknown>,
  ) {
    const tripId = workspace.selectedTripId;

    if (!tripId) {
      return;
    }

    const suffix = method === "POST" ? "" : `/${target}`;
    setMutation({ state: "loading", message: "Saving trip content...", target });

    try {
      const response = await fetch(
        `/api/admin/trips/${tripId}/content/${type}${suffix}`,
        {
          method,
          headers: payload ? { "Content-Type": "application/json" } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean }
        | null;

      if (!response.ok || result?.ok !== true) {
        throw new Error("mutation-failed");
      }

      await loadTrip(tripId);
      if (method === "POST") {
        setCreateFormKey((value) => value + 1);
      }
      setMutation({
        state: "saved",
        message: "Trip detail content saved and public page data refreshed.",
      });
      router.refresh();
    } catch {
      setMutation({
        state: "error",
        message:
          "This content could not be saved. Check required text and approved image URLs.",
      });
    }
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
    type: ContentType,
    target: string,
    method: "POST" | "PATCH",
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload =
      isTextContentType(type)
        ? textPayload(form)
        : type === "gallery"
          ? galleryPayload(form)
          : itineraryPayload(form);

    void mutate(type, target, method, payload);
  }

  function remove(type: ContentType, id: string) {
    if (!window.confirm("Remove this item from the trip detail content?")) {
      return;
    }

    void mutate(type, id, "DELETE");
  }

  return (
    <section className="grid min-w-0 gap-5">
      {hideTripSelector ? (
        <div className="grid min-w-0 gap-3">
          {selectedTrip?.status === "published" ? (
            <p className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              This trip is published. Saved content becomes public immediately
              until draft versioning is added.
            </p>
          ) : null}
          <StatusMessage state={mutation} />
        </div>
      ) : (
        <header className="grid min-w-0 gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] lg:items-end">
          <label className="grid min-w-0 gap-2 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
            Package
            <select
              value={workspace.selectedTripId ?? ""}
              disabled={mutation.state === "loading"}
              onChange={(event) => void loadTrip(event.target.value)}
              className="min-h-11 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue disabled:opacity-60 dark:border-white/15 dark:bg-black/30 dark:text-white"
            >
              {workspace.trips.length === 0 ? (
                <option value="">No trips available</option>
              ) : null}
              {workspace.trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({trip.status})
                </option>
              ))}
            </select>
          </label>
          <div className="grid min-w-0 gap-3">
            {selectedTrip?.status === "published" ? (
              <p className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                This trip is published. Saved content becomes public immediately
                until draft versioning is added.
              </p>
            ) : null}
            <StatusMessage state={mutation} />
          </div>
        </header>
      )}

      {workspace.selectedTripId ? (
        <div className="grid min-w-0 gap-5">
          <TextContentPanel
            icon={<BadgeCheck aria-hidden="true" className="size-4" />}
            title="Highlights"
            helper="Short selling points shown on the trip detail page."
            type="highlights"
            label="Highlight"
            items={workspace.highlights}
            disabled={disabled}
            mutation={mutation}
            refreshKey={refreshKey}
            createFormKey={createFormKey}
            onSubmit={submit}
            onRemove={remove}
          />

          <ContentPanel
            icon={<ListChecks aria-hidden="true" className="size-4" />}
            title="What's Included"
            helper="Services included in this package."
          >
            <div className="grid min-w-0 gap-3">
              {workspace.inclusions.map((item) => (
                <TextItemForm
                  key={`${item.id}-${refreshKey}`}
                  item={item}
                  label="Included service"
                  saveLabel="Save inclusion"
                  disabled={disabled}
                  active={mutation.target === item.id}
                  onSubmit={(event) =>
                    submit(event, "inclusions", item.id, "PATCH")
                  }
                  onRemove={() => remove("inclusions", item.id)}
                />
              ))}
              <NewItem label="Add inclusion">
                <TextItemForm
                  key={`new-inclusion-${createFormKey}`}
                  label="Included service"
                  saveLabel="Create inclusion"
                  disabled={disabled}
                  active={mutation.target === "new-inclusion"}
                  onSubmit={(event) =>
                    submit(event, "inclusions", "new-inclusion", "POST")
                  }
                />
              </NewItem>
            </div>
          </ContentPanel>

          <ContentPanel
            icon={<Images aria-hidden="true" className="size-4" />}
            title="Gallery"
            helper="Approved public image URLs and accessible descriptions."
          >
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {workspace.gallery.map((item) => (
                <GalleryForm
                  key={`${item.id}-${refreshKey}`}
                  item={item}
                  disabled={disabled}
                  active={mutation.target === item.id}
                  onSubmit={(event) => submit(event, "gallery", item.id, "PATCH")}
                  onRemove={() => remove("gallery", item.id)}
                />
              ))}
            </div>
            <NewItem label="Add gallery image">
              <GalleryForm
                key={`new-gallery-${createFormKey}`}
                disabled={disabled}
                active={mutation.target === "new-gallery"}
                onSubmit={(event) =>
                  submit(event, "gallery", "new-gallery", "POST")
                }
              />
            </NewItem>
          </ContentPanel>

          <ContentPanel
            icon={<MapPinned aria-hidden="true" className="size-4" />}
            title="Itinerary Days"
            helper="Fallback itinerary copy shown when configurable segments are absent."
          >
            <div className="grid min-w-0 gap-3">
              {workspace.itinerary.map((item) => (
                <ItineraryForm
                  key={`${item.id}-${refreshKey}`}
                  item={item}
                  disabled={disabled}
                  active={mutation.target === item.id}
                  onSubmit={(event) =>
                    submit(event, "itinerary", item.id, "PATCH")
                  }
                  onRemove={() => remove("itinerary", item.id)}
                />
              ))}
              <NewItem label="Add itinerary day">
                <ItineraryForm
                  key={`new-itinerary-${createFormKey}`}
                  disabled={disabled}
                  active={mutation.target === "new-itinerary"}
                  onSubmit={(event) =>
                    submit(event, "itinerary", "new-itinerary", "POST")
                  }
                />
              </NewItem>
            </div>
          </ContentPanel>

          <TextContentPanel
            icon={<Ban aria-hidden="true" className="size-4" />}
            title="Exclusions"
            helper="Costs and services that are not included in this package."
            type="exclusions"
            label="Exclusion"
            items={workspace.exclusions}
            disabled={disabled}
            mutation={mutation}
            refreshKey={refreshKey}
            createFormKey={createFormKey}
            onSubmit={submit}
            onRemove={remove}
          />

          <TextContentPanel
            icon={<FileText aria-hidden="true" className="size-4" />}
            title="Terms"
            helper="Important trip terms shown to travelers before enquiry."
            type="terms"
            label="Term"
            items={workspace.terms}
            disabled={disabled}
            mutation={mutation}
            refreshKey={refreshKey}
            createFormKey={createFormKey}
            onSubmit={submit}
            onRemove={remove}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 text-sm font-bold text-brand-brown dark:border-white/10 dark:bg-white/[0.06]">
          Create a trip record before adding detail content.
        </p>
      )}
    </section>
  );
}

function ContentPanel({
  icon,
  title,
  helper,
  children,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="min-w-0">
        <h2 className="inline-flex items-center gap-2 text-lg font-black">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-sky text-brand-navy">
            {icon}
          </span>
          {title}
        </h2>
        <p className="mt-1 text-sm font-semibold text-brand-brown">{helper}</p>
      </div>
      {children}
    </section>
  );
}

function StatusMessage({ state }: { state: MutationState }) {
  return (
    <div
      role="status"
      className={[
        "inline-flex max-w-xl items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold",
        state.state === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : state.state === "saved"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown dark:border-white/10 dark:bg-white/10 dark:text-brand-sand",
      ].join(" ")}
    >
      {state.state === "loading" ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state.state === "saved" ? (
        <CheckCircle2 aria-hidden="true" className="size-4" />
      ) : (
        <MapPinned aria-hidden="true" className="size-4" />
      )}
      {state.message}
    </div>
  );
}

function TextContentPanel({
  icon,
  title,
  helper,
  type,
  label,
  items,
  disabled,
  mutation,
  refreshKey,
  createFormKey,
  onSubmit,
  onRemove,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  type: TextContentType;
  label: string;
  items: AdminTripTextItem[];
  disabled: boolean;
  mutation: MutationState;
  refreshKey: number;
  createFormKey: number;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    type: ContentType,
    target: string,
    method: "POST" | "PATCH",
  ) => void;
  onRemove: (type: ContentType, id: string) => void;
}) {
  const createTarget = `new-${type}`;

  return (
    <ContentPanel icon={icon} title={title} helper={helper}>
      <div className="grid min-w-0 gap-3">
        {items.map((item) => (
          <TextItemForm
            key={`${item.id}-${refreshKey}`}
            item={item}
            label={label}
            saveLabel={`Save ${label.toLowerCase()}`}
            disabled={disabled}
            active={mutation.target === item.id}
            onSubmit={(event) => onSubmit(event, type, item.id, "PATCH")}
            onRemove={() => onRemove(type, item.id)}
          />
        ))}
        <NewItem label={`Add ${label.toLowerCase()}`}>
          <TextItemForm
            key={`${createTarget}-${createFormKey}`}
            label={label}
            saveLabel={`Create ${label.toLowerCase()}`}
            disabled={disabled}
            active={mutation.target === createTarget}
            onSubmit={(event) => onSubmit(event, type, createTarget, "POST")}
          />
        </NewItem>
      </div>
    </ContentPanel>
  );
}

function TextItemForm({
  item,
  label,
  saveLabel,
  disabled,
  active,
  onSubmit,
  onRemove,
}: {
  item?: AdminTripTextItem;
  label: string;
  saveLabel: string;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove?: () => void;
}) {
  return (
    <ItemForm onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
        <TextField name="body" label={label} value={item?.body} required />
        <NumberField name="sortOrder" label="Order" value={item?.sortOrder ?? 0} />
      </div>
      <Actions
        disabled={disabled}
        active={active}
        label={saveLabel}
        onRemove={onRemove}
      />
    </ItemForm>
  );
}

function GalleryForm({
  item,
  disabled,
  active,
  onSubmit,
  onRemove,
}: {
  item?: AdminTripGalleryItem;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove?: () => void;
}) {
  return (
    <ItemForm onSubmit={onSubmit}>
      <TextField name="src" label="Image URL" value={item?.src} required />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
        <TextField name="altText" label="Alternative text" value={item?.altText} required />
        <NumberField name="sortOrder" label="Order" value={item?.sortOrder ?? 0} />
      </div>
      <Actions
        disabled={disabled}
        active={active}
        label={item ? "Save image" : "Create image"}
        onRemove={onRemove}
      />
    </ItemForm>
  );
}

function ItineraryForm({
  item,
  disabled,
  active,
  onSubmit,
  onRemove,
}: {
  item?: AdminTripItineraryItem;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove?: () => void;
}) {
  return (
    <ItemForm onSubmit={onSubmit}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
        <TextField name="title" label="Day title" value={item?.title} required />
        <NumberField name="sortOrder" label="Order" value={item?.sortOrder ?? 0} />
      </div>
      <TextAreaField name="body" label="Description" value={item?.body} required rows={3} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          name="locationLabel"
          label="Location"
          value={item?.locationLabel}
        />
        <NumberField
          name="latitude"
          label="Latitude"
          value={item?.latitude}
          min={-90}
          max={90}
          step="any"
        />
        <NumberField
          name="longitude"
          label="Longitude"
          value={item?.longitude}
          min={-180}
          max={180}
          step="any"
        />
        <NumberField name="zoom" label="Map zoom" value={item?.zoom ?? 12} min={1} max={18} />
      </div>
      <Actions
        disabled={disabled}
        active={active}
        label={item ? "Save day" : "Create day"}
        onRemove={onRemove}
      />
    </ItemForm>
  );
}

function ItemForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid min-w-0 gap-3 rounded-lg border border-[#e4d5c2] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04]"
    >
      {children}
    </form>
  );
}

function NewItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue dark:text-brand-sky">
        <Plus aria-hidden="true" className="mr-2 inline size-4" />
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Actions({
  disabled,
  active,
  label,
  onRemove,
}: {
  disabled: boolean;
  active: boolean;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
      >
        {active && disabled ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Save aria-hidden="true" className="size-4" />
        )}
        {label}
      </button>
      {onRemove ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Remove
        </button>
      ) : null}
    </div>
  );
}

function TextField({
  name,
  label,
  value = "",
  required = false,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <input
        name={name}
        defaultValue={value}
        required={required}
        className="min-h-10 w-full min-w-0 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function NumberField({
  name,
  label,
  value,
  min = 0,
  max,
  step = "1",
}: {
  name: string;
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <input
        type="number"
        name={name}
        defaultValue={value ?? ""}
        min={min}
        max={max}
        step={step}
        className="min-h-10 w-full min-w-0 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function TextAreaField({
  name,
  label,
  value = "",
  required = false,
  rows,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  rows: number;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <textarea
        name={name}
        defaultValue={value}
        required={required}
        rows={rows}
        className="w-full min-w-0 rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

async function fetchContent<T>(
  tripId: string,
  type: ContentType,
  map: (row: Record<string, unknown>) => T,
) {
  const response = await fetch(`/api/admin/trips/${tripId}/content/${type}`, {
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: { items?: unknown[] } }
    | null;

  if (!response.ok || result?.ok !== true || !Array.isArray(result.data?.items)) {
    throw new Error("content-load-failed");
  }

  return result.data.items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map(map);
}

function mapTextItem(row: Record<string, unknown>): AdminTripTextItem {
  return {
    id: asString(row.id),
    body: asString(row.body),
    sortOrder: asNumber(row.sort_order),
  };
}

function mapGallery(row: Record<string, unknown>): AdminTripGalleryItem {
  return {
    id: asString(row.id),
    src: asString(row.src),
    altText: asString(row.alt_text),
    sortOrder: asNumber(row.sort_order),
  };
}

function mapItinerary(row: Record<string, unknown>): AdminTripItineraryItem {
  return {
    id: asString(row.id),
    title: asString(row.title),
    body: asString(row.body),
    locationLabel: asString(row.location_label),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    zoom: asNumber(row.zoom, 12),
    sortOrder: asNumber(row.sort_order),
  };
}

function textPayload(form: FormData) {
  return {
    body: formText(form, "body"),
    sortOrder: formNumber(form, "sortOrder"),
  };
}

function isTextContentType(type: ContentType): type is TextContentType {
  return (
    type === "inclusions" ||
    type === "highlights" ||
    type === "exclusions" ||
    type === "terms"
  );
}

function galleryPayload(form: FormData) {
  return {
    src: formText(form, "src"),
    altText: formText(form, "altText"),
    sortOrder: formNumber(form, "sortOrder"),
  };
}

function itineraryPayload(form: FormData) {
  return {
    title: formText(form, "title"),
    body: formText(form, "body"),
    locationLabel: formText(form, "locationLabel"),
    latitude: formOptionalNumber(form, "latitude"),
    longitude: formOptionalNumber(form, "longitude"),
    zoom: formNumber(form, "zoom"),
    sortOrder: formNumber(form, "sortOrder"),
  };
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formNumber(form: FormData, key: string) {
  const number = Number(formText(form, key));
  return Number.isFinite(number) ? number : 0;
}

function formOptionalNumber(form: FormData, key: string) {
  const value = formText(form, key);
  const number = Number(value);

  return value && Number.isFinite(number) ? number : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asNumber(value: unknown, fallback = 0) {
  return asNullableNumber(value) ?? fallback;
}
