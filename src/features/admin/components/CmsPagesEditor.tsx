"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import type {
  AdminCmsPage,
  AdminCmsPageContent,
  AdminCmsPageStatus,
} from "@/types/cms";

type CmsPagesEditorProps = {
  initialContent: AdminCmsPageContent;
};

type MutationState = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
  target?: string;
};

export function CmsPagesEditor({ initialContent }: CmsPagesEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mutation, setMutation] = useState<MutationState>({
    state: "idle",
    message:
      initialContent.source === "database"
        ? "Published page changes appear on their public URL after save."
        : "The database must be configured before pages can be edited.",
  });
  const saving = mutation.state === "saving";
  const activePages = content.pages.filter((page) => page.status !== "archived");
  const archivedCount = content.pages.length - activePages.length;

  async function refreshContent() {
    const response = await fetch("/api/admin/pages/content", {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: { content?: AdminCmsPageContent } }
      | null;
    const nextContent = result?.data?.content;

    if (!response.ok || result?.ok !== true || !nextContent) {
      throw new Error("refresh-failed");
    }

    setContent(nextContent);
    setRefreshKey((value) => value + 1);
  }

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
        | { ok?: boolean }
        | null;

      if (!response.ok || result?.ok !== true) {
        throw new Error("save-failed");
      }

      await refreshContent();
      setMutation({
        state: "saved",
        message: "Page content saved and public page cache refreshed.",
      });
      router.refresh();
    } catch {
      setMutation({
        state: "error",
        message:
          "This page could not be saved. Published pages need a URL slug, title and content.",
      });
    }
  }

  function saveForm(
    event: FormEvent<HTMLFormElement>,
    target: string,
    path: string,
    method: "POST" | "PATCH" = "PATCH",
  ) {
    event.preventDefault();
    void mutate(target, method, path, pagePayload(new FormData(event.currentTarget)));
  }

  return (
    <section className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] md:flex-row md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            <FileText aria-hidden="true" className="size-4" />
            Content pages
          </p>
          <h2 className="mt-2 text-xl font-black">Legal and service pages</h2>
          <p className="mt-1 text-sm font-semibold text-brand-brown">
            {activePages.length} active records
            {archivedCount > 0 ? `, ${archivedCount} archived` : ""}
          </p>
        </div>
        <StatusMessage state={mutation} />
      </header>

      <div className="grid gap-4">
        {activePages.map((page) => (
          <PageForm
            key={`${page.id}-${refreshKey}`}
            page={page}
            disabled={saving}
            active={mutation.target === page.id}
            onSubmit={(event) =>
              saveForm(
                event,
                page.id,
                `/api/admin/resources/pages/${page.id}`,
              )
            }
            onArchive={() =>
              void mutate(
                page.id,
                "DELETE",
                `/api/admin/resources/pages/${page.id}`,
              )
            }
          />
        ))}
      </div>

      <NewPageForm
        key={`new-page-${refreshKey}`}
        disabled={saving}
        onSubmit={(event) =>
          saveForm(event, "new-page", "/api/admin/resources/pages", "POST")
        }
      />
    </section>
  );
}

function StatusMessage({ state }: { state: MutationState }) {
  return (
    <div
      role="status"
      className={[
        "inline-flex max-w-lg items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold",
        state.state === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : state.state === "saved"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown dark:border-white/10 dark:bg-white/10 dark:text-brand-sand",
      ].join(" ")}
    >
      {state.state === "saving" ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state.state === "saved" ? (
        <CheckCircle2 aria-hidden="true" className="size-4" />
      ) : (
        <FileText aria-hidden="true" className="size-4" />
      )}
      {state.message}
    </div>
  );
}

function PageForm({
  page,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  page: AdminCmsPage;
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-black">{page.title}</h3>
          <p className="text-sm font-semibold text-brand-brown">/{page.slug}</p>
        </div>
        {page.status === "published" ? (
          <Link
            href={`/${page.slug}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-[#d7c5ad] px-3 text-sm font-black text-brand-blue dark:border-white/15 dark:text-brand-sky"
          >
            View public page
          </Link>
        ) : null}
      </div>
      <PageFields page={page} />
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewPageForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 bg-white/45 p-4 dark:bg-white/[0.03]">
      <summary className="cursor-pointer text-sm font-black text-brand-blue dark:text-brand-sky">
        Add content page
      </summary>
      <FormCard onSubmit={onSubmit} inset>
        <div className="mt-4">
          <p className="text-sm font-bold text-brand-brown">
            Leave the slug blank to generate it once from the title on creation.
          </p>
        </div>
        <PageFields />
        <SaveAction
          disabled={disabled}
          active={false}
          label="Create page"
          icon={<Plus aria-hidden="true" className="size-4" />}
        />
      </FormCard>
    </details>
  );
}

function PageFields({ page }: { page?: AdminCmsPage }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField name="title" label="Title" value={page?.title} required />
      <TextField name="slug" label="Public URL slug" value={page?.slug} />
      <TextAreaField
        name="excerpt"
        label="Summary"
        value={page?.excerpt}
        rows={2}
      />
      <StatusField value={page?.status ?? "draft"} />
      <TextAreaField
        name="body"
        label="Page content"
        value={page?.body}
        required
        rows={7}
        className="md:col-span-2"
      />
      <TextField name="seoTitle" label="SEO title" value={page?.seoTitle} />
      <TextField
        name="seoDescription"
        label="SEO description"
        value={page?.seoDescription}
      />
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
      className={
        inset
          ? "grid gap-4"
          : "grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]"
      }
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
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <input
        name={name}
        defaultValue={value}
        required={required}
        className="min-h-11 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
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
  className = "",
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  rows: number;
  className?: string;
}) {
  return (
    <label
      className={`grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown ${className}`}
    >
      {label}
      <textarea
        name={name}
        defaultValue={value}
        required={required}
        rows={rows}
        className="rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function StatusField({ value }: { value: AdminCmsPageStatus }) {
  return (
    <label className="grid content-start gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      Visibility
      <select
        name="status"
        defaultValue={value}
        className="min-h-11 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      >
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
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
      <SaveAction disabled={disabled} active={active} label="Save page" />
      <button
        type="button"
        disabled={disabled}
        onClick={onArchive}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d7c5ad] px-3 text-sm font-black text-brand-brown transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15"
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
      type="submit"
      disabled={disabled}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
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

function pagePayload(form: FormData) {
  return {
    title: stringValue(form, "title"),
    slug: stringValue(form, "slug"),
    excerpt: stringValue(form, "excerpt"),
    body: stringValue(form, "body"),
    seoTitle: stringValue(form, "seoTitle"),
    seoDescription: stringValue(form, "seoDescription"),
    status: stringValue(form, "status"),
  };
}

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
