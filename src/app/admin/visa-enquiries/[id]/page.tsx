import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { requireAdminPageAccess } from "@/server/admin/access";
import {
  VISA_APPLY_SOURCE,
  markVisaEnquiryRead,
  type VisaEnquiryRow,
} from "@/server/admin/visa-enquiries";

export const dynamic = "force-dynamic";

export default async function VisaEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPageAccess("admin");
  const { id } = await params;
  const enquiry = await markVisaEnquiryRead(id, actor);

  if (!enquiry) {
    notFound();
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex min-w-0 items-center gap-3">
        <BackLink />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Visa desk
          </p>
          <h1 className="truncate font-serif text-2xl font-black tracking-tight">
            Enquiry detail
          </h1>
        </div>
      </div>

      <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <div className="mb-5 flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
              Public visa form submission
            </p>
            <h2 className="mt-1 break-words font-serif text-2xl font-black">
              {enquiry.fullName}
            </h2>
            <p className="mt-1 text-sm font-bold text-brand-brown">
              Received {formatDate(enquiry.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReadBadge readAt={enquiry.readAt} />
            <TypeBadge enquiry={enquiry} />
            <StatusBadge
              status={enquiry.status as Parameters<typeof StatusBadge>[0]["status"]}
            />
          </div>
        </div>

        <dl className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Info label="Name" value={enquiry.fullName} />
          <Info label="Email" value={enquiry.email ?? "Not provided"} />
          <Info label="Phone" value={enquiry.phone ?? "Not provided"} />
          <Info label="Subject" value={enquiry.subject ?? "Not provided"} />
          <Info label="Source" value={enquiry.source} />
          <Info label="Type" value={enquiry.typeLabel} />
          <Info label="Destination" value={enquiry.destination || "Not provided"} />
          <Info label="Visa type" value={enquiry.visaType || "Not provided"} />
          <Info
            label="Travellers"
            value={enquiry.travelers == null ? "Not provided" : String(enquiry.travelers)}
          />
          <Info label="Internal notes" value={enquiry.adminNotes || "No internal notes"} />
          <Info label="Updated" value={formatDate(enquiry.updatedAt)} />
          <Info
            label="Read state"
            value={
              enquiry.readAt
                ? `Read ${formatDate(enquiry.readAt)}${enquiry.readBy ? ` by ${enquiry.readBy}` : ""}`
                : "Unread"
            }
          />
        </dl>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <TextPanel title="Message" body={enquiry.message} preserve />
        <TextPanel title="Metadata summary" body={metadataSummary(enquiry)} preserve />
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/visa-enquiries"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
      aria-label="Back to Visa enquiries"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function ReadBadge({ readAt }: { readAt: string | null }) {
  if (readAt) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-200">
        Read
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-800 dark:text-amber-200">
      Unread
    </span>
  );
}

function TypeBadge({ enquiry }: { enquiry: VisaEnquiryRow }) {
  const className =
    enquiry.source === VISA_APPLY_SOURCE
      ? "border-brand-blue/20 bg-brand-blue/10 text-brand-blue dark:text-brand-sand"
      : "border-brand-brown/20 bg-brand-sand/35 text-brand-brown dark:bg-brand-sand/15 dark:text-brand-sand";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {enquiry.typeLabel}
    </span>
  );
}

function TextPanel({
  title,
  body,
  preserve = false,
}: {
  title: string;
  body: string;
  preserve?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      <p
        className={[
          "break-words text-sm font-semibold leading-7 text-brand-navy/82 [overflow-wrap:anywhere] dark:text-white/78",
          preserve ? "whitespace-pre-wrap" : "",
        ].join(" ")}
      >
        {body}
      </p>
    </section>
  );
}

function metadataSummary(enquiry: VisaEnquiryRow) {
  return [
    `Source: ${enquiry.source}`,
    `Type: ${enquiry.typeLabel}`,
    `Destination: ${enquiry.destination || "Not provided"}`,
    `Visa type: ${enquiry.visaType || "Not provided"}`,
    `Travellers: ${enquiry.travelers == null ? "Not provided" : enquiry.travelers}`,
    `Read at: ${enquiry.readAt || "Unread"}`,
    `Read by: ${enquiry.readBy || "Not recorded"}`,
  ].join("\n");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}
