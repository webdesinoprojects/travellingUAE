"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Link2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AdminFooterSettings } from "@/types/footer";

type FooterSettingsEditorProps = {
  initialSettings: AdminFooterSettings;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

export function FooterSettingsEditor({
  initialSettings,
}: FooterSettingsEditorProps) {
  const router = useRouter();

  const [contact, setContact] = useState({
    tagline: initialSettings.contact.tagline,
    address: initialSettings.contact.address,
    phone: initialSettings.contact.phone,
    email: initialSettings.contact.email,
  });

  const [socialLinks, setSocialLinks] = useState(
    initialSettings.socialLinks.map((l) => ({ ...l })),
  );

  const [status, setStatus] = useState<"draft" | "published">(
    initialSettings.status === "published" ? "published" : "draft",
  );

  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message:
      initialSettings.source === "database"
        ? "Footer settings loaded from CMS."
        : "No CMS footer saved yet — showing fallback values.",
  });

  const saving = saveState.status === "saving";

  function updateSocialHref(index: number, href: string) {
    setSocialLinks((current) =>
      current.map((link, i) => (i === index ? { ...link, href } : link)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ status: "saving", message: "Saving…" });

    try {
      const response = await fetch("/api/admin/home/footer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          socialLinks,
          status,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { footer?: AdminFooterSettings } }
        | null;

      const saved = result?.data?.footer;

      if (!response.ok || result?.ok !== true || !saved) {
        throw new Error("save-failed");
      }

      setContact({
        tagline: saved.contact.tagline,
        address: saved.contact.address,
        phone: saved.contact.phone,
        email: saved.contact.email,
      });
      setSocialLinks(saved.socialLinks.map((l) => ({ ...l })));
      setStatus(saved.status === "published" ? "published" : "draft");
      setSaveState({
        status: "saved",
        message:
          saved.status === "published"
            ? "Footer settings published."
            : "Draft saved. Public footer keeps its fallback values.",
      });
      router.refresh();
    } catch {
      setSaveState({
        status: "error",
        message: "Footer settings could not be saved. Check the form and try again.",
      });
    }
  }

  return (
    <section className="grid gap-5 rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
          Footer CMS
        </p>
        <h2 className="mt-2 text-xl font-black">Contact &amp; Social Links</h2>
      </div>

      <form onSubmit={onSubmit} className="grid gap-5">
        <fieldset className="grid gap-4 rounded-lg border border-[#d7c5ad] p-4 dark:border-white/10">
          <legend className="px-1 text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
            Contact info
          </legend>

          <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
            Tagline
            <textarea
              rows={3}
              maxLength={400}
              value={contact.tagline}
              onChange={(e) =>
                setContact((c) => ({ ...c, tagline: e.target.value }))
              }
              className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
            Address
            <input
              type="text"
              maxLength={300}
              value={contact.address}
              onChange={(e) =>
                setContact((c) => ({ ...c, address: e.target.value }))
              }
              className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
              Phone
              <input
                type="text"
                maxLength={40}
                value={contact.phone}
                onChange={(e) =>
                  setContact((c) => ({ ...c, phone: e.target.value }))
                }
                className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
              Email
              <input
                type="email"
                maxLength={120}
                value={contact.email}
                onChange={(e) =>
                  setContact((c) => ({ ...c, email: e.target.value }))
                }
                className="min-h-12 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-sm text-brand-navy outline-none focus:border-brand-blue dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border border-[#d7c5ad] p-4 dark:border-white/10">
          <legend className="px-1 text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
            Social links
          </legend>

          <p className="text-xs font-semibold text-brand-brown">
            Use <code className="rounded bg-[#fffaf2] px-1 dark:bg-white/10">#</code> to hide a link, or a full{" "}
            <code className="rounded bg-[#fffaf2] px-1 dark:bg-white/10">https://</code> URL.
          </p>

          <div className="grid gap-3">
            {socialLinks.map((link, index) => (
              <label
                key={link.platform}
                className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white sm:grid-cols-[100px_1fr] sm:items-center"
              >
                <span className="capitalize">{link.platform}</span>
                <div className="flex items-center gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 dark:border-white/10 dark:bg-white/10">
                  <Link2 aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
                  <input
                    type="text"
                    maxLength={300}
                    value={link.href}
                    onChange={(e) => updateSocialHref(index, e.target.value)}
                    placeholder="# or https://..."
                    className="min-h-11 flex-1 bg-transparent text-sm text-brand-navy outline-none dark:text-white"
                  />
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-2 text-sm font-bold text-brand-navy dark:text-white">
          Visibility
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "draft" | "published")
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
            <Link2 aria-hidden="true" className="size-4" />
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
          Save Footer Settings
        </button>
      </form>
    </section>
  );
}
