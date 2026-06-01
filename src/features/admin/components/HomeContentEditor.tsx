"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  AdminContentStatus,
  AdminHomeCollection,
  AdminHomeCollectionItem,
  AdminHomeContent,
  AdminHomeMediaOption,
  AdminHomeService,
  AdminHomeTestimonial,
} from "@/types/home";
import type { TravelIconKey } from "@/types/travel";

type HomeContentEditorProps = {
  initialContent: AdminHomeContent;
};

type MutationState = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
  target?: string;
};

const iconOptions: TravelIconKey[] = [
  "flight",
  "hotel",
  "package",
  "hajj",
  "wellness",
  "cruise",
  "visa",
  "bus",
  "transfer",
  "car",
  "passport",
  "document",
  "insurance",
  "sim",
];

export function HomeContentEditor({ initialContent }: HomeContentEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mutation, setMutation] = useState<MutationState>({
    state: "idle",
    message:
      initialContent.source === "database"
        ? "Published changes appear on the homepage after save."
        : "The database must be configured before homepage content can be edited.",
  });

  async function mutate(
    target: string,
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
  ) {
    setMutation({ state: "saving", message: "Saving changes...", target });

    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { content?: AdminHomeContent } }
        | null;
      const nextContent = result?.data?.content;

      if (!response.ok || result?.ok !== true || !nextContent) {
        throw new Error("save-failed");
      }

      setContent(nextContent);
      setRefreshKey((value) => value + 1);
      setMutation({
        state: "saved",
        message: "Homepage content saved and public output refreshed.",
      });
      router.refresh();
    } catch {
      setMutation({
        state: "error",
        message: "This content could not be saved. Check the values and try again.",
      });
    }
  }

  function saveForm(
    event: FormEvent<HTMLFormElement>,
    target: string,
    path: string,
    buildPayload: (data: FormData) => Record<string, unknown>,
    method: "POST" | "PATCH" = "PATCH",
  ) {
    event.preventDefault();
    void mutate(target, method, path, buildPayload(new FormData(event.currentTarget)));
  }

  const saving = mutation.state === "saving";
  const missingCollections = ([
    {
      type: "flytime_picks" as const,
      slug: "fly-time-picks",
      title: "Fly Time Picks",
      eyebrow: "Handpicked Deals",
    },
    {
      type: "route_board" as const,
      slug: "routes-people-ask-for",
      title: "Routes People Ask For",
      eyebrow: "Holiday Lanes",
    },
  ]).filter(
    (expected) =>
      !content.collections.some(
        (collection) =>
          collection.type === expected.type && collection.status !== "archived",
      ),
  );

  return (
    <section className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] md:flex-row md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            <Layers3 aria-hidden="true" className="size-4" />
            Homepage content
          </p>
          <h2 className="mt-2 text-xl font-black">Published sections and cards</h2>
        </div>
        <div
          role="status"
          className={[
            "inline-flex max-w-lg items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold",
            mutation.state === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : mutation.state === "saved"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown dark:border-white/10 dark:bg-white/10 dark:text-brand-sand",
          ].join(" ")}
        >
          {mutation.state === "saving" ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : mutation.state === "saved" ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : (
            <Layers3 aria-hidden="true" className="size-4" />
          )}
          {mutation.message}
        </div>
      </header>

      <EditorGroup title="Section headings" description="Headings for the two homepage card collections.">
        <div className="grid gap-3 lg:grid-cols-2">
          {content.collections.map((collection) => (
            <CollectionForm
              key={`${collection.id}-${refreshKey}`}
              collection={collection}
              disabled={saving}
              active={mutation.target === collection.id}
              onSubmit={(event) =>
                saveForm(
                  event,
                  collection.id,
                  `/api/admin/home/content/collections/${collection.id}`,
                  collectionPayload,
                )
              }
            />
          ))}
          {missingCollections.map((collection) => (
            <NewCollectionForm
              key={collection.type}
              collection={collection}
              disabled={saving}
              onSubmit={(event) =>
                saveForm(
                  event,
                  `new-${collection.type}`,
                  "/api/admin/home/content/collections",
                  (data) => ({
                    ...collectionPayload(data),
                    slug: collection.slug,
                    type: collection.type,
                  }),
                  "POST",
                )
              }
            />
          ))}
        </div>
      </EditorGroup>

      {content.collections.map((collection) => (
        <EditorGroup
          key={collection.id}
          title={collection.title}
          description={
            collection.type === "flytime_picks"
              ? "Deal cards shown in the horizontal picks rail."
              : "Route cards shown in the homepage visual grid."
          }
        >
          <div className="grid gap-3 xl:grid-cols-2">
            {content.items
              .filter((item) => item.collectionId === collection.id)
              .map((item) => (
                <ItemForm
                  key={`${item.id}-${refreshKey}`}
                  item={item}
                  media={content.media}
                  disabled={saving}
                  active={mutation.target === item.id}
                  onSubmit={(event) =>
                    saveForm(
                      event,
                      item.id,
                      `/api/admin/home/content/items/${item.id}`,
                      itemPayload,
                    )
                  }
                  onArchive={() =>
                    void mutate(
                      item.id,
                      "DELETE",
                      `/api/admin/home/content/items/${item.id}`,
                    )
                  }
                />
              ))}
          </div>
          <NewItemForm
            key={`new-${collection.id}-${refreshKey}`}
            collection={collection}
            media={content.media}
            disabled={saving}
            onSubmit={(event) =>
              saveForm(
                event,
                `new-${collection.id}`,
                "/api/admin/home/content/items",
                (data) => ({
                  ...itemPayload(data),
                  collectionId: collection.id,
                }),
                "POST",
              )
            }
          />
        </EditorGroup>
      ))}

      <EditorGroup title="Service desk cards" description="Published service tiles and enquiry entry points.">
        <div className="grid gap-3 xl:grid-cols-2">
          {content.services.map((service) => (
            <ServiceForm
              key={`${service.id}-${refreshKey}`}
              service={service}
              media={content.media}
              disabled={saving}
              active={mutation.target === service.id}
              onSubmit={(event) =>
                saveForm(
                  event,
                  service.id,
                  `/api/admin/home/content/services/${service.id}`,
                  servicePayload,
                )
              }
              onArchive={() =>
                void mutate(
                  service.id,
                  "DELETE",
                  `/api/admin/home/content/services/${service.id}`,
                )
              }
            />
          ))}
        </div>
        <NewServiceForm
          key={`new-service-${refreshKey}`}
          media={content.media}
          disabled={saving}
          onSubmit={(event) =>
            saveForm(
              event,
              "new-service",
              "/api/admin/home/content/services",
              servicePayload,
              "POST",
            )
          }
        />
      </EditorGroup>

      <EditorGroup title="Traveler stories" description="Testimonials presented on the homepage.">
        <div className="grid gap-3 xl:grid-cols-2">
          {content.testimonials.map((testimonial) => (
            <TestimonialForm
              key={`${testimonial.id}-${refreshKey}`}
              testimonial={testimonial}
              media={content.media}
              disabled={saving}
              active={mutation.target === testimonial.id}
              onSubmit={(event) =>
                saveForm(
                  event,
                  testimonial.id,
                  `/api/admin/home/content/testimonials/${testimonial.id}`,
                  testimonialPayload,
                )
              }
              onArchive={() =>
                void mutate(
                  testimonial.id,
                  "DELETE",
                  `/api/admin/home/content/testimonials/${testimonial.id}`,
                )
              }
            />
          ))}
        </div>
        <NewTestimonialForm
          key={`new-testimonial-${refreshKey}`}
          media={content.media}
          disabled={saving}
          onSubmit={(event) =>
            saveForm(
              event,
              "new-testimonial",
              "/api/admin/home/content/testimonials",
              testimonialPayload,
              "POST",
            )
          }
        />
      </EditorGroup>
    </section>
  );
}

function EditorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div>
        <h3 className="text-lg font-black">{title}</h3>
        <p className="text-sm font-semibold text-brand-brown">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CollectionForm({
  collection,
  disabled,
  active,
  onSubmit,
}: {
  collection: AdminHomeCollection;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="eyebrow" label="Eyebrow" value={collection.eyebrow} />
        <StatusField value={collection.status} />
        <TextField name="title" label="Heading" value={collection.title} className="sm:col-span-2" required />
        <TextField name="description" label="Description" value={collection.description} className="sm:col-span-2" />
        <NumberField value={collection.sortOrder} />
      </div>
      <SaveAction disabled={disabled} active={active} label="Save heading" />
    </FormCard>
  );
}

function NewCollectionForm({
  collection,
  disabled,
  onSubmit,
}: {
  collection: {
    type: AdminHomeCollection["type"];
    title: string;
    eyebrow: string;
  };
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <p className="text-sm font-black text-brand-navy dark:text-white">
        Create {collection.title} section
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="eyebrow" label="Eyebrow" value={collection.eyebrow} />
        <StatusField value="draft" />
        <TextField name="title" label="Heading" value={collection.title} className="sm:col-span-2" required />
        <TextField name="description" label="Description" className="sm:col-span-2" />
        <NumberField value={99} />
      </div>
      <SaveAction disabled={disabled} active={false} label="Create section" icon={<Plus className="size-4" />} />
    </FormCard>
  );
}

