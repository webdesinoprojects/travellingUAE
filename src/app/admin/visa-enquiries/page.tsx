import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { requireAdminPageAccess } from "@/server/admin/access";
import {
  VISA_APPLY_SOURCE,
  VISA_CALL_SOURCE,
  listVisaEnquiries,
  type VisaEnquiryRow,
} from "@/server/admin/visa-enquiries";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function VisaEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPageAccess("admin");

  const params = await searchParams;
  const q = singleParam(params.q);
  const page = parsePage(singleParam(params.page));
  const status = singleParam(params.status);
  const type = singleParam(params.type);
  const { source, enquiries, pageSize, total, totalPages } = await listVisaEnquiries({
    q,
    page,
    status,
    type,
  });
  const visibleStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = Math.min(page * pageSize, total);

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-[#d7c5ad] bg-brand-navy p-5 text-white shadow-[0_22px_70px_rgb(7_23_57/0.16)] dark:border-white/10">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-sand">
              Visa desk
            </p>
            <h1 className="mt-3 font-serif text-3xl font-black tracking-tight sm:text-4xl">
              Visa Enquiries
            </h1>
            <p className="mt-3 break-words text-sm font-semibold leading-6 text-[#c2e8ff] sm:text-base">
              Review visa leads stored in contact submissions. These records are
              filtered by source:{" "}
              <span className="font-black">{VISA_APPLY_SOURCE}</span> and{" "}
              <span className="font-black">{VISA_CALL_SOURCE}</span>.
            </p>
          </div>
          <div className="w-fit rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-brand-sand">
            {visibleStart}-{visibleEnd} of {total}
          </div>
        </div>
      </section>

      <form
        role="search"
        className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-3 shadow-[0_4px_20px_rgb(7_23_57/0.05)] dark:border-white/10 dark:bg-white/[0.06]"
      >
        <label className="flex min-w-0 basis-full items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 dark:bg-white/10 sm:basis-[300px] lg:flex-1">
          <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
          <input
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search name, email, phone, subject, or message"
            aria-label="Search visa enquiries"
            className="flex-1 bg-transparent text-sm font-semibold text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
          />
        </label>
        <select
          name="type"
          defaultValue={type ?? ""}
          aria-label="Filter by visa enquiry type"
          className="min-h-10 rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-bold text-brand-navy outline-none [color-scheme:light] dark:border-white/10 dark:bg-[#121212] dark:text-white dark:[color-scheme:dark]"
        >
          <option value="" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            All types
          </option>
          <option value="apply" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Apply Online
          </option>
          <option value="call" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Call Request
          </option>
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Filter by status"
          className="min-h-10 rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-bold text-brand-navy outline-none [color-scheme:light] dark:border-white/10 dark:bg-[#121212] dark:text-white dark:[color-scheme:dark]"
        >
          <option value="" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            All statuses
          </option>
          <option value="new" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            New
          </option>
          <option value="contacted" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Contacted
          </option>
          <option value="confirmed" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Confirmed
          </option>
          <option value="cancelled" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Cancelled
          </option>
          <option value="completed" className="bg-[#fffaf2] text-brand-navy dark:bg-[#121212] dark:text-white">
            Completed
          </option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
        >
          Apply
        </button>
      </form>

      {source === "unconfigured" ? (
        <EmptyState message="Database is not configured. Visa enquiries are unavailable." />
      ) : enquiries.length === 0 ? (
        <EmptyState message="No Visa enquiries found." />
      ) : (
        <>
          <EnquiriesTable enquiries={enquiries} />
          <Pagination
            page={page}
            totalPages={totalPages}
            q={q}
            status={status}
            type={type}
          />
        </>
      )}
    </div>
  );
}

