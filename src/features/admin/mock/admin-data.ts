import {
  BadgeIndianRupee,
  Bell,
  BookOpenText,
  CalendarDays,
  CircleDollarSign,
  Compass,
  FileText,
  GalleryHorizontalEnd,
  Globe2,
  Home,
  Inbox,
  Languages,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Navigation,
  Plane,
  Settings,
  ShieldCheck,
  Tags,
  UserRoundCog,
} from "lucide-react";

import type {
  AdminActivity,
  AdminBooking,
  AdminCalendarDay,
  AdminChartPoint,
  AdminDestinationStat,
  AdminMetric,
  AdminNavItem,
  AdminPackageCard,
  AdminResourceConfig,
} from "@/features/admin/types";

export const adminNavItems: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Bookings", href: "/admin/bookings", icon: Inbox, badge: "18" },
  { label: "Destinations", href: "/admin/destinations", icon: MapPin },
  { label: "Trips", href: "/admin/trips", icon: Plane, badge: "32" },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Media", href: "/admin/media", icon: GalleryHorizontalEnd },
  { label: "Home CMS", href: "/admin/home", icon: Home },
  { label: "Pages", href: "/admin/pages", icon: FileText },
  { label: "Navigation", href: "/admin/navigation", icon: Navigation },
  { label: "Translations", href: "/admin/translations", icon: Languages },
  { label: "Newsletter", href: "/admin/newsletter", icon: BookOpenText },
  { label: "Users", href: "/admin/users", icon: UserRoundCog },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Audit Log", href: "/admin/audit-log", icon: ShieldCheck },
];

export const adminMetrics: AdminMetric[] = [
  {
    label: "Revenue tracked",
    value: "SAR 312k",
    change: "+12.8%",
    helper: "Confirmed packages and paid add-ons",
    tone: "navy",
  },
  {
    label: "New bookings",
    value: "186",
    change: "+8.4%",
    helper: "Across web forms and desk entries",
    tone: "blue",
  },
  {
    label: "Pending enquiries",
    value: "42",
    change: "-6.1%",
    helper: "Needs follow-up from travel desk",
    tone: "sand",
  },
  {
    label: "Live packages",
    value: "74",
    change: "+5 drafts",
    helper: "Published inventory for public pages",
    tone: "sky",
  },
];

export const adminPackageCards: AdminPackageCard[] = [
  {
    title: "A Grand Eid in the City of Sultans",
    destination: "Turkey",
    price: "SAR 8,738",
    duration: "4 days",
    status: "published",
    image:
      "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=900&q=82",
    alt: "Istanbul mosque courtyard in warm daylight",
  },
  {
    title: "Phuket Island Holiday",
    destination: "Thailand",
    price: "SAR 6,480",
    duration: "5 days",
    status: "published",
    image:
      "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?auto=format&fit=crop&w=900&q=82",
    alt: "Phuket tropical island coastline",
  },
  {
    title: "Interlaken Alpine Break",
    destination: "Switzerland",
    price: "SAR 9,340",
    duration: "5 days",
    status: "draft",
    image:
      "https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&w=900&q=82",
    alt: "Interlaken alpine lake and mountain landscape",
  },
];

export const adminBookings: AdminBooking[] = [
  {
    id: "FT-10492",
    guest: "Ameen Rahman",
    packageName: "Turkey Eid Route",
    destination: "Istanbul",
    travelDate: "27 May 2026",
    travelers: 2,
    value: "SAR 8,738",
    status: "new",
  },
  {
    id: "FT-10491",
    guest: "Noura Al Hasan",
    packageName: "Phuket Island Holiday",
    destination: "Phuket",
    travelDate: "04 Jun 2026",
    travelers: 4,
    value: "SAR 12,960",
    status: "contacted",
  },
  {
    id: "FT-10488",
    guest: "Farhan Iqbal",
    packageName: "Paris & Switzerland",
    destination: "Zurich",
    travelDate: "01 Jun 2026",
    travelers: 2,
    value: "SAR 11,890",
    status: "confirmed",
  },
  {
    id: "FT-10482",
    guest: "Sara K",
    packageName: "Pattaya Family Break",
    destination: "Pattaya",
    travelDate: "18 Jun 2026",
    travelers: 3,
    value: "SAR 5,535",
    status: "completed",
  },
];

export const destinationStats: AdminDestinationStat[] = [
  {
    name: "Turkey",
    country: "Turkey",
    packages: 14,
    bookings: 82,
    completion: 78,
  },
  {
    name: "Thailand",
    country: "Thailand",
    packages: 17,
    bookings: 64,
    completion: 62,
  },
  {
    name: "Switzerland",
    country: "Switzerland",
    packages: 7,
    bookings: 38,
    completion: 44,
  },
  {
    name: "Bosnia",
    country: "Bosnia and Herzegovina",
    packages: 6,
    bookings: 22,
    completion: 31,
  },
];

