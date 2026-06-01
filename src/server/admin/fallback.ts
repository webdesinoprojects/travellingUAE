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
    { label: "Mon", enquiries: 18, converted: 6 },
    { label: "Tue", enquiries: 24, converted: 8 },
    { label: "Wed", enquiries: 21, converted: 7 },
    { label: "Thu", enquiries: 32, converted: 12 },
    { label: "Fri", enquiries: 29, converted: 10 },
    { label: "Sat", enquiries: 38, converted: 16 },
    { label: "Sun", enquiries: 34, converted: 14 },
  ],
  month: [
    { label: "W1", enquiries: 84, converted: 31 },
    { label: "W2", enquiries: 108, converted: 39 },
    { label: "W3", enquiries: 96, converted: 37 },
    { label: "W4", enquiries: 126, converted: 48 },
  ],
  year: [
    { label: "Jan", enquiries: 340, converted: 132 },
    { label: "Feb", enquiries: 420, converted: 164 },
    { label: "Mar", enquiries: 580, converted: 228 },
    { label: "Apr", enquiries: 460, converted: 182 },
    { label: "May", enquiries: 720, converted: 301 },
    { label: "Jun", enquiries: 640, converted: 267 },
    { label: "Jul", enquiries: 860, converted: 352 },
    { label: "Aug", enquiries: 540, converted: 211 },
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
    dataSource: "fallback",
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
    tripHealth: {
      total: 100,
      published: 67,
      draft: 26,
      archived: 7,
    },
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