function EnquiriesTable({ enquiries }: { enquiries: VisaEnquiryRow[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#d7c5ad] bg-white/78 p-2 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] sm:p-3">
      <div className="max-w-full overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#d7c5ad_transparent]">
        <table className="w-full min-w-[1060px] table-fixed text-left text-xs">
          <thead>
            <tr className="border-b border-[#d7c5ad] text-[11px] uppercase tracking-[0.12em] text-brand-brown dark:border-white/10">
              <th className="w-[82px] py-2 pr-2">Read</th>
              <th className="w-[112px] py-2 pr-2">Received</th>
              <th className="w-[118px] py-2 pr-2">Type</th>
              <th className="w-[145px] py-2 pr-2">Name</th>
              <th className="w-[130px] py-2 pr-2">Phone</th>
              <th className="w-[170px] py-2 pr-2">Email</th>
              <th className="w-[170px] py-2 pr-2">Subject</th>
              <th className="w-[130px] py-2 pr-2">Visa type</th>
              <th className="w-[96px] py-2 pr-2">Status</th>
              <th className="w-[170px] py-2 pr-2">Message</th>
              <th className="w-[52px] py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => (
              <tr
                key={enquiry.id}
                className="border-b border-[#ead7bd] last:border-none dark:border-white/10"
              >
                <td className="py-2 pr-2">
                  <ReadBadge readAt={enquiry.readAt} />
                </td>
                <td className="truncate py-2 pr-2 font-bold">
                  {formatDate(enquiry.createdAt)}
                </td>
                <td className="py-2 pr-2">
                  <TypeBadge source={enquiry.source} label={enquiry.typeLabel} />
                </td>
                <td className="truncate py-2 pr-2 font-bold">{enquiry.fullName}</td>
                <td className="truncate py-2 pr-2 font-bold">{enquiry.phone ?? "-"}</td>
                <td className="truncate py-2 pr-2 font-bold">{enquiry.email ?? "-"}</td>
                <td className="truncate py-2 pr-2 font-bold">
                  {enquiry.subject ?? "-"}
                </td>
                <td className="truncate py-2 pr-2 font-bold">
                  {enquiry.visaType || "-"}
                </td>
                <td className="py-2 pr-2">
                  <StatusBadge
                    status={
                      enquiry.status as Parameters<typeof StatusBadge>[0]["status"]
                    }
                  />
                </td>
                <td className="py-2 pr-2 font-semibold text-brand-brown">
                  <span className="line-clamp-2">{messagePreview(enquiry.message)}</span>
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/visa-enquiries/${enquiry.id}`}
                    className="inline-grid size-9 place-items-center rounded-lg bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy"
                    aria-label={`Open visa enquiry from ${enquiry.fullName}`}
                  >
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReadBadge({ readAt }: { readAt: string | null }) {
  if (readAt) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-200">
        Read
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-1 text-[11px] font-black text-amber-800 dark:text-amber-200">
      Unread
    </span>
  );
}

function TypeBadge({
  source,
  label,
}: {
  source: VisaEnquiryRow["source"];
  label: string;
}) {
  const className =
    source === VISA_APPLY_SOURCE
      ? "border-brand-blue/20 bg-brand-blue/10 text-brand-blue dark:text-brand-sand"
      : "border-brand-brown/20 bg-brand-sand/35 text-brand-brown dark:bg-brand-sand/15 dark:text-brand-sand";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${className}`}>
      {label}
    </span>
  );
}

function Pagination({
  page,
  q,
  status,
  type,
  totalPages,
}: {
  page: number;
  q?: string;
  status?: string;
  type?: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Visa enquiry pages"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7c5ad] bg-white/78 p-3 text-sm font-bold text-brand-brown dark:border-white/10 dark:bg-white/[0.06]"
    >
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <PageLink
          disabled={page <= 1}
          href={paginationHref({ page: page - 1, q, status, type })}
          label="Previous"
        />
        <PageLink
          disabled={page >= totalPages}
          href={paginationHref({ page: page + 1, q, status, type })}
          label="Next"
        />
      </div>
    </nav>
  );
}

function PageLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="inline-flex min-h-10 items-center rounded-lg border border-[#d7c5ad] px-3 text-brand-brown/50">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-3 text-brand-navy transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
    >
      {label}
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-sm font-black text-brand-brown">{message}</p>
    </section>
  );
}

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value[0]
      : undefined;
}

function parsePage(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

function paginationHref({
  page,
  q,
  status,
  type,
}: {
  page: number;
  q?: string;
  status?: string;
  type?: string;
}) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (type) params.set("type", type);

  const query = params.toString();
  return query ? `/admin/visa-enquiries?${query}` : "/admin/visa-enquiries";
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

function messagePreview(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 140);
}
