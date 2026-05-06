import type { LucideIcon } from "lucide-react";

export type AdminStatus =
  | "draft"
  | "published"
  | "archived"
  | "new"
  | "contacted"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "scheduled"
  | "missing";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type AdminMetric = {
  label: string;
  value: string;
  change: string;
  helper: string;
  tone: "navy" | "blue" | "sky" | "sand";
};

export type AdminPackageCard = {
  title: string;
  destination: string;
  price: string;
  duration: string;
  status: AdminStatus;
  image: string;
  alt: string;
};

export type AdminBooking = {
  id: string;
  guest: string;
  packageName: string;
  destination: string;
  travelDate: string;
  travelers: number;
  value: string;
  status: AdminStatus;
};

export type AdminDestinationStat = {
  name: string;
  country: string;
  packages: number;
  bookings: number;
  completion: number;
};

export type AdminActivity = {
  title: string;
  description: string;
  time: string;
  tone: "blue" | "sand" | "sky";
};

export type AdminChartPoint = {
  label: string;
  bookings: number;
  revenue: number;
};

export type AdminQueueItem = {
  title: string;
  owner: string;
  status: AdminStatus;
  due: string;
};

export type AdminCalendarDay = {
  label: string;
  isActive?: boolean;
  isToday?: boolean;
};

export type AdminTableColumn<T> = {
  key: keyof T;
  label: string;
};

export type AdminResourceRow = Record<string, string | number>;

export type AdminResourceConfig = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction?: string;
  stats: AdminMetric[];
  columns: AdminTableColumn<AdminResourceRow>[];
  rows: AdminResourceRow[];
  queueTitle: string;
  queue: AdminQueueItem[];
};
