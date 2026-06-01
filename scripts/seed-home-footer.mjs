import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readEnvFile(".env");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase URL and service role key are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mediaAssets = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    provider: "external",
    url: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Aircraft flying above clouds",
    folder: "demo/flights",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    provider: "external",
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Hotel exterior with warm lights",
    folder: "demo/hotels",
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    provider: "external",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Mountain route and lake view",
    folder: "demo/destinations",
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    provider: "external",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Historic stone landmark",
    folder: "demo/activities",
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    provider: "external",
    url: "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Private black sedan transfer vehicle",
    folder: "demo/transfers",
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    provider: "external",
    url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Wellness spa treatment with oil",
    folder: "home/fly-time-picks",
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    provider: "external",
    url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Kerala backwater boat route",
    folder: "home/fly-time-picks",
  },
  {
    id: "00000000-0000-4000-8000-000000000108",
    provider: "external",
    url: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Snowy mountain ridge with clouds",
    folder: "home/fly-time-picks",
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    provider: "external",
    url: "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Blue water cruise terminal",
    folder: "home/fly-time-picks",
  },
  {
    id: "00000000-0000-4000-8000-000000000110",
    provider: "external",
    url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Himalayan mountain route in Nepal",
    folder: "home/route-board",
  },
  {
    id: "00000000-0000-4000-8000-000000000111",
    provider: "external",
    url: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Vietnam coastline with boats",
    folder: "home/route-board",
  },
  {
    id: "00000000-0000-4000-8000-000000000112",
    provider: "external",
    url: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Malaysia city garden skyline",
    folder: "home/route-board",
  },
  {
    id: "00000000-0000-4000-8000-000000000113",
    provider: "external",
    url: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Turkey city tower at sunset",
    folder: "home/route-board",
  },
  {
    id: "00000000-0000-4000-8000-000000000114",
    provider: "external",
    url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Resort hotel pool and villas",
    folder: "home/services",
  },
  {
    id: "00000000-0000-4000-8000-000000000115",
    provider: "external",
    url: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82",
    alt_text: "Travel document signing desk",
    folder: "home/services",
  },
];

