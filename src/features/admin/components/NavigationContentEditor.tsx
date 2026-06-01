"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  LayoutPanelTop,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  AdminFooterColumn,
  AdminFooterLink,
  AdminHeaderNavigationItem,
  AdminNavigationContent,
  AdminNavigationStatus,
} from "@/types/navigation";

type NavigationContentEditorProps = {
  initialContent: AdminNavigationContent;
};

type MutationState = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
  target?: string;
};

export function NavigationContentEditor({
  initialContent,
}: NavigationContentEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mutation, setMutation] = useState<MutationState>({
    state: "idle",
    message:
      initialContent.source === "database"
        ? "Published link changes appear throughout the public site after save."
        : "The database must be configured before navigation can be edited.",
  });
  const topLevelItems = content.headerItems.filter(
    (item) => !item.parentId && item.status !== "archived",
  );
  const saving = mutation.state === "saving";

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
        | { ok?: boolean; data?: { content?: AdminNavigationContent } }
        | null;
      const nextContent = result?.data?.content;

      if (!response.ok || result?.ok !== true || !nextContent) {
        throw new Error("save-failed");
      }

      setContent(nextContent);
      setRefreshKey((value) => value + 1);
      setMutation({
        state: "saved",
        message: "Navigation content saved and public layout refreshed.",
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
    payload: (form: FormData) => Record<string, unknown>,
    method: "POST" | "PATCH" = "PATCH",
  ) {
    event.preventDefault();
    void mutate(target, method, path, payload(new FormData(event.currentTarget)));
  }

  return (
    <section className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] md:flex-row md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            <LayoutPanelTop aria-hidden="true" className="size-4" />
            Site navigation
          </p>
          <h2 className="mt-2 text-xl font-black">Header and footer links</h2>
        </div>
        <StatusMessage state={mutation} />
      </header>

      <EditorGroup
        title="Header navigation"
        description="Top-level links and dropdown children used in desktop and mobile navigation."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {content.headerItems.map((item) => (
            <HeaderItemForm
              key={`${item.id}-${refreshKey}`}
              item={item}
              parents={topLevelItems.filter((parent) => parent.id !== item.id)}
              disabled={saving}
              active={mutation.target === item.id}
              onSubmit={(event) =>
                saveForm(
                  event,
                  item.id,
                  `/api/admin/navigation/content/header-items/${item.id}`,
                  headerPayload,
                )
              }
              onArchive={() =>
                void mutate(
                  item.id,
                  "DELETE",
                  `/api/admin/navigation/content/header-items/${item.id}`,
                )
              }
            />
          ))}
        </div>
        <NewHeaderItemForm
          key={`new-header-${refreshKey}`}
          parents={topLevelItems}
          disabled={saving}
          onSubmit={(event) =>
            saveForm(
              event,
              "new-header-item",
              "/api/admin/navigation/content/header-items",
              headerPayload,
              "POST",
            )
          }
        />
      </EditorGroup>

      <EditorGroup
        title="Footer columns"
        description="Groups and links rendered in the footer on every public page."
      >
        <div className="grid gap-4">
          {content.footerColumns.map((column) => (
            <FooterColumnForm
              key={`${column.id}-${refreshKey}`}
              column={column}
              links={content.footerLinks.filter(
                (link) => link.columnId === column.id,
              )}
              disabled={saving}
              active={mutation.target === column.id}
              activeTarget={mutation.target}
              onSubmit={(event) =>
                saveForm(
                  event,
                  column.id,
                  `/api/admin/navigation/content/footer-columns/${column.id}`,
                  footerColumnPayload,
                )
              }
              onArchive={() =>
                void mutate(
                  column.id,
                  "DELETE",
                  `/api/admin/navigation/content/footer-columns/${column.id}`,
                )
              }
              onLinkSubmit={(event, link) =>
                saveForm(
                  event,
                  link.id,
                  `/api/admin/navigation/content/footer-links/${link.id}`,
                  footerLinkPayload,
                )
              }
              onLinkArchive={(linkId) =>
                void mutate(
                  linkId,
                  "DELETE",
                  `/api/admin/navigation/content/footer-links/${linkId}`,
                )
              }
              onNewLinkSubmit={(event) =>
                saveForm(
                  event,
                  `new-link-${column.id}`,
                  "/api/admin/navigation/content/footer-links",
                  (form) => ({
                    ...footerLinkPayload(form),
                    columnId: column.id,
                  }),
                  "POST",
                )
              }
            />
          ))}
        </div>
        <NewFooterColumnForm
          key={`new-footer-column-${refreshKey}`}
          disabled={saving}
          onSubmit={(event) =>
            saveForm(
              event,
              "new-footer-column",
              "/api/admin/navigation/content/footer-columns",
              footerColumnPayload,
              "POST",
            )
          }
        />
      </EditorGroup>
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
        <LayoutPanelTop aria-hidden="true" className="size-4" />
      )}
      {state.message}
    </div>
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