export const activityFeed: AdminActivity[] = [
  {
    title: "Package draft updated",
    description: "Turkey Eid Route received new inclusions and gallery images.",
    time: "10 min ago",
    tone: "blue",
  },
  {
    title: "Booking moved to contacted",
    description: "Noura Al Hasan was assigned to the travel desk queue.",
    time: "28 min ago",
    tone: "sand",
  },
  {
    title: "Homepage card scheduled",
    description: "Blue Water Cruises will publish after final image review.",
    time: "1 hr ago",
    tone: "sky",
  },
];

export const chartPoints: AdminChartPoint[] = [
  { label: "Jan", bookings: 34, revenue: 58 },
  { label: "Feb", bookings: 42, revenue: 64 },
  { label: "Mar", bookings: 58, revenue: 82 },
  { label: "Apr", bookings: 46, revenue: 74 },
  { label: "May", bookings: 72, revenue: 96 },
  { label: "Jun", bookings: 64, revenue: 88 },
  { label: "Jul", bookings: 86, revenue: 110 },
  { label: "Aug", bookings: 54, revenue: 76 },
];

export const calendarDays: AdminCalendarDay[] = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;

  return {
    label: String(day),
    isActive: [4, 9, 12, 18, 24, 27].includes(day),
    isToday: day === 6,
  };
});

export const contentQueue = [
  {
    title: "Missing Arabic copy",
    owner: "Translations",
    status: "missing",
    due: "6 sections",
  },
  {
    title: "Footer legal pages",
    owner: "CMS",
    status: "draft",
    due: "2 pages",
  },
  {
    title: "Trip map coordinates",
    owner: "Packages",
    status: "scheduled",
    due: "9 trips",
  },
  {
    title: "Homepage bento order",
    owner: "Marketing",
    status: "published",
    due: "Ready",
  },
] satisfies AdminResourceConfig["queue"];

const compactStats: AdminMetric[] = [
  {
    label: "Total records",
    value: "128",
    change: "+9",
    helper: "Demo rows shaped for Supabase",
    tone: "blue",
  },
  {
    label: "Needs review",
    value: "17",
    change: "-3",
    helper: "Drafts, missing assets, stale copy",
    tone: "sand",
  },
  {
    label: "Published",
    value: "86",
    change: "+11%",
    helper: "Visible on public pages",
    tone: "navy",
  },
];

