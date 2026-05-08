import "server-only";

import {
  activityFeed,
  adminBookings,
  adminMetrics,
  adminPackageCards,
  calendarDays,
  contentQueue,
  dashboardFinance,
  dashboardQuickActions,
  destinationStats,
  resourceConfigs,
} from "@/features/admin/mock/admin-data";
import type {
  AdminChartPoint,
  AdminDashboardDTO,
  AdminPieSegment,
  AdminResourceConfig,
} from "@/features/admin/types";

export const adminResourceKeys = Object.keys(resourceConfigs) as Array<
  keyof typeof resourceConfigs
>;

const analytics: AdminDashboardDTO["analytics"] = {
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

const pieSegments: AdminPieSegment[] = [
  { label: "Confirmed", value: 52, color: "#071739" },
  { label: "Contacted", value: 20, color: "#123f76" },
  { label: "New", value: 14, color: "#c2e8ff" },
  { label: "Completed", value: 10, color: "#a68768" },
  { label: "Cancelled", value: 4, color: "#e3c39d" },
];

export function getFallbackAdminDashboardDTO(): AdminDashboardDTO {
  return {
    metrics: adminMetrics,
    packageCards: adminPackageCards,
    bookings: adminBookings,
    destinationStats,
    activityFeed,
    calendarDays,
    contentQueue,
    quickActions: dashboardQuickActions,
    finance: dashboardFinance,
    analytics,
    pieSegments,
    activePipelinePercent: 86,
  };
}

export function getFallbackAdminResourceConfig(
  resource: keyof typeof resourceConfigs,
): AdminResourceConfig {
  return resourceConfigs[resource];
}

export function getFallbackAnalytics(): Record<string, AdminChartPoint[]> {
  return analytics;
}

