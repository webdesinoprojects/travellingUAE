import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { AdminAnalyticsPanel } from "@/features/admin/components/AdminAnalyticsPanel";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import type {
  AdminActivity,
  AdminBooking,
  AdminCalendarDay,
  AdminDestinationStat,
  AdminFinanceItem,
  AdminMetric,
  AdminPackageCard,
  AdminQueueItem,
  AdminQuickAction,
  AdminTripHealth,
} from "@/features/admin/types";
import { getAdminDashboardDTO } from "@/server/admin/dal";

export async function AdminDashboard() {
  const dashboard = await getAdminDashboardDTO();

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid gap-5">
        <DashboardHero
          finance={dashboard.finance}
          quickActions={dashboard.quickActions}
          dataSource={dashboard.dataSource}
        />
        <MetricGrid metrics={dashboard.metrics} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <TravelPackages packages={dashboard.packageCards} />
          <TripHealthCard health={dashboard.tripHealth} />
        </div>

        <AdminAnalyticsPanel
          analyticsData={dashboard.analytics}
          pieSegments={dashboard.pieSegments}
          activePipelinePercent={dashboard.activePipelinePercent}
        />

        <BookingTable bookings={dashboard.bookings} />
      </section>

      <aside className="grid content-start gap-5">
        <CalendarCard days={dashboard.calendarDays} />
        <TopDestinations destinations={dashboard.destinationStats} />
        <ContentQueue items={dashboard.contentQueue} />
        <ActivityFeed activities={dashboard.activityFeed} />
      </aside>
    </div>
  );
}

