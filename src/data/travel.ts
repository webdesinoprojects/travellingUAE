import type {
  BentoPackage,
  FooterColumn,
  HeroTab,
  NavItem,
  ProductCard,
  ServiceTile,
  Testimonial,
} from "@/types/travel";

export const navItems: NavItem[] = [
  { label: "Flights", href: "/?service=flight#travel-search" },
  {
    label: "Visa Desk",
    href: "/?service=visa#travel-search",
    hasDropdown: true,
    children: [
      { label: "Gulf Visa", href: "/gulf-visa" },
      { label: "Global Visa", href: "/global-visa" },
    ],
  },
  {
    label: "Holidays",
    href: "/?service=packages#travel-search",
    hasDropdown: true,
    children: [
      { label: "Holiday Packages", href: "/?service=packages#travel-search" },
      {
        label: "Customised Packages",
        href: "/?service=customized-packages#travel-search",
      },
      { label: "Hajj & Umrah", href: "/hajj-umrah" },
    ],
  },
  { label: "Wellness", href: "/?service=wellness#travel-search" },
  {
    label: "Travel Desk",
    href: "/?service=transfers#travel-search",
    hasDropdown: true,
    children: [
      { label: "Transfers", href: "/?service=transfers#travel-search" },
      { label: "Car Rental", href: "/?service=car-rental#travel-search" },
      { label: "Insurance", href: "/?service=insurance#travel-search" },
      { label: "Assist Service", href: "/?service=assist-service#travel-search" },
      { label: "E-SIM", href: "/?service=e-sim#travel-search" },
    ],
  },
  { label: "Hajj & Umrah", href: "/hajj-umrah" },
  { label: "Journal", href: "/journal" },
];

export const primarySearchServices: HeroTab[] = [
  { label: "Flights", icon: "flight", service: "flight" },
  { label: "Hotel", icon: "hotel", service: "hotel" },
  { label: "Packages", icon: "package", service: "packages" },
  { label: "Wellness", icon: "wellness", service: "wellness" },
  { label: "Hajj & Umrah", icon: "hajj", service: "hajj-umrah" },
  { label: "Visa", icon: "visa", service: "visa" },
];

export const moreSearchServices: HeroTab[] = [
  { label: "Transfers", icon: "transfer", service: "transfers" },
  { label: "Car Rental", icon: "car", service: "car-rental" },
  { label: "Insurance", icon: "insurance", service: "insurance" },
  {
    label: "Customised Packages",
    icon: "package",
    service: "customized-packages",
  },
  { label: "Assist Service", icon: "bus", service: "assist-service" },
  { label: "E-SIM", icon: "sim", service: "e-sim" },
];

export const heroTabs: HeroTab[] = primarySearchServices;

export const exclusives: ProductCard[] = [
  {
    title: "Reset Retreats",
    price: "INR 44,000",
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
    alt: "Wellness spa massage treatment in Kerala",
    action: "Plan Stay",
  },
  {
    title: "Backwater Weekends",
    price: "INR 13,325",
    image:
      "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=80",
    alt: "Kerala backwaters with a houseboat and palm trees",
    action: "View Route",
  },
  {
    title: "Flexible Air Fares",
    price: "INR 16,799",
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80",
    alt: "Passenger airplane wing above clouds",
    action: "Search Fare",
  },
  {
    title: "Snowline Holidays",
    price: "INR 16,500",
    image:
      "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80",
    alt: "Snowy Kashmir valley and lake",
    action: "View Stay",
  },
  {
    title: "Blue Water Cruises",
    price: "INR 33,990",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=900&q=80",
    alt: "Large cruise ship at sea",
    action: "Plan Cruise",
  },
];

