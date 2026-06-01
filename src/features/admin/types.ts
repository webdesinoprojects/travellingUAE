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
  enquiries: number;
  converted: number;
};

export type AdminAnalyticsPeriod = "week" | "month" | "year";

export type AdminPieSegment = {
  label: string;
  value: number;
  color: string;
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
  pageInfo?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type AdminQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type AdminFinanceItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export type AdminTripHealth = {
  total: number;
  published: number;
  draft: number;
  archived: number;
};

export type AdminDashboardDTO = {
  dataSource: "database" | "fallback";
  metrics: AdminMetric[];
  packageCards: AdminPackageCard[];
  bookings: AdminBooking[];
  destinationStats: AdminDestinationStat[];
  activityFeed: AdminActivity[];
  calendarDays: AdminCalendarDay[];
  contentQueue: AdminQueueItem[];
  quickActions: AdminQuickAction[];
  finance: AdminFinanceItem[];
  analytics: Record<AdminAnalyticsPeriod, AdminChartPoint[]>;
  pieSegments: AdminPieSegment[];
  activePipelinePercent: number;
  tripHealth: AdminTripHealth;
};