function DashboardHero({
  finance,
  quickActions,
  dataSource,
}: {
  finance: AdminFinanceItem[];
  quickActions: AdminQuickAction[];
  dataSource: "database" | "fallback";
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d7c5ad] bg-brand-navy text-white shadow-[0_22px_70px_rgb(7_23_57/0.18)] dark:border-white/10">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-5">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase text-brand-sand">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {dataSource === "database" ? "Live operations" : "Preview data"}
          </div>
          <h2 className="max-w-3xl font-serif text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            Control room for trips, enquiries and content.
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#c2e8ff]">
            {dataSource === "database"
              ? "Protected operational summaries are loaded from backend records. Revenue will appear only after payment and supplier integrations are enabled."
              : "Backend configuration is unavailable in this environment. These values are interface preview data only."}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {finance.map((item, index) => {
              const Icon = item.icon;
              const accents = [
                "bg-[#c2e8ff] text-brand-navy",
                "bg-[#e3c39d] text-brand-navy",
                "bg-white/12 text-white",
              ];

              return (
                <div
                  key={item.label}
                  className="rounded-md border border-white/12 bg-white/10 p-3"
                >
                  <div
                    className={`mb-3 grid size-8 place-items-center rounded-md ${accents[index]}`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </div>
                  <p className="text-xl font-black">{item.value}</p>
                  <p className="text-xs font-bold uppercase text-white/62">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/15 bg-white/[0.08] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-brand-sand">
                Quick actions
              </p>
              <h3 className="text-lg font-black">Create and review</h3>
            </div>
            <Plus aria-hidden="true" className="size-5 text-brand-sand" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const tileColors = [
                "bg-[#c2e8ff] text-brand-navy",
                "bg-[#e3c39d] text-brand-navy",
                "bg-white/12 text-white",
                "bg-[#123f76] text-white",
                "bg-[#a68768] text-white",
                "bg-white/10 text-white",
              ];

              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="min-h-[82px] rounded-md border border-white/12 bg-white/10 p-3 transition hover:-translate-y-0.5 hover:bg-white/16"
                >
                  <span
                    className={`mb-3 grid size-8 place-items-center rounded-md ${tileColors[index]}`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-sm font-black">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: AdminMetric[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </section>
  );
}

export function MetricCard({ metric }: { metric: AdminMetric }) {
  const toneClass = {
    navy: "bg-brand-navy text-white",
    blue: "bg-brand-blue text-white",
    sky: "bg-[#e8f7ff] text-brand-navy",
    sand: "bg-[#fffaf2] text-brand-navy",
  }[metric.tone];

  return (
    <article className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            {metric.label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight">
            {metric.value}
          </p>
        </div>
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-black ${toneClass}`}
        >
          {metric.change}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-5 text-brand-brown">
        {metric.helper}
      </p>
    </article>
  );
}

function TravelPackages({ packages }: { packages: AdminPackageCard[] }) {
  return (
    <AdminPanel
      title="Travel packages"
      action="View all"
      href="/admin/trips"
      className="min-w-0"
    >
      {packages.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.title} pkg={pkg} />
          ))}
        </div>
      ) : (
        <EmptyPanel text="No published packages are available." />
      )}
    </AdminPanel>
  );
}

function PackageCard({ pkg }: { pkg: AdminPackageCard }) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#d7c5ad] bg-[#fffaf2] shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
      <div className="relative aspect-[1.45]">
        <Image
          src={pkg.image}
          alt={pkg.alt}
          fill
          sizes="(min-width: 1280px) 260px, (min-width: 768px) 30vw, 100vw"
          className="object-cover"
        />
        <div className="absolute left-3 top-3">
          <StatusBadge status={pkg.status} />
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-brown">
          {pkg.destination}
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-black leading-6">
          {pkg.title}
        </h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-black">{pkg.price}</p>
            <p className="text-xs font-bold text-brand-brown">{pkg.duration}</p>
          </div>
          <Link
            href="/admin/trips"
            className="grid size-10 place-items-center rounded-lg bg-brand-navy text-white transition hover:bg-brand-blue dark:bg-brand-sand dark:text-brand-navy"
            aria-label={`Open ${pkg.title}`}
          >
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function TripHealthCard({ health }: { health: AdminTripHealth }) {
  const total = Math.max(health.total, 1);
  const published = Math.round((health.published / total) * 100);
  const drafts = Math.round((health.draft / total) * 100);
  const archived =
    health.total === 0 ? 0 : Math.max(0, 100 - published - drafts);

  return (
    <AdminPanel title="Trip overview">
      <div className="grid place-items-center py-2">
        <div
          className="grid size-48 place-items-center rounded-full"
          style={{
            background:
              health.total === 0
                ? "#ead7bd"
                : `conic-gradient(#071739 0 ${published}%, #123f76 ${published}% ${published + drafts}%, #e3c39d ${published + drafts}% 100%)`,
          }}
        >
          <div className="grid size-32 place-items-center rounded-full bg-[#fffaf2] text-center dark:bg-black">
            <div>
              <p className="text-3xl font-black">{health.published}</p>
              <p className="text-xs font-bold text-brand-brown">Live trips</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          ["Published", health.published],
          ["Draft", health.draft],
          ["Archived", health.archived],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 text-center dark:border-white/10 dark:bg-white/[0.06]"
          >
            <p className="text-xl font-black">{value}</p>
            <p className="text-xs font-bold text-brand-brown">{label}</p>
          </div>
        ))}
      </div>
      <p className="sr-only">
        Status distribution: {published}% published, {drafts}% draft,{" "}
        {archived}% archived.
      </p>
    </AdminPanel>
  );
}

function ContentQueue({ items }: { items: AdminQueueItem[] }) {
  return (
    <AdminPanel title="Content readiness" action="Resolve">
      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.06]"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand">
              <Clock3 aria-hidden="true" className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{item.title}</p>
              <p className="text-xs font-bold text-brand-brown">
                {item.owner} - {item.due}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}

function BookingTable({ bookings }: { bookings: AdminBooking[] }) {
  return (
    <AdminPanel
      title="Recent bookings"
      action="Open inbox"
      href="/admin/bookings"
      toolbar={<SearchBox placeholder="Search booking, guest, status" />}
    >
      <div className="overflow-x-auto">
        {bookings.length > 0 ? <table className="w-full min-w-[780px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#d7c5ad] text-xs uppercase tracking-[0.14em] text-brand-brown dark:border-white/10">
              <th className="py-3 pr-4">Booking</th>
              <th className="py-3 pr-4">Guest</th>
              <th className="py-3 pr-4">Package</th>
              <th className="py-3 pr-4">Travel date</th>
              <th className="py-3 pr-4">Value</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </tbody>
        </table> : <EmptyPanel text="No recent enquiries are available." />}
      </div>
    </AdminPanel>
  );
}

function BookingRow({ booking }: { booking: AdminBooking }) {
  return (
    <tr className="border-b border-[#ead7bd] last:border-none dark:border-white/10">
      <td className="py-4 pr-4 font-black">{booking.id}</td>
      <td className="py-4 pr-4">
        <p className="font-black">{booking.guest}</p>
        <p className="text-xs font-bold text-brand-brown">
          {booking.travelers} travelers
        </p>
      </td>
      <td className="py-4 pr-4">
        <p className="font-bold">{booking.packageName}</p>
        <p className="text-xs font-bold text-brand-brown">{booking.destination}</p>
      </td>
      <td className="py-4 pr-4 font-bold">{booking.travelDate}</td>
      <td className="py-4 pr-4 font-black">{booking.value}</td>
      <td className="py-4">
        <StatusBadge status={booking.status} />
      </td>
    </tr>
  );
}

function CalendarCard({ days }: { days: AdminCalendarDay[] }) {
  return (
    <AdminPanel title="May 2026">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-brand-brown">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day.slice(0, 1)}</span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <span
            key={day.label}
            className={[
              "grid aspect-square place-items-center rounded-lg text-sm font-black",
              day.isToday
                ? "bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy"
                : day.isActive
                  ? "bg-[#c2e8ff] text-brand-navy dark:bg-white/10 dark:text-brand-sand"
                  : "text-brand-brown",
            ].join(" ")}
          >
            {day.label}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-lg bg-[#e8f7ff] p-3 dark:bg-white/10">
        <CalendarDays aria-hidden="true" className="size-5 text-brand-blue dark:text-brand-sand" />
        <div>
          <p className="text-sm font-black">7 departures this week</p>
          <p className="text-xs font-bold text-brand-brown">
            Turkey, Thailand and Switzerland routes
          </p>
        </div>
      </div>
    </AdminPanel>
  );
}

function TopDestinations({
  destinations,
}: {
  destinations: AdminDestinationStat[];
}) {
  return (
    <AdminPanel title="Top destinations" action="Manage" href="/admin/destinations">
      {destinations.length > 0 ? <div className="grid gap-4">
        {destinations.map((destination) => (
          <div key={destination.name}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">{destination.name}</p>
                <p className="text-xs font-bold text-brand-brown">
                  {destination.packages} packages - {destination.bookings} bookings
                </p>
              </div>
              <span className="text-sm font-black">{destination.completion}% relative</span>
            </div>
            <div className="h-2 rounded-full bg-[#e8f7ff] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand-blue"
                style={{ width: `${destination.completion}%` }}
              />
            </div>
          </div>
        ))}
      </div> : <EmptyPanel text="No destination activity is available." />}
    </AdminPanel>
  );
}

function ActivityFeed({ activities }: { activities: AdminActivity[] }) {
  return (
    <AdminPanel title="Recent activity">
      <div className="grid gap-4">
        {activities.length > 0 ? activities.map((activity) => (
          <div key={activity.title} className="flex gap-3">
            <div
              className={[
                "mt-1 size-3 rounded-full",
                activity.tone === "blue"
                  ? "bg-brand-blue"
                  : activity.tone === "sand"
                    ? "bg-brand-sand"
                    : "bg-brand-sky",
              ].join(" ")}
            />
            <div>
              <p className="text-sm font-black">{activity.title}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-brand-brown">
                {activity.description}
              </p>
              <p className="mt-1 text-xs font-black uppercase text-brand-brown">
                {activity.time}
              </p>
            </div>
          </div>
        )) : <EmptyPanel text="No protected admin activity recorded." />}
      </div>
    </AdminPanel>
  );
}

export function AdminPanel({
  title,
  children,
  action,
  href,
  toolbar,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  href?: string;
  toolbar?: React.ReactNode;
  className?: string;
}) {
  const actionContent = action ? (
    href ? (
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 text-xs font-black text-brand-navy transition hover:bg-[#e8f7ff] dark:bg-white/10 dark:text-white"
      >
        {action}
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Link>
    ) : (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 text-xs font-black text-brand-navy dark:bg-white/10 dark:text-white"
      >
        {action}
      </button>
    )
  ) : (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-lg border border-border-soft bg-[#fffaf2] text-brand-brown dark:bg-white/10"
      aria-label={`${title} options`}
    >
      <MoreHorizontal aria-hidden="true" className="size-4" />
    </button>
  );

  return (
    <section
      className={`rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          {toolbar}
          {actionContent}
        </div>
      </div>
      {children}
    </section>
  );
}

export { StatusBadge } from "@/features/admin/components/StatusBadge";

export function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <div className="hidden min-w-[260px] items-center gap-2 rounded-lg border border-border-soft bg-[#fffaf2] px-3 py-2 text-sm text-brand-brown dark:bg-white/10 md:flex">
      <Search aria-hidden="true" className="size-4" />
      <span>{placeholder}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[#d7c5ad] bg-[#fffaf2] p-4 text-sm font-semibold text-brand-brown dark:border-white/10 dark:bg-white/[0.04]">
      {text}
    </p>
  );
}