function ItemForm({
  item,
  media,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  item: AdminHomeCollectionItem;
  media: AdminHomeMediaOption[];
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="title" label="Title" value={item.title} required className="sm:col-span-2" />
        <TextField name="subtitle" label="Supporting text" value={item.subtitle} className="sm:col-span-2" />
        <TextField name="priceLabel" label="Price label" value={item.priceLabel} required />
        <TextField name="durationLabel" label="Duration" value={item.durationLabel} />
        <TextField name="actionLabel" label="Action" value={item.actionLabel} required />
        <TextField name="href" label="Link path" value={item.href} required />
        <MediaField media={media} value={item.mediaId} />
        {item.collectionType === "route_board" ? <LayoutField value={item.layout} /> : null}
        <StatusField value={item.status} />
        <NumberField value={item.sortOrder} />
      </div>
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewItemForm({
  collection,
  media,
  disabled,
  onSubmit,
}: {
  collection: AdminHomeCollection;
  media: AdminHomeMediaOption[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue">Add card</summary>
      <FormCard onSubmit={onSubmit} inset>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField name="title" label="Title" required className="sm:col-span-2" />
          <TextField name="subtitle" label="Supporting text" className="sm:col-span-2" />
          <TextField name="priceLabel" label="Price label" required />
          <TextField name="durationLabel" label="Duration" />
          <TextField name="actionLabel" label="Action" value="View" required />
          <TextField name="href" label="Link path" value="/trips" required />
          <MediaField media={media} required />
          {collection.type === "route_board" ? <LayoutField value="small" /> : null}
          <StatusField value="draft" />
          <NumberField value={99} />
        </div>
        <SaveAction disabled={disabled} active={false} label="Create card" icon={<Plus className="size-4" />} />
      </FormCard>
    </details>
  );
}

function ServiceForm({
  service,
  media,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  service: AdminHomeService;
  media: AdminHomeMediaOption[];
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <ServiceFields service={service} media={media} />
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewServiceForm({
  media,
  disabled,
  onSubmit,
}: {
  media: AdminHomeMediaOption[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue">Add service</summary>
      <FormCard onSubmit={onSubmit} inset>
        <ServiceFields media={media} />
        <SaveAction disabled={disabled} active={false} label="Create service" icon={<Plus className="size-4" />} />
      </FormCard>
    </details>
  );
}

function ServiceFields({
  service,
  media,
}: {
  service?: AdminHomeService;
  media: AdminHomeMediaOption[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField name="title" label="Title" value={service?.title} required />
      <TextField name="slug" label="Slug" value={service?.slug} />
      <TextField name="summary" label="Summary" value={service?.summary} required className="sm:col-span-2" />
      <TextAreaField name="body" label="Service details" value={service?.body} />
      <IconField value={service?.icon ?? "package"} />
      <MediaField media={media} value={service?.mediaId} required={!service} />
      <StatusField value={service?.status ?? "draft"} />
      <NumberField value={service?.sortOrder ?? 99} />
    </div>
  );
}

function TestimonialForm({
  testimonial,
  media,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  testimonial: AdminHomeTestimonial;
  media: AdminHomeMediaOption[];
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <TestimonialFields testimonial={testimonial} media={media} />
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewTestimonialForm({
  media,
  disabled,
  onSubmit,
}: {
  media: AdminHomeMediaOption[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue">Add testimonial</summary>
      <FormCard onSubmit={onSubmit} inset>
        <TestimonialFields media={media} />
        <SaveAction disabled={disabled} active={false} label="Create testimonial" icon={<Plus className="size-4" />} />
      </FormCard>
    </details>
  );
}

function TestimonialFields({
  testimonial,
  media,
}: {
  testimonial?: AdminHomeTestimonial;
  media: AdminHomeMediaOption[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField name="author" label="Traveler name" value={testimonial?.author} required />
      <StatusField value={testimonial?.status ?? "draft"} />
      <TextAreaField name="quote" label="Review text" value={testimonial?.quote} required />
      <MediaField media={media} value={testimonial?.mediaId} />
      <NumberField value={testimonial?.sortOrder ?? 99} />
    </div>
  );
}

function FormCard({
  children,
  onSubmit,
  inset = false,
}: {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inset?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={inset ? "grid gap-3" : "grid gap-3 rounded-lg border border-[#ead7bd] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04]"}
    >
      {children}
    </form>
  );
}

function TextField({
  name,
  label,
  value = "",
  required = false,
  className = "",
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-bold text-brand-brown ${className}`}>
      {label}
      <input
        name={name}
        required={required}
        defaultValue={value}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      />
    </label>
  );
}

function TextAreaField({
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
    <label className="grid gap-1 text-xs font-bold text-brand-brown sm:col-span-2">
      {label}
      <textarea
        name={name}
        required={required}
        defaultValue={value}
        rows={3}
        className="rounded-md border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      />
    </label>
  );
}

function MediaField({
  media,
  value = "",
  required = false,
}: {
  media: AdminHomeMediaOption[];
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-brand-brown">
      Image asset
      <select
        name="mediaId"
        defaultValue={value}
        required={required}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      >
        <option value="">No image</option>
        {media.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusField({ value }: { value: AdminContentStatus }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-brand-brown">
      Visibility
      <select
        name="status"
        defaultValue={value}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      >
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
    </label>
  );
}

function NumberField({ value }: { value: number }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-brand-brown">
      Order
      <input
        name="sortOrder"
        type="number"
        min={0}
        max={10000}
        defaultValue={value}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      />
    </label>
  );
}

function LayoutField({ value }: { value: AdminHomeCollectionItem["layout"] }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-brand-brown">
      Grid size
      <select
        name="layout"
        defaultValue={value}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      >
        <option value="featured">Featured</option>
        <option value="wide">Wide</option>
        <option value="small">Small</option>
      </select>
    </label>
  );
}

function IconField({ value }: { value: TravelIconKey }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-brand-brown">
      Icon
      <select
        name="icon"
        defaultValue={value}
        className="min-h-10 rounded-md border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
      >
        {iconOptions.map((icon) => (
          <option key={icon} value={icon}>
            {icon}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecordActions({
  disabled,
  active,
  onArchive,
}: {
  disabled: boolean;
  active: boolean;
  onArchive: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <SaveAction disabled={disabled} active={active} label="Save" />
      <button
        type="button"
        disabled={disabled}
        onClick={onArchive}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown disabled:opacity-50 dark:border-white/15 dark:text-brand-sand"
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Archive
      </button>
    </div>
  );
}

function SaveAction({
  disabled,
  active,
  label,
  icon,
}: {
  disabled: boolean;
  active: boolean;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      type="submit"
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand-navy px-4 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
    >
      {active && disabled ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon ?? <Save aria-hidden="true" className="size-4" />
      )}
      {label}
    </button>
  );
}

function field(data: FormData, key: string) {
  const value = data.get(key);

  return typeof value === "string" ? value : "";
}

function collectionPayload(data: FormData) {
  return {
    title: field(data, "title"),
    eyebrow: field(data, "eyebrow"),
    description: field(data, "description"),
    status: field(data, "status"),
    sortOrder: field(data, "sortOrder"),
  };
}

function itemPayload(data: FormData) {
  return {
    title: field(data, "title"),
    subtitle: field(data, "subtitle"),
    priceLabel: field(data, "priceLabel"),
    durationLabel: field(data, "durationLabel"),
    actionLabel: field(data, "actionLabel"),
    href: field(data, "href"),
    mediaId: field(data, "mediaId"),
    status: field(data, "status"),
    sortOrder: field(data, "sortOrder"),
    ...(data.has("layout") ? { layout: field(data, "layout") } : {}),
  };
}

function servicePayload(data: FormData) {
  return {
    title: field(data, "title"),
    slug: field(data, "slug"),
    summary: field(data, "summary"),
    body: field(data, "body"),
    icon: field(data, "icon"),
    mediaId: field(data, "mediaId"),
    status: field(data, "status"),
    sortOrder: field(data, "sortOrder"),
  };
}

function testimonialPayload(data: FormData) {
  return {
    author: field(data, "author"),
    quote: field(data, "quote"),
    mediaId: field(data, "mediaId"),
    status: field(data, "status"),
    sortOrder: field(data, "sortOrder"),
  };
}
