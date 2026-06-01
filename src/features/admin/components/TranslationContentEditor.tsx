"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  Languages,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import type {
  AdminTranslationContent,
  AdminTranslationEntry,
  AdminTranslationStatus,
  PublicLocale,
} from "@/types/locale";

type TranslationContentEditorProps = {
  initialContent: AdminTranslationContent;
};

type MutationState = {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
  target?: string;
};

export function TranslationContentEditor({
  initialContent,
}: TranslationContentEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [mutation, setMutation] = useState<MutationState>({
    state: "idle",
    message:
      initialContent.source === "database"
        ? "Published phrases are served to the public locale bundle after save."
        : "The database must be configured before translations can be edited.",
  });
  const saving = mutation.state === "saving";
  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return content.entries.filter((entry) => {
      if (entry.status === "archived") {
        return false;
      }

      if (localeFilter !== "all" && entry.locale !== localeFilter) {
        return false;
      }

      return (
        !needle ||
        entry.namespace.toLowerCase().includes(needle) ||
        entry.key.toLowerCase().includes(needle) ||
        entry.value.toLowerCase().includes(needle)
      );
    });
  }, [content.entries, localeFilter, query]);

  async function refreshContent() {
    const response = await fetch("/api/admin/translations/content", {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: { content?: AdminTranslationContent } }
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
    setMutation({ state: "saving", message: "Saving phrase...", target });

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
        message: "Translation saved and public locale content refreshed.",
      });
      router.refresh();
    } catch {
      setMutation({
        state: "error",
        message:
          "This phrase could not be saved. Use a valid locale, namespace, key and text.",
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
    void mutate(
      target,
      method,
      path,
      translationPayload(new FormData(event.currentTarget)),
    );
  }

  return (
    <section className="grid gap-5">
      <header className="grid gap-4 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            <Languages aria-hidden="true" className="size-4" />
            Locale content
          </p>
          <h2 className="mt-2 text-xl font-black">English and Arabic phrases</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex min-h-11 min-w-[230px] items-center gap-2 rounded-lg border border-[#d7c5ad] bg-white px-3 text-brand-brown dark:border-white/15 dark:bg-black/30">
              <Search aria-hidden="true" className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search phrases"
                className="w-full bg-transparent text-sm font-semibold text-brand-navy outline-none dark:text-white"
              />
            </label>
            <select
              value={localeFilter}
              onChange={(event) => setLocaleFilter(event.target.value)}
              aria-label="Filter by locale"
              className="min-h-11 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
            >
              <option value="all">All locales</option>
              {content.locales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <StatusMessage state={mutation} />
      </header>

      <div className="grid gap-3 xl:grid-cols-2">
        {visibleEntries.map((entry) => (
          <TranslationForm
            key={`${entry.id}-${refreshKey}`}
            entry={entry}
            locales={content.locales}
            disabled={saving}
            active={mutation.target === entry.id}
            onSubmit={(event) =>
              saveForm(
                event,
                entry.id,
                `/api/admin/resources/translations/${entry.id}`,
              )
            }
            onArchive={() =>
              void mutate(
                entry.id,
                "DELETE",
                `/api/admin/resources/translations/${entry.id}`,
              )
            }
          />
        ))}
      </div>

      <NewTranslationForm
        key={`new-translation-${refreshKey}`}
        locales={content.locales}
        disabled={saving}
        onSubmit={(event) =>
          saveForm(
            event,
            "new-translation",
            "/api/admin/resources/translations",
            "POST",
          )
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
        <Languages aria-hidden="true" className="size-4" />
      )}
      {state.message}
    </div>
  );
}

function TranslationForm({
  entry,
  locales,
  disabled,
  active,
  onSubmit,
  onArchive,
}: {
  entry: AdminTranslationEntry;
  locales: PublicLocale[];
  disabled: boolean;
  active: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  return (
    <FormCard onSubmit={onSubmit}>
      <TranslationFields entry={entry} locales={locales} />
      <RecordActions disabled={disabled} active={active} onArchive={onArchive} />
    </FormCard>
  );
}

function NewTranslationForm({
  locales,
  disabled,
  onSubmit,
}: {
  locales: PublicLocale[];
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-lg border border-dashed border-brand-brown/40 bg-white/45 p-4 dark:bg-white/[0.03]">
      <summary className="cursor-pointer text-sm font-black text-brand-blue dark:text-brand-sky">
        Add phrase
      </summary>
      <FormCard onSubmit={onSubmit} inset>
        <div className="mt-4">
          <TranslationFields locales={locales} />
        </div>
        <SaveAction
          disabled={disabled}
          active={false}
          label="Create phrase"
          icon={<Plus aria-hidden="true" className="size-4" />}
        />
      </FormCard>
    </details>
  );
}

function TranslationFields({
  entry,
  locales,
}: {
  entry?: AdminTranslationEntry;
  locales: PublicLocale[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
        Locale
        <select
          name="locale"
          defaultValue={entry?.locale ?? locales[0]?.code ?? "en"}
          className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
        >
          {locales.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.name}
            </option>
          ))}
        </select>
      </label>
      <StatusField value={entry?.status ?? "draft"} />
      <TextField
        name="namespace"
        label="Namespace"
        value={entry?.namespace}
        placeholder="home"
        required
      />
      <TextField
        name="key"
        label="Key"
        value={entry?.key}
        placeholder="hero.title"
        required
      />
      <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown sm:col-span-2">
        Text
        <textarea
          name="value"
          required
          defaultValue={entry?.value ?? ""}
          rows={3}
          className="rounded-lg border border-[#d7c5ad] bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
        />
      </label>
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
          : "grid gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]"
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
  placeholder,
  required = false,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      {label}
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        required={required}
        className="min-h-10 rounded-lg border border-[#d7c5ad] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-brand-navy outline-none focus:border-brand-blue dark:border-white/15 dark:bg-black/30 dark:text-white"
      />
    </label>
  );
}

function StatusField({ value }: { value: AdminTranslationStatus }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
      Visibility
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
      <SaveAction disabled={disabled} active={active} label="Save phrase" />
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

function translationPayload(form: FormData) {
  return {
    locale: stringValue(form, "locale"),
    namespace: stringValue(form, "namespace"),
    key: stringValue(form, "key"),
    value: stringValue(form, "value"),
    status: stringValue(form, "status"),
  };
}

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
