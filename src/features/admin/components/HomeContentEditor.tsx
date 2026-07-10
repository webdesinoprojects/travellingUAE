"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  ImageIcon,
  Layers3,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  AdminContentStatus,
  AdminHomeCollection,
  AdminHomeCollectionItem,
  AdminHomeContent,
  AdminHomeMediaOption,
  AdminHomeSectionCopy,
  AdminHomeService,
  AdminHomeTestimonial,
} from "@/types/home";
import type { TravelIconKey } from "@/types/travel";

type HomeContentEditorProps = {
  initialContent: AdminHomeContent;
  view?: HomeContentEditorView;
};

export type HomeContentEditorView =
  | "all"
  | "services"
  | "routes"
  | "picks"
  | "testimonials";

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

const collectionDefinitions = [
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
];

const viewMeta: Record<HomeContentEditorView, { eyebrow: string; title: string; description: string }> = {
  all: {
    eyebrow: "Homepage content",
    title: "Published sections and cards",
    description: "Published changes appear on the homepage after save.",
  },
  services: {
    eyebrow: "What We Handle",
    title: "Service section and cards",
    description: "Edit the homepage service heading and the cards under What We Handle.",
  },
  routes: {
    eyebrow: "Routes People Ask For",
    title: "Route board cards",
    description: "Edit the homepage route section heading, images, prices, links and card layout.",
  },
  picks: {
    eyebrow: "Fly Time Picks",
    title: "Picked deal cards",
    description: "Edit the homepage offers rail, pricing copy, images and destination links.",
  },
  testimonials: {
    eyebrow: "Traveler Voices",
    title: "Story cards",
    description: "Edit the traveler voices heading and testimonial cards shown on the homepage.",
  },
};

type MediaOptionSort = "latest" | "az" | "za";