function HeaderItemForm({
  item,
  parents,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  item: AdminHeaderNavigationItem;
  parents: AdminHeaderNavigationItem[];
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="label" label="Label" value={item.label} required />
        <TextField name="href" label="Site path" value={item.href} required />
        <ParentField value={item.parentId} parents={parents} />
        <StatusField value={item.status} />
        <NumberField value={item.sortOrder} />
        <BooleanField name="hasDropdown" label="Dropdown trigger" value={item.hasDropdown} />
      </div>
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewHeaderItemForm({
  parents,
  disabled,
  onSubmit,
}: {
  parents: AdminHeaderNavigationItem[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue">
        Add header link
      </summary>
      <FormCard onSubmit={onSubmit} inset>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField name="label" label="Label" required />
          <TextField name="href" label="Site path" value="/" required />
          <ParentField parents={parents} />
          <StatusField value="draft" />
          <NumberField value={99} />
          <BooleanField name="hasDropdown" label="Dropdown trigger" value={false} />
        </div>
        <SaveAction disabled={disabled} active={false} label="Create header link" icon={<Plus className="size-4" />} />
      </FormCard>
    </details>
  );
}

function FooterColumnForm({
  column,
  links,
  disabled,
  active,
  activeTarget,
  onSubmit,
  onArchive,
  onLinkSubmit,
  onLinkArchive,
  onNewLinkSubmit,
}: {
  column: AdminFooterColumn;
  links: AdminFooterLink[];
  disabled: boolean;
  active: boolean;
  activeTarget?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
  onLinkSubmit: (
    event: FormEvent<HTMLFormElement>,
    link: AdminFooterLink,
  ) => void;
  onLinkArchive: (linkId: string) => void;
  onNewLinkSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <article className="grid gap-4 rounded-lg border border-[#ead7bd] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <FormCard onSubmit={onSubmit} inset>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField name="title" label="Column title" value={column.title} required />
          <StatusField value={column.status} />
          <NumberField value={column.sortOrder} />
        </div>
        <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
      </FormCard>
      <div className="grid gap-3 xl:grid-cols-2">
        {links.map((link) => (
          <FormCard key={link.id} onSubmit={(event) => onLinkSubmit(event, link)} inset>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="label" label="Link label" value={link.label} required />
              <TextField name="href" label="Site path" value={link.href} required />
              <StatusField value={link.status} />
              <NumberField value={link.sortOrder} />
            </div>
            <RecordActions
              disabled={disabled}
              active={activeTarget === link.id}
              onArchive={() => onLinkArchive(link.id)}
            />
          </FormCard>
        ))}
      </div>
      <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
        <summary className="cursor-pointer text-sm font-black text-brand-blue">
          Add link to {column.title}
        </summary>
        <FormCard onSubmit={onNewLinkSubmit} inset>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField name="label" label="Link label" required />
            <TextField name="href" label="Site path" value="/" required />
            <StatusField value="draft" />
            <NumberField value={99} />
          </div>
          <SaveAction disabled={disabled} active={false} label="Create footer link" icon={<Plus className="size-4" />} />
        </FormCard>
      </details>
    </article>
  );
}

function NewFooterColumnForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 p-3">
      <summary className="cursor-pointer text-sm font-black text-brand-blue">
        Add footer column
      </summary>
      <FormCard onSubmit={onSubmit} inset>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <TextField name="title" label="Column title" required />
          <StatusField value="draft" />
          <NumberField value={99} />
        </div>
        <SaveAction disabled={disabled} active={false} label="Create footer column" icon={<Plus className="size-4" />} />
      </FormCard>
    </details>
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
          ? "grid gap-3"
          : "grid gap-3 rounded-lg border border-[#ead7bd] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.04]"
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
        className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function StatusField({ value }: { value: AdminNavigationStatus }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      Status
      <select
        name="status"
        defaultValue={value}
        className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
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
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      Sort order
      <input
        name="sortOrder"
        type="number"
        min={0}
        max={10000}
        defaultValue={value}
        className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function ParentField({
  value,
  parents,
}: {
  value?: string | null;
  parents: AdminHeaderNavigationItem[];
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      Dropdown parent
      <select
        name="parentId"
        defaultValue={value ?? ""}
        className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      >
        <option value="">Top-level item</option>
        {parents.map((parent) => (
          <option key={parent.id} value={parent.id}>
            {parent.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BooleanField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: boolean;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-bold text-brand-navy dark:border-white/15 dark:bg-black/30 dark:text-white">
      <input name={name} type="checkbox" defaultChecked={value} className="size-4 accent-[#123f76]" />
      {label}
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
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-navy px-3 text-sm font-black text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
    >
      {active ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon ?? <Save aria-hidden="true" className="size-4" />
      )}
      {label}
    </button>
  );
}

function headerPayload(form: FormData) {
  return {
    label: stringValue(form, "label"),
    href: stringValue(form, "href"),
    parentId: stringValue(form, "parentId"),
    hasDropdown: form.get("hasDropdown") === "on",
    status: stringValue(form, "status"),
    sortOrder: numberValue(form, "sortOrder"),
  };
}

function footerColumnPayload(form: FormData) {
  return {
    title: stringValue(form, "title"),
    status: stringValue(form, "status"),
    sortOrder: numberValue(form, "sortOrder"),
  };
}

function footerLinkPayload(form: FormData) {
  return {
    label: stringValue(form, "label"),
    href: stringValue(form, "href"),
    status: stringValue(form, "status"),
    sortOrder: numberValue(form, "sortOrder"),
  };
}

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function numberValue(form: FormData, key: string) {
  return Number(stringValue(form, key));
}