export const bentoPackages: BentoPackage[] = [
  {
    title: "Kathmandu & Peaks",
    price: "Starts INR 14,444",
    duration: "4 Nights / 5 Days",
    image:
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=82",
    alt: "Temple architecture in Nepal",
    size: "featured",
  },
  {
    title: "Vietnam Coastline",
    price: "Starts INR 33,899",
    duration: "3 Nights / 4 Days",
    image:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=82",
    alt: "Boats in Ha Long Bay Vietnam",
    size: "small",
  },
  {
    title: "Malaysia City Break",
    price: "Starts INR 27,666",
    duration: "3 Nights / 4 Days",
    image:
      "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?auto=format&fit=crop&w=900&q=82",
    alt: "Kuala Lumpur skyline at dusk",
    size: "small",
  },
  {
    title: "Turkey Eid Route",
    price: "Starts SAR 2,999",
    duration: "3 Nights / 4 Days",
    image:
      "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1400&q=82",
    alt: "Hot air balloons over a Turkey holiday landscape",
    size: "wide",
    href: "/trips/turkey",
  },
];

export const services: ServiceTile[] = [
  {
    title: "Cruise Desk",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=700&q=80",
    alt: "Cruise ship sailing during sunset",
    icon: "cruise",
  },
  {
    title: "Hotel Stays",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=700&q=80",
    alt: "Luxury hotel building",
    icon: "hotel",
  },
  {
    title: "Rail & Coach",
    image:
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=700&q=80",
    alt: "Modern train platform",
    icon: "bus",
  },
  {
    title: "Passport Desk",
    image:
      "https://images.unsplash.com/photo-1542466500-dccb2789cbbb?auto=format&fit=crop&w=700&q=80",
    alt: "Passport and travel map",
    icon: "passport",
  },
  {
    title: "Document Attestation",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=700&q=80",
    alt: "Documents being signed at a desk",
    icon: "document",
  },
  {
    title: "Travel Cover",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=700&q=80",
    alt: "Travel documents and insurance paperwork",
    icon: "insurance",
  },
];

export const testimonials: Testimonial[] = [
  {
    quote:
      "Fly Time kept my UAE visa process calm and clear. I always knew the next step.",
    author: "Muhammed Ashik",
  },
  {
    quote:
      "Our Singapore break felt organized from airport pickup to the last hotel checkout.",
    author: "Nekil Taji",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
    alt: "Travelers sitting together in a green park",
  },
  {
    quote:
      "The Nepal route had the right pace, clean hotels, and support whenever we needed it.",
    author: "Arjun KS",
  },
  {
    quote:
      "The mountain stay was smooth, quiet, and easy to follow from the first call.",
    author: "Amritha K.S",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
    alt: "Couple looking at mountains during a trip",
  },
  {
    quote:
      "Phuket was handled neatly: transfers, rooms, and activity options were all clear.",
    author: "Cedric Dsilva",
  },
  {
    quote:
      "I picked Fly Time for a family holiday and the plan stayed simple the whole way.",
    author: "Rahul M R",
    image:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=700&q=80",
    alt: "Group of travelers standing in snowy mountains",
  },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Company",
    links: [
      { label: "About Fly Time", href: "/about" },
      { label: "Work with us", href: "/contact" },
      { label: "Contact desk", href: "/contact" },
    ],
  },
  {
    title: "Travel Desk",
    links: [
      { label: "India Tour Package", href: "/trips" },
      { label: "International Tour Package", href: "/trips" },
      { label: "Flight", href: "/?service=flight#travel-search" },
      { label: "Global Visa", href: "/global-visa" },
      { label: "Gulf Visa", href: "/gulf-visa" },
      { label: "Hajj & Umrah", href: "/hajj-umrah" },
      { label: "Cruise", href: "/?service=cruise#travel-search" },
      { label: "Hotel Booking", href: "/?service=hotel#travel-search" },
      { label: "Bus & Train Tickets", href: "/?service=transfers#travel-search" },
      { label: "Passport Services", href: "/passport-services" },
      { label: "Document Attestation", href: "/document-attestation" },
      { label: "Travel Insurance", href: "/?service=insurance#travel-search" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
    ],
  },
];