export function HomeContentEditor({
  initialContent,
  view = "all",
}: HomeContentEditorProps) {
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
  const expectedCollections = collectionDefinitions.filter((collection) => {
    if (view === "routes") return collection.type === "route_board";
    if (view === "picks") return collection.type === "flytime_picks";
    return view === "all";
  });
  const missingCollections = expectedCollections.filter(
    (expected) =>
      !content.collections.some(
        (collection) =>
          collection.type === expected.type && collection.status !== "archived",
      ),
  );
  const sections = content.sections.filter((section) => {
    if (view === "services") return section.key === "services";
    if (view === "testimonials") return section.key === "testimonials";
    return view === "all";
  });
  const collections = content.collections.filter((collection) => {
    if (view === "routes") return collection.type === "route_board";
    if (view === "picks") return collection.type === "flytime_picks";
    return view === "all";
  });
  const showSections = sections.length > 0;
  const showCollections = collections.length > 0 || missingCollections.length > 0;
  const showServices = view === "all" || view === "services";
  const showTestimonials = view === "all" || view === "testimonials";
  const meta = viewMeta[view];

  return (
    <section className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] md:flex-row md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            <Layers3 aria-hidden="true" className="size-4" />
            {meta.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-black">{meta.title}</h2>
          <p className="mt-1 text-sm font-semibold text-brand-brown">
            {meta.description}
          </p>
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

      {showSections ? (
        <EditorGroup
          title={view === "all" ? "Homepage section copy" : "Section copy"}
          description="Headings for homepage areas that are not card collections."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {sections.map((section) => (
              <SectionCopyForm
                key={`${section.key}-${refreshKey}`}
                section={section}
                disabled={saving}
                active={mutation.target === section.key}
                onSubmit={(event) =>
                  saveForm(
                    event,
                    section.key,
                    `/api/admin/home/content/sections/${section.key}`,
                    sectionCopyPayload,
                  )
                }
              />
            ))}
          </div>
        </EditorGroup>
      ) : null}

      {showCollections ? (
        <EditorGroup title="Section heading" description="Heading and intro text for this homepage card collection.">
          <div className="grid gap-3 lg:grid-cols-2">
            {collections.map((collection) => (
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
      ) : null}

      {collections.map((collection) => (
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

      {showServices ? (
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
      ) : null}

      {showTestimonials ? (
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
      ) : null}
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

function SectionCopyForm({
  section,
  disabled,
  active,
  onSubmit,
}: {
  section: AdminHomeSectionCopy;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="eyebrow" label="Eyebrow" value={section.eyebrow} />
        <StatusField value={section.status} />
        <TextField
          name="title"
          label="Heading"
          value={section.title}
          className="sm:col-span-2"
          required
        />
        <TextField
          name="description"
          label="Subtitle"
          value={section.description}
          className="sm:col-span-2"
        />
      </div>
      <SaveAction disabled={disabled} active={active} label="Save section copy" />
    </FormCard>
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
  const [selectedId, setSelectedId] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MediaOptionSort>("latest");
  const selected = media.find((item) => item.id === selectedId);
  const filteredMedia = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const items = normalizedQuery
      ? media.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.imageAlt.toLowerCase().includes(normalizedQuery),
        )
      : [...media];

    if (sort === "az") {
      return items.sort((a, b) => a.label.localeCompare(b.label));
    }

    if (sort === "za") {
      return items.sort((a, b) => b.label.localeCompare(a.label));
    }

    return items;
  }, [media, query, sort]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [pickerOpen]);

  return (
    <div className="grid gap-1 text-xs font-bold text-brand-brown">
      <span>Image asset</span>
      <select
        name="mediaId"
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        required={required}
        className="sr-only"
        aria-label="Selected image asset"
      >
        <option value="">No image</option>
        {media.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <div className="grid gap-2 rounded-md border border-[#d7c5ad] bg-white p-2 dark:border-white/10 dark:bg-white/10">
        {selected ? (
          <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
            <span className="relative block aspect-video overflow-hidden rounded-md bg-brand-navy/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.imageUrl}
                alt={selected.imageAlt || selected.label}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-brand-navy dark:text-white">
                {selected.label}
              </span>
              <span className="mt-1 block truncate text-[11px] font-bold text-brand-brown">
                {selected.imageAlt || "Selected media"}
              </span>
            </span>
          </div>
        ) : (
          <div className="flex min-h-16 items-center gap-3 rounded-md bg-[#fffaf2] px-3 dark:bg-white/10">
            <ImageIcon aria-hidden="true" className="size-5 text-brand-brown" />
            <span className="text-sm font-black text-brand-navy dark:text-white">
              No image selected
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md bg-brand-navy px-3 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
          >
            <ImageIcon aria-hidden="true" className="size-4" />
            Select image
          </button>
          {!required && selectedId ? (
            <button
              type="button"
              onClick={() => setSelectedId("")}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown dark:border-white/15 dark:text-brand-sand"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close media picker backdrop"
            onClick={() => setPickerOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="absolute inset-y-0 right-0 flex h-full w-full max-w-[620px] flex-col border-l border-[#d7c5ad] bg-white text-brand-navy shadow-2xl dark:border-white/10 dark:bg-[#0d0d0d] dark:text-white">
            <header className="shrink-0 border-b border-[#d7c5ad] p-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-brown">
                    Media library
                  </p>
                  <h3 className="font-serif text-2xl font-black">
                    Select image asset
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close media picker"
                  onClick={() => setPickerOpen(false)}
                  className="grid size-9 place-items-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <form
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]"
                onSubmit={(event) => event.preventDefault()}
              >
                <label className="relative min-w-0">
                  <span className="sr-only">Search media</span>
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-brown"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search media"
                    className="min-h-11 w-full rounded-lg border border-[#d7c5ad] bg-[#fffaf2] pl-10 pr-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
                  />
                </label>
                <label>
                  <span className="sr-only">Sort media</span>
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as MediaOptionSort)
                    }
                    className="min-h-11 w-full rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
                  >
                    <option value="latest">Latest</option>
                    <option value="az">A to Z</option>
                    <option value="za">Z to A</option>
                  </select>
                </label>
              </form>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {filteredMedia.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setPickerOpen(false);
                    }}
                    className={[
                      "overflow-hidden rounded-lg border bg-[#fffaf2] text-left transition dark:bg-white/10",
                      selectedId === item.id
                        ? "border-brand-blue ring-2 ring-brand-blue/25"
                        : "border-[#d7c5ad] hover:border-brand-blue dark:border-white/10",
                    ].join(" ")}
                  >
                    <span className="relative block aspect-video bg-brand-navy/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt || item.label}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="block p-3">
                      <span className="block truncate text-sm font-black text-brand-navy dark:text-white">
                        {item.label}
                      </span>
                      <span className="mt-1 block truncate text-xs font-bold text-brand-brown">
                        {item.imageAlt || "Media asset"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {filteredMedia.length === 0 ? (
                <p className="mt-5 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-4 text-sm font-bold text-brand-brown dark:border-white/10 dark:bg-white/10">
                  No media matched your search.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
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

function sectionCopyPayload(data: FormData) {
  return {
    title: field(data, "title"),
    eyebrow: field(data, "eyebrow"),
    description: field(data, "description"),
    status: field(data, "status"),
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