const siteSections = [
  {
    id: "00000000-0000-4000-8000-000000001008",
    key: "home.hero",
    title: "Home Hero",
    eyebrow: "Homepage",
    description: "Public homepage background media.",
    payload: {
      backgroundImage:
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2200&q=86",
      backgroundAlt: "Road trip through a warm desert mountain route",
    },
    status: "published",
  },
  {
    id: "00000000-0000-4000-8000-000000001009",
    key: "home.footer",
    title: "Footer Settings",
    eyebrow: "Homepage",
    description: "Footer contact info and social platform links.",
    payload: {
      contact: {
        tagline:
          "Fly Time connects flights, stays, visas and destination support into a booking flow that feels calm from enquiry to departure.",
        address: "Head Office, BKM Hospital Bldg. Bypass Road, Payyanur, Kannur",
        phone: "+91 904 831 77 11",
        email: "hello@flytime.example",
      },
      socialLinks: [
        { platform: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
        { platform: "youtube", label: "YouTube", href: "https://www.youtube.com/" },
        { platform: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
        { platform: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/" },
      ],
    },
    status: "published",
  },
];

const footerColumns = [
  { id: "00000000-0000-4000-8000-000000001201", title: "Company", status: "published", sort_order: 10 },
  { id: "00000000-0000-4000-8000-000000001202", title: "Travel Desk", status: "published", sort_order: 20 },
  { id: "00000000-0000-4000-8000-000000001203", title: "Legal", status: "published", sort_order: 30 },
];

const footerLinks = [
  ["00000000-0000-4000-8000-000000001211", "00000000-0000-4000-8000-000000001201", "About Fly Time", "/about", 10],
  ["00000000-0000-4000-8000-000000001212", "00000000-0000-4000-8000-000000001201", "Work with us", "/contact", 20],
  ["00000000-0000-4000-8000-000000001213", "00000000-0000-4000-8000-000000001201", "Contact desk", "/contact", 30],
  ["00000000-0000-4000-8000-000000001221", "00000000-0000-4000-8000-000000001202", "India Tour Package", "/trips", 10],
  ["00000000-0000-4000-8000-000000001222", "00000000-0000-4000-8000-000000001202", "International Tour Package", "/trips", 20],
  ["00000000-0000-4000-8000-000000001223", "00000000-0000-4000-8000-000000001202", "Flight", "/?service=flight#travel-search", 30],
  ["00000000-0000-4000-8000-000000001224", "00000000-0000-4000-8000-000000001202", "Global Visa", "/global-visa", 40],
  ["00000000-0000-4000-8000-000000001225", "00000000-0000-4000-8000-000000001202", "Gulf Visa", "/gulf-visa", 50],
  ["00000000-0000-4000-8000-000000001226", "00000000-0000-4000-8000-000000001202", "Hajj & Umrah", "/hajj-umrah", 60],
  ["00000000-0000-4000-8000-000000001227", "00000000-0000-4000-8000-000000001202", "Passport Services", "/passport-services", 70],
  ["00000000-0000-4000-8000-000000001228", "00000000-0000-4000-8000-000000001202", "Document Attestation", "/document-attestation", 80],
  ["00000000-0000-4000-8000-000000001229", "00000000-0000-4000-8000-000000001202", "Travel Insurance", "/?service=insurance#travel-search", 90],
  ["00000000-0000-4000-8000-000000001230", "00000000-0000-4000-8000-000000001202", "Cruise", "/?service=cruise#travel-search", 100],
  ["00000000-0000-4000-8000-000000001234", "00000000-0000-4000-8000-000000001202", "Hotel Booking", "/?service=hotel#travel-search", 110],
  ["00000000-0000-4000-8000-000000001235", "00000000-0000-4000-8000-000000001202", "Bus & Train Tickets", "/?service=transfers#travel-search", 120],
  ["00000000-0000-4000-8000-000000001231", "00000000-0000-4000-8000-000000001203", "Privacy Policy", "/privacy", 10],
  ["00000000-0000-4000-8000-000000001232", "00000000-0000-4000-8000-000000001203", "Terms & Conditions", "/terms", 20],
  ["00000000-0000-4000-8000-000000001233", "00000000-0000-4000-8000-000000001203", "Refund Policy", "/refund-policy", 30],
].map(([id, column_id, label, href, sort_order]) => ({
  id,
  column_id,
  label,
  href,
  status: "published",
  sort_order,
}));

const collections = [
  {
    id: "00000000-0000-4000-8000-000000001301",
    slug: "fly-time-picks",
    title: "Fly Time Picks",
    eyebrow: "Handpicked Deals",
    description:
      "Seasonal offers with clear pricing, simple actions, and fast paths into package details.",
    type: "flytime_picks",
    status: "published",
    sort_order: 10,
  },
  {
    id: "00000000-0000-4000-8000-000000001302",
    slug: "routes-people-ask-for",
    title: "Routes People Ask For",
    eyebrow: "Holiday Lanes",
    description:
      "A visual board of short breaks, city stays, alpine escapes and Eid routes that can open directly into available packages.",
    type: "route_board",
    status: "published",
    sort_order: 20,
  },
];

const collectionItems = [
  ["00000000-0000-4000-8000-000000001311", "00000000-0000-4000-8000-000000001301", "Reset Retreats", "A clear next step for fares, stays, and holiday routes.", "INR 44,000", null, "Plan Stay", "/?service=wellness#travel-search", "00000000-0000-4000-8000-000000000106", 10, {}],
  ["00000000-0000-4000-8000-000000001312", "00000000-0000-4000-8000-000000001301", "Backwater Weekends", "A clear next step for fares, stays, and holiday routes.", "INR 13,325", null, "View Route", "/trips", "00000000-0000-4000-8000-000000000107", 20, {}],
  ["00000000-0000-4000-8000-000000001313", "00000000-0000-4000-8000-000000001301", "Flexible Air Fares", "A clear next step for fares, stays, and holiday routes.", "INR 16,799", null, "Search Fare", "/?service=flight#travel-search", "00000000-0000-4000-8000-000000000101", 30, {}],
  ["00000000-0000-4000-8000-000000001314", "00000000-0000-4000-8000-000000001301", "Snowline Holidays", "A clear next step for fares, stays, and holiday routes.", "INR 16,500", null, "View Stay", "/trips", "00000000-0000-4000-8000-000000000108", 40, {}],
  ["00000000-0000-4000-8000-000000001315", "00000000-0000-4000-8000-000000001301", "Blue Water Cruises", "A clear next step for fares, stays, and holiday routes.", "INR 33,990", null, "Plan Cruise", "/?service=cruise#travel-search", "00000000-0000-4000-8000-000000000109", 50, {}],
  ["00000000-0000-4000-8000-000000001321", "00000000-0000-4000-8000-000000001302", "Kathmandu & Peaks", "Nepal route", "Starts INR 14,444", "4 Nights / 5 Days", "View Route", "/trips", "00000000-0000-4000-8000-000000000110", 10, { size: "featured" }],
  ["00000000-0000-4000-8000-000000001322", "00000000-0000-4000-8000-000000001302", "Vietnam Coastline", "Vietnam route", "Starts INR 33,899", "3 Nights / 4 Days", "View Route", "/trips", "00000000-0000-4000-8000-000000000111", 20, { size: "small" }],
  ["00000000-0000-4000-8000-000000001323", "00000000-0000-4000-8000-000000001302", "Malaysia City Break", "Malaysia route", "Starts INR 27,666", "3 Nights / 4 Days", "View Route", "/trips", "00000000-0000-4000-8000-000000000112", 30, { size: "small" }],
  ["00000000-0000-4000-8000-000000001324", "00000000-0000-4000-8000-000000001302", "Turkey Eid Route", "Turkey route", "Starts SAR 2,999", "3 Nights / 4 Days", "View Route", "/trips/turkey", "00000000-0000-4000-8000-000000000113", 40, { size: "wide" }],
].map(([id, collection_id, title, subtitle, price_label, duration_label, action_label, href, media_id, sort_order, metadata]) => ({
  id,
  collection_id,
  title,
  subtitle,
  price_label,
  duration_label,
  action_label,
  href,
  media_id,
  status: "published",
  sort_order,
  metadata,
}));

const services = [
  [
    "00000000-0000-4000-8000-000000001401",
    "cruise-desk",
    "Cruise Desk",
    "cruise",
    "00000000-0000-4000-8000-000000000109",
    "Cruise requests are routed through the enquiry flow until live supplier integrations are connected.",
  ],
  [
    "00000000-0000-4000-8000-000000001402",
    "hotel-stays",
    "Hotel Stays",
    "hotel",
    "00000000-0000-4000-8000-000000000114",
    "Hotel stays will later connect to provider-backed search, recheck, and booking confirmation.",
  ],
  [
    "00000000-0000-4000-8000-000000001403",
    "rail-coach",
    "Rail & Coach",
    "bus",
    "00000000-0000-4000-8000-000000000105",
    "Ground transport requests stay enquiry-based until provider scope is finalized.",
  ],
  [
    "00000000-0000-4000-8000-000000001404",
    "passport-desk",
    "Passport Desk",
    "passport",
    "00000000-0000-4000-8000-000000000115",
    "Customers should share only required passport details through approved channels after verification.",
  ],
  [
    "00000000-0000-4000-8000-000000001405",
    "document-attestation",
    "Document Attestation",
    "document",
    "00000000-0000-4000-8000-000000000115",
    "Final attestation requirements depend on document type, issuing country, and destination country.",
  ],
  [
    "00000000-0000-4000-8000-000000001406",
    "travel-cover",
    "Travel Cover",
    "insurance",
    "00000000-0000-4000-8000-000000000102",
    "Travel cover requests are handled as enquiries until the insurance provider flow is confirmed.",
  ],
].map(([id, slug, title, icon, media_id, body], index) => ({
  id,
  slug,
  title,
  summary: "Straightforward help, tidy documents, and quick handoffs.",
  body,
  icon,
  media_id,
  status: "published",
  sort_order: (index + 1) * 10,
}));

const testimonials = [
  ["00000000-0000-4000-8000-000000001501", "Muhammed Ashik", "Fly Time kept my UAE visa process calm and clear. I always knew the next step.", null],
  ["00000000-0000-4000-8000-000000001502", "Nekil Taji", "Our Singapore break felt organized from airport pickup to the last hotel checkout.", "00000000-0000-4000-8000-000000000113"],
  ["00000000-0000-4000-8000-000000001503", "Arjun KS", "The Nepal route had the right pace, clean hotels, and support whenever we needed it.", null],
  ["00000000-0000-4000-8000-000000001504", "Amritha K.S", "The mountain stay was smooth, quiet, and easy to follow from the first call.", "00000000-0000-4000-8000-000000000103"],
  ["00000000-0000-4000-8000-000000001505", "Cedric Dsilva", "Phuket was handled neatly: transfers, rooms, and activity options were all clear.", null],
  ["00000000-0000-4000-8000-000000001506", "Rahul M R", "I picked Fly Time for a family holiday and the plan stayed simple the whole way.", "00000000-0000-4000-8000-000000000108"],
].map(([id, author, quote, media_id], index) => ({
  id,
  author,
  quote,
  media_id,
  status: "published",
  sort_order: (index + 1) * 10,
}));

await upsert("media_assets", mediaAssets, "id");
await upsert("site_sections", siteSections, "key");
await upsert("footer_columns", footerColumns, "id");
await upsert("footer_links", footerLinks, "id");
await upsert("collections", collections, "slug");
await upsert("collection_items", collectionItems, "id");
await upsert("services", services, "slug");
await upsert("testimonials", testimonials, "id");
await verifyPublishedHomeRows();

console.log(
  JSON.stringify(
    {
      ok: true,
      media: mediaAssets.length,
      collections: collections.length,
      collectionItems: collectionItems.length,
      services: services.length,
      testimonials: testimonials.length,
      footerColumns: footerColumns.length,
      footerLinks: footerLinks.length,
    },
    null,
    2,
  ),
);

async function upsert(table, rows, onConflict) {
  const result = await supabase.from(table).upsert(rows, { onConflict });

  if (result.error) {
    throw new Error(`${table}: ${result.error.message}`);
  }
}

async function verifyPublishedHomeRows() {
  const checks = [
    ["collections", supabase.from("collections").select("id", { count: "exact", head: true }).eq("status", "published")],
    ["collection_items", supabase.from("collection_items").select("id", { count: "exact", head: true }).eq("status", "published")],
    ["services", supabase.from("services").select("id", { count: "exact", head: true }).eq("status", "published")],
    ["testimonials", supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("status", "published")],
    ["footer_links", supabase.from("footer_links").select("id", { count: "exact", head: true }).eq("status", "published")],
  ];

  for (const [name, query] of checks) {
    const result = await query;

    if (result.error) {
      throw new Error(`${name}: ${result.error.message}`);
    }

    if (!result.count) {
      throw new Error(`${name}: no published rows found after seed.`);
    }
  }
}

function readEnvFile(path) {
  const content = readFileSync(path, "utf8");
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    values[key] = rawValue.replace(/^"|"$/g, "");
  }

  return values;
}