export const resourceConfigs: Record<string, AdminResourceConfig> = {
  bookings: {
    eyebrow: "Travel desk",
    title: "Booking Inbox",
    description:
      "Review new customer requests, update status, and keep private notes away from public pages.",
    primaryAction: "Add booking",
    secondaryAction: "Export view",
    stats: [
      {
        label: "New today",
        value: "18",
        change: "+4",
        helper: "Waiting for first response",
        tone: "blue",
      },
      {
        label: "Confirmed",
        value: "64",
        change: "+8%",
        helper: "Booked packages this month",
        tone: "navy",
      },
      {
        label: "Cancelled",
        value: "6",
        change: "-2",
        helper: "Follow up for reason codes",
        tone: "sand",
      },
    ],
    columns: [
      { key: "id", label: "Booking ID" },
      { key: "guest", label: "Guest" },
      { key: "destination", label: "Destination" },
      { key: "travelDate", label: "Travel date" },
      { key: "value", label: "Value" },
      { key: "status", label: "Status" },
    ],
    rows: adminBookings.map((booking) => ({
      id: booking.id,
      guest: booking.guest,
      destination: booking.destination,
      travelDate: booking.travelDate,
      value: booking.value,
      status: booking.status,
    })),
    queueTitle: "Follow-up queue",
    queue: [
      {
        title: "Call Ameen Rahman",
        owner: "Travel desk",
        status: "new",
        due: "Today",
      },
      {
        title: "Send Phuket quote",
        owner: "Sales",
        status: "contacted",
        due: "2 hrs",
      },
      {
        title: "Payment confirmation",
        owner: "Finance",
        status: "confirmed",
        due: "Tomorrow",
      },
    ],
  },
  destinations: {
    eyebrow: "Inventory",
    title: "Destinations",
    description:
      "Manage country and city landing data used by package cards, filters, and search.",
    primaryAction: "Add destination",
    stats: compactStats,
    columns: [
      { key: "name", label: "Destination" },
      { key: "country", label: "Country" },
      { key: "packages", label: "Packages" },
      { key: "bookings", label: "Bookings" },
      { key: "status", label: "Status" },
    ],
    rows: destinationStats.map((destination) => ({
      name: destination.name,
      country: destination.country,
      packages: destination.packages,
      bookings: destination.bookings,
      status: "published",
    })),
    queueTitle: "Destination work",
    queue: contentQueue,
  },
  trips: {
    eyebrow: "Packages",
    title: "Trips",
    description:
      "Create package records with pricing, days, flights, hotels, gallery, map, terms, and inclusions.",
    primaryAction: "Create trip",
    secondaryAction: "Bulk edit",
    stats: compactStats,
    columns: [
      { key: "title", label: "Trip" },
      { key: "destination", label: "Destination" },
      { key: "duration", label: "Duration" },
      { key: "price", label: "Price" },
      { key: "status", label: "Status" },
    ],
    rows: adminPackageCards.map((pkg) => ({
      title: pkg.title,
      destination: pkg.destination,
      duration: pkg.duration,
      price: pkg.price,
      status: pkg.status,
    })),
    queueTitle: "Trip readiness",
    queue: [
      {
        title: "Add Qutub Minar gallery",
        owner: "Media",
        status: "missing",
        due: "Images",
      },
      {
        title: "Review Turkey terms",
        owner: "Operations",
        status: "draft",
        due: "Today",
      },
      {
        title: "Publish Thailand summer route",
        owner: "Admin",
        status: "scheduled",
        due: "Fri",
      },
    ],
  },
  categories: {
    eyebrow: "Taxonomy",
    title: "Categories & Tags",
    description:
      "Control package categories, campaign tags, filter labels, and public counts.",
    primaryAction: "Add category",
    stats: compactStats,
    columns: [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "items", label: "Linked trips" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { name: "Culture", type: "Category", items: 28, status: "published" },
      { name: "Eid Al Adha 2026", type: "Tag", items: 12, status: "published" },
      { name: "Beach", type: "Category", items: 9, status: "draft" },
    ],
    queueTitle: "Cleanup",
    queue: contentQueue,
  },
  media: {
    eyebrow: "Assets",
    title: "Media Library",
    description:
      "Prepare Cloudinary or ImageKit assets with alt text, folders, and reusable IDs.",
    primaryAction: "Upload asset",
    secondaryAction: "Sync provider",
    stats: compactStats,
    columns: [
      { key: "name", label: "Asset" },
      { key: "folder", label: "Folder" },
      { key: "provider", label: "Provider" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { name: "turkey-hero.webp", folder: "trips/turkey", provider: "Cloudinary", status: "published" },
      { name: "phuket-card.webp", folder: "trips/thailand", provider: "ImageKit", status: "published" },
      { name: "hero-road.webp", folder: "home", provider: "Cloudinary", status: "draft" },
    ],
    queueTitle: "Asset checks",
    queue: contentQueue,
  },
  home: {
    eyebrow: "CMS",
    title: "Home Page",
    description:
      "Edit hero, quick access tiles, Fly Time Picks, route board, services, and reviews.",
    primaryAction: "Update homepage",
    stats: compactStats,
    columns: [
      { key: "section", label: "Section" },
      { key: "owner", label: "Owner" },
      { key: "items", label: "Items" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { section: "Hero", owner: "Marketing", items: 6, status: "published" },
      { section: "Fly Time Picks", owner: "Sales", items: 8, status: "published" },
      { section: "Traveler reviews", owner: "Support", items: 12, status: "draft" },
    ],
    queueTitle: "Homepage readiness",
    queue: contentQueue,
  },
  pages: {
    eyebrow: "Legal & content",
    title: "Pages",
    description:
      "Manage footer pages and service pages without touching frontend code.",
    primaryAction: "Create page",
    stats: compactStats,
    columns: [
      { key: "title", label: "Page" },
      { key: "slug", label: "Slug" },
      { key: "locale", label: "Locale" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { title: "Terms and Conditions", slug: "/terms", locale: "EN", status: "draft" },
      { title: "Privacy Policy", slug: "/privacy", locale: "EN", status: "draft" },
      { title: "Hajj & Umrah", slug: "/hajj-umrah", locale: "EN", status: "published" },
    ],
    queueTitle: "Page tasks",
    queue: contentQueue,
  },
  navigation: {
    eyebrow: "Site chrome",
    title: "Navigation",
    description:
      "Control header menus, footer columns, link labels, and publish status.",
    primaryAction: "Add nav item",
    stats: compactStats,
    columns: [
      { key: "label", label: "Label" },
      { key: "location", label: "Location" },
      { key: "href", label: "Href" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { label: "Flights", location: "Header", href: "#flight", status: "published" },
      { label: "Privacy Policy", location: "Footer", href: "/privacy", status: "draft" },
      { label: "Visa Desk", location: "Header", href: "#visas", status: "published" },
    ],
    queueTitle: "Navigation work",
    queue: contentQueue,
  },
  translations: {
    eyebrow: "Locale",
    title: "Translations",
    description:
      "Prepare EN and AR text namespaces for the public site and admin views.",
    primaryAction: "Add phrase",
    secondaryAction: "Import CSV",
    stats: compactStats,
    columns: [
      { key: "namespace", label: "Namespace" },
      { key: "key", label: "Key" },
      { key: "locale", label: "Locale" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { namespace: "home", key: "hero.title", locale: "AR", status: "missing" },
      { namespace: "trips", key: "filters.duration", locale: "AR", status: "draft" },
      { namespace: "common", key: "bookNow", locale: "EN", status: "published" },
    ],
    queueTitle: "Translation gaps",
    queue: contentQueue,
  },
  newsletter: {
    eyebrow: "Audience",
    title: "Newsletter",
    description:
      "Review subscribers and campaign sources without exposing emails publicly.",
    primaryAction: "Import subscribers",
    stats: compactStats,
    columns: [
      { key: "email", label: "Email" },
      { key: "locale", label: "Locale" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { email: "m****@example.com", locale: "EN", source: "Footer", status: "published" },
      { email: "n****@example.com", locale: "AR", source: "Hero", status: "published" },
      { email: "r****@example.com", locale: "EN", source: "Trip detail", status: "archived" },
    ],
    queueTitle: "Audience tasks",
    queue: contentQueue,
  },
  users: {
    eyebrow: "Access",
    title: "Admin Users",
    description:
      "Manage admin/editor roles. Real auth will use Supabase Auth plus profiles role checks.",
    primaryAction: "Invite user",
    stats: compactStats,
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "lastActive", label: "Last active" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { name: "Admin User", role: "Admin", lastActive: "Today", status: "published" },
      { name: "Content Editor", role: "Editor", lastActive: "Yesterday", status: "published" },
      { name: "Travel Desk", role: "Editor", lastActive: "3 days ago", status: "draft" },
    ],
    queueTitle: "Access checks",
    queue: contentQueue,
  },
  settings: {
    eyebrow: "Configuration",
    title: "Settings",
    description:
      "Show safe configuration health only. Secret values never render in admin UI.",
    primaryAction: "Save settings",
    stats: compactStats,
    columns: [
      { key: "service", label: "Service" },
      { key: "visibility", label: "Visibility" },
      { key: "health", label: "Health" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { service: "Supabase", visibility: "Server + public anon", health: "Configured", status: "published" },
      { service: "Resend", visibility: "Server only", health: "Missing", status: "missing" },
      { service: "Cloudinary", visibility: "Server only", health: "Pending", status: "draft" },
    ],
    queueTitle: "Configuration checks",
    queue: contentQueue,
  },
  "audit-log": {
    eyebrow: "Security",
    title: "Audit Log",
    description:
      "Track admin changes and sensitive operations for accountability.",
    primaryAction: "Download log",
    stats: compactStats,
    columns: [
      { key: "action", label: "Action" },
      { key: "actor", label: "Actor" },
      { key: "entity", label: "Entity" },
      { key: "time", label: "Time" },
    ],
    rows: [
      { action: "Updated", actor: "Admin User", entity: "Turkey package", time: "10 min ago" },
      { action: "Published", actor: "Content Editor", entity: "Hero section", time: "1 hr ago" },
      { action: "Viewed", actor: "Admin User", entity: "Bookings inbox", time: "2 hrs ago" },
    ],
    queueTitle: "Audit checks",
    queue: contentQueue,
  },
};

export const dashboardQuickActions = [
  { label: "Create Trip", href: "/admin/trips", icon: Plane },
  { label: "Add Destination", href: "/admin/destinations", icon: Globe2 },
  { label: "Review Bookings", href: "/admin/bookings", icon: ListChecks },
  { label: "Update Pricing", href: "/admin/trips", icon: BadgeIndianRupee },
  { label: "Publish Page", href: "/admin/pages", icon: FileText },
  { label: "Check Alerts", href: "/admin/audit-log", icon: Bell },
];

export const dashboardFinance = [
  { label: "Collected", value: "SAR 218k", icon: CircleDollarSign },
  { label: "Quoted", value: "SAR 94k", icon: Compass },
  { label: "Travel dates", value: "27 live", icon: CalendarDays },
];
