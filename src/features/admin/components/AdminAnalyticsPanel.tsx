"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowUpRight, PieChart, TrendingUp } from "lucide-react";

type Period = "week" | "month" | "year";

type AnalyticsPoint = {
  label: string;
  bookings: number;
  revenue: number;
};

const analyticsData: Record<Period, AnalyticsPoint[]> = {
  week: [
    { label: "Mon", bookings: 18, revenue: 24 },
    { label: "Tue", bookings: 24, revenue: 34 },
    { label: "Wed", bookings: 21, revenue: 31 },
    { label: "Thu", bookings: 32, revenue: 45 },
    { label: "Fri", bookings: 29, revenue: 41 },
    { label: "Sat", bookings: 38, revenue: 56 },
    { label: "Sun", bookings: 34, revenue: 48 },
  ],
  month: [
    { label: "W1", bookings: 84, revenue: 112 },
    { label: "W2", bookings: 108, revenue: 148 },
    { label: "W3", bookings: 96, revenue: 132 },
    { label: "W4", bookings: 126, revenue: 176 },
  ],
  year: [
    { label: "Jan", bookings: 340, revenue: 580 },
    { label: "Feb", bookings: 420, revenue: 640 },
    { label: "Mar", bookings: 580, revenue: 820 },
    { label: "Apr", bookings: 460, revenue: 740 },
    { label: "May", bookings: 720, revenue: 960 },
    { label: "Jun", bookings: 640, revenue: 880 },
    { label: "Jul", bookings: 860, revenue: 1100 },
    { label: "Aug", bookings: 540, revenue: 760 },
  ],
};

const pieSegments = [
  { label: "Confirmed", value: 62, color: "#071739" },
  { label: "Contacted", value: 24, color: "#123f76" },
  { label: "New", value: 10, color: "#c2e8ff" },
  { label: "Cancelled", value: 4, color: "#e3c39d" },
  { label: "Completed", value: 18, color: "#a68768" },
];

const RevenueBarChart = dynamic(
  () => import("@/features/admin/components/AdminRecharts").then((mod) => mod.RevenueBarChart),
  {
    ssr: false,
    loading: () => <ChartPlaceholder />,
  },
);

const RevenueAreaChart = dynamic(
  () => import("@/features/admin/components/AdminRecharts").then((mod) => mod.RevenueAreaChart),
  {
    ssr: false,
    loading: () => <ChartPlaceholder />,
  },
);

const StatusPieChart = dynamic(
  () => import("@/features/admin/components/AdminRecharts").then((mod) => mod.StatusPieChart),
  {
    ssr: false,
    loading: () => <ChartPlaceholder variant="circle" />,
  },
);

export function AdminAnalyticsPanel() {
  const [period, setPeriod] = useState<Period>("month");
  const data = analyticsData[period];
  const totals = useMemo(
    () =>
      data.reduce(
        (acc, point) => ({
          bookings: acc.bookings + point.bookings,
          revenue: acc.revenue + point.revenue,
        }),
        { bookings: 0, revenue: 0 },
      ),
    [data],
  );

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
              Analytics
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Booking and revenue graph
            </h2>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <AnalyticsMiniCard label="Revenue index" value={totals.revenue} suffix="k" />
          <AnalyticsMiniCard label="Bookings" value={totals.bookings} />
          <AnalyticsMiniCard
            label="Avg value"
            value={Math.round((totals.revenue * 1000) / Math.max(totals.bookings, 1))}
            prefix="SAR "
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-black/20">
            <div className="h-[310px] min-w-0">
              <RevenueBarChart data={data} />
            </div>
          </div>

          <div className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-black/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-brand-brown">
                Revenue trend
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-black text-brand-blue dark:text-brand-sand">
                <TrendingUp aria-hidden="true" className="size-3.5" />
                +12.8%
              </span>
            </div>
            <div className="h-[260px] min-w-0">
              <RevenueAreaChart data={data} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
              Pipeline
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Booking status pie
            </h2>
          </div>
          <PieChart aria-hidden="true" className="size-5 text-brand-blue dark:text-brand-sand" />
        </div>

        <div className="relative h-[250px] min-w-0">
          <StatusPieChart data={pieSegments} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-4xl font-black">86%</p>
              <p className="text-xs font-black uppercase text-brand-brown">
                Active pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {pieSegments.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm font-black">{segment.label}</span>
              </div>
              <span className="text-sm font-black">{segment.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChartPlaceholder({ variant = "bars" }: { variant?: "bars" | "circle" }) {
  if (variant === "circle") {
    return (
      <div className="grid h-full place-items-center">
        <div className="size-48 rounded-full border-[28px] border-[#c2e8ff] border-r-brand-blue border-t-brand-sand" />
      </div>
    );
  }

  return (
    <div className="flex h-full items-end gap-3 px-2 pb-5">
      {[42, 64, 52, 78, 70, 88, 60].map((height, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-lg bg-[#c2e8ff]"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const options: Period[] = ["week", "month", "year"];

  return (
    <div className="inline-flex rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-1 dark:border-white/10 dark:bg-black/20">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={[
            "min-h-9 rounded-lg px-3 text-xs font-black capitalize transition",
            value === option
              ? "bg-brand-navy text-white shadow-sm dark:bg-brand-sand dark:text-brand-navy"
              : "text-brand-brown hover:bg-[#e8f7ff] dark:hover:bg-white/10",
          ].join(" ")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function AnalyticsMiniCard({
  label,
  value,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-[#fffaf2] p-3 dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase text-brand-brown">{label}</p>
        <ArrowUpRight aria-hidden="true" className="size-4 text-brand-blue dark:text-brand-sand" />
      </div>
      <p className="mt-2 text-2xl font-black">
        {prefix}
        {value.toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}
