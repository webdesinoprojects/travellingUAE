"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { VisaMediaField } from "@/features/admin/visa/components/VisaMediaField";
import {
  DocumentsEditor,
  FaqsEditor,
  ProcessStepsEditor,
  VisaTypesEditor,
  WhyChooseEditor,
} from "@/features/admin/visa/components/VisaListEditors";
import {
  ApplyFormEditor,
  CallFormEditor,
  ContactCardsEditor,
} from "@/features/admin/visa/components/VisaFormConfigEditor";
import type { VisaFormValues } from "@/features/admin/visa/form-values";

type SaveState = "idle" | "saving" | "success" | "error";

export function VisaDestinationForm({
  mode,
  destinationId,
  initial,
}: {
  mode: "create" | "edit";
  destinationId?: string;
  initial: VisaFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<VisaFormValues>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VisaFormValues>(key: K, value: VisaFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSave("saving");
    setError(null);

    const url =
      mode === "create"
        ? "/api/admin/visa/destinations"
        : `/api/admin/visa/destinations/${destinationId}`;

    try {
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; data?: { id?: string } }
        | null;

      if (!res.ok || !data?.ok) {
        setSave("error");
        setError(data?.error ?? "The destination could not be saved.");
        return;
      }

      setSave("success");
      if (mode === "create" && data.data?.id) {
        router.replace(`/admin/visa/destinations/${data.data.id}`);
      }
      router.refresh();
    } catch {
      setSave("error");
      setError("A network error occurred. Please try again.");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-6 pb-24">
      <Card title="Basics">
        <Grid>
          <Text label="Name" value={values.name} onChange={(v) => set("name", v)} required />
          <Text label="Slug" value={values.slug} onChange={(v) => set("slug", v)} required hint="lowercase-with-hyphens" />
          <Text label="Country code" value={values.countryCode} onChange={(v) => set("countryCode", v)} hint="e.g. AE" />
          <ReadOnly label="Category" value={values.category} />
          <Text label="Detail title" value={values.title} onChange={(v) => set("title", v)} className="sm:col-span-2" />
          <Text label="Subtitle / approval line" value={values.subtitle} onChange={(v) => set("subtitle", v)} className="sm:col-span-2" />
        </Grid>
      </Card>

      <Card title="Pricing & facts">
        <Grid>
          <Text label="Starting price" value={values.startingPrice} onChange={(v) => set("startingPrice", v)} type="number" />
          <Text label="Currency" value={values.currency} onChange={(v) => set("currency", v)} hint="e.g. INR" />
          <Text label="Processing time" value={values.processingTime} onChange={(v) => set("processingTime", v)} />
          <Text label="Stay period" value={values.stayPeriod} onChange={(v) => set("stayPeriod", v)} />
          <Text label="Validity" value={values.validity} onChange={(v) => set("validity", v)} />
          <Text label="Entry type" value={values.entryType} onChange={(v) => set("entryType", v)} />
          <Text label="Sort order" value={values.sortOrder} onChange={(v) => set("sortOrder", v)} type="number" />
          <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
            <Toggle label="Featured" checked={values.isFeatured} onChange={(v) => set("isFeatured", v)} />
            <Toggle label="Published" checked={values.isPublished} onChange={(v) => set("isPublished", v)} />
          </div>
        </Grid>
      </Card>

      <Card title="Images" hint="Select from the media library, or paste a local path / ik.imagekit.io / images.unsplash.com / res.cloudinary.com URL.">
        <div className="grid gap-3">
          <VisaMediaField label="Card image" value={values.cardImageUrl} altValue={values.cardImageAlt} onChange={(v) => set("cardImageUrl", v)} onAltChange={(v) => set("cardImageAlt", v)} />
          <VisaMediaField label="Hero image" value={values.heroImageUrl} altValue={values.heroImageAlt} onChange={(v) => set("heroImageUrl", v)} onAltChange={(v) => set("heroImageAlt", v)} />
          <VisaMediaField label="Process image" value={values.processImageUrl} altValue={values.processImageAlt} onChange={(v) => set("processImageUrl", v)} onAltChange={(v) => set("processImageAlt", v)} />
          <VisaMediaField label="Sample visa image" value={values.sampleVisaImageUrl} altValue={values.sampleVisaImageAlt} onChange={(v) => set("sampleVisaImageUrl", v)} onAltChange={(v) => set("sampleVisaImageAlt", v)} />
        </div>
      </Card>

      <Card title="Visa types">
        <VisaTypesEditor items={values.visaTypes} onChange={(v) => set("visaTypes", v)} />
      </Card>

      <Card title="Documents">
        <DocumentsEditor items={values.documents} onChange={(v) => set("documents", v)} />
      </Card>

      <Card title="Process steps">
        <ProcessStepsEditor items={values.processSteps} onChange={(v) => set("processSteps", v)} />
      </Card>

      <Card title="Why choose us">
        <WhyChooseEditor label="Points" addLabel="Add point" items={values.whyChoose} onChange={(v) => set("whyChoose", v)} />
      </Card>

      <Card title="FAQs">
        <FaqsEditor items={values.faqs} onChange={(v) => set("faqs", v)} />
      </Card>

      <Card title="Apply Online form">
        <ApplyFormEditor value={values.applyForm} onChange={(v) => set("applyForm", v)} />
      </Card>

      <Card title="Let us Call You form">
        <CallFormEditor value={values.callForm} onChange={(v) => set("callForm", v)} />
      </Card>

      <Card title="Sidebar contact cards">
        <ContactCardsEditor value={values.contactCards} onChange={(v) => set("contactCards", v)} />
      </Card>

      <Card title="SEO">
        <Grid>
          <Text label="SEO title" value={values.seoTitle} onChange={(v) => set("seoTitle", v)} className="sm:col-span-2" />
          <Text label="SEO description" value={values.seoDescription} onChange={(v) => set("seoDescription", v)} className="sm:col-span-2" />
        </Grid>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-soft bg-background/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="submit"
            disabled={save === "saving"}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-6 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
          >
            {save === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {save === "success" && !error ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
            {mode === "create" ? "Create destination" : "Save changes"}
          </button>
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
              <XCircle className="size-4" aria-hidden="true" />
              {error}
            </span>
          ) : save === "success" ? (
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Saved.</span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

// ---- Field primitives (responsive) ----------------------------------------

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="text-sm font-black uppercase tracking-[0.12em] text-brand-brown">{title}</h2>
      {hint ? <p className="mt-1 text-xs font-semibold text-brand-brown/80">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.1em] text-brand-brown">
        {label} {required ? <span className="text-red-500">*</span> : null}
        {hint ? <span className="ml-1 lowercase text-brand-brown/70">({hint})</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-brand-brown">{label}</span>
      <span className="inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-surface-muted px-3 text-sm font-black capitalize">
        {value}
      </span>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-black">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-blue" />
      {label}
    </label>
  );
}
